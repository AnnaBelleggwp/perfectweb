import { randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';

import sharp from 'sharp';

import type { PortfolioMedia, PortfolioMediaVariant } from '../../data/site-content';
import {
	STORAGE_DIR,
	StorageError,
	backupExistingFile,
	pathExists,
	writeTextAtomic,
} from './storage-utils';

type StoredMediaFormat = 'webp';

type StoredMediaFile = {
	fileName: string;
	width: number;
	height: number;
	format: StoredMediaFormat;
	byteSize: number;
	role: 'original' | 'variant';
};

type StoredMediaAsset = {
	id: string;
	createdAt: string;
	originalName: string;
	inputMimeType: string;
	blurDataUrl: string;
	files: StoredMediaFile[];
};

type StoredMediaManifest = {
	assets: Record<string, StoredMediaAsset>;
};

type MediaFileIssue = {
	assetId: string;
	fileName: string;
};

type MediaDuplicateIssue = MediaFileIssue & {
	count: number;
};

type MediaAssetIssue = {
	assetId: string;
	error: string;
};

export type MediaStorageIntegrity = {
	assetCount: number;
	manifestFileCount: number;
	diskFileCount: number;
	missingFiles: MediaFileIssue[];
	orphanFiles: MediaFileIssue[];
	duplicateManifestFiles: MediaDuplicateIssue[];
	invalidAssets: MediaAssetIssue[];
};

const STORAGE_MEDIA_DIR = path.join(STORAGE_DIR, 'media');
const STORAGE_MEDIA_ASSETS_DIR = path.join(STORAGE_MEDIA_DIR, 'assets');
const STORAGE_MEDIA_MANIFEST_FILE = path.join(STORAGE_MEDIA_DIR, 'manifest.json');
const STORAGE_MEDIA_MANIFEST_PREVIOUS_FILE = 'manifest.previous.json';

const MAX_UPLOAD_BYTES = 18 * 1024 * 1024;
const VARIANT_WIDTHS = [480, 768, 1024, 1366, 1600, 1920, 2560];

const normalizeId = (value: string) => value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '');

const buildMediaUrl = (assetId: string, fileName: string) =>
	`/api/cms/media/file/${encodeURIComponent(assetId)}/${encodeURIComponent(fileName)}`;

const ensureMediaStorage = async () => {
	await fs.mkdir(STORAGE_MEDIA_ASSETS_DIR, { recursive: true });
	try {
		await fs.access(STORAGE_MEDIA_MANIFEST_FILE);
	} catch {
		const initial: StoredMediaManifest = { assets: {} };
		await writeTextAtomic(STORAGE_MEDIA_MANIFEST_FILE, `${JSON.stringify(initial, null, 2)}\n`);
	}
};

const readManifest = async (): Promise<StoredMediaManifest> => {
	await ensureMediaStorage();
	try {
		const raw = await fs.readFile(STORAGE_MEDIA_MANIFEST_FILE, 'utf-8');
		const parsed = JSON.parse(raw) as unknown;
		if (typeof parsed !== 'object' || parsed === null || !('assets' in parsed)) {
			throw new Error('invalid_manifest_shape');
		}
		const assets = (parsed as { assets?: Record<string, StoredMediaAsset> }).assets;
		return { assets: assets ?? {} };
	} catch (error) {
		throw new StorageError(
			'media_manifest_read_failed',
			'Failed to read or parse storage/media/manifest.json',
			error,
		);
	}
};

const writeManifest = async (manifest: StoredMediaManifest) => {
	await ensureMediaStorage();
	await backupExistingFile(STORAGE_MEDIA_MANIFEST_FILE, STORAGE_MEDIA_MANIFEST_PREVIOUS_FILE);
	await writeTextAtomic(STORAGE_MEDIA_MANIFEST_FILE, `${JSON.stringify(manifest, null, 2)}\n`);
};

const listDiskAssetFiles = async () => {
	await ensureMediaStorage();
	const diskFiles: MediaFileIssue[] = [];
	const assetDirs = await fs.readdir(STORAGE_MEDIA_ASSETS_DIR, { withFileTypes: true });

	for (const assetDir of assetDirs) {
		if (!assetDir.isDirectory()) continue;
		const assetId = normalizeId(assetDir.name);
		if (!assetId || assetId !== assetDir.name) continue;

		const files = await fs.readdir(path.join(STORAGE_MEDIA_ASSETS_DIR, assetDir.name), {
			withFileTypes: true,
		});
		for (const file of files) {
			if (!file.isFile()) continue;
			diskFiles.push({
				assetId,
				fileName: file.name,
			});
		}
	}

	return diskFiles;
};

const readDiskMediaFileMeta = async (assetId: string, file: StoredMediaFile) => {
	const filePath = path.join(STORAGE_MEDIA_ASSETS_DIR, assetId, file.fileName);
	try {
		const [stat, meta] = await Promise.all([
			fs.stat(filePath),
			sharp(filePath).metadata(),
		]);
		return {
			...file,
			width: meta.width || file.width,
			height: meta.height || file.height,
			byteSize: stat.size,
		};
	} catch {
		return file;
	}
};

const ensureImageFile = (file: File) => {
	if (!file || typeof file.arrayBuffer !== 'function') {
		throw new Error('invalid_file');
	}
	if (!file.type.startsWith('image/')) {
		throw new Error('invalid_image_type');
	}
	if (file.size <= 0) {
		throw new Error('empty_file');
	}
	if (file.size > MAX_UPLOAD_BYTES) {
		throw new Error('file_too_large');
	}
};

const toPublicMedia = (asset: StoredMediaAsset): PortfolioMedia => {
	const original = asset.files.find((file) => file.role === 'original');
	if (!original) {
		throw new Error('asset_missing_original');
	}

	const seenVariantFiles = new Set<string>();
	const variants: PortfolioMediaVariant[] = asset.files
		.filter((file) => {
			if (file.role !== 'variant') return false;
			if (seenVariantFiles.has(file.fileName)) return false;
			seenVariantFiles.add(file.fileName);
			return true;
		})
		.sort((a, b) => a.width - b.width)
		.map((file) => ({
			url: buildMediaUrl(asset.id, file.fileName),
			width: file.width,
			height: file.height,
			format: file.format,
		}));

	const fallbackAlt = asset.originalName.replace(/\.[^.]+$/, '').trim();

	return {
		assetId: asset.id,
		alt: fallbackAlt,
		width: original.width,
		height: original.height,
		originalUrl: buildMediaUrl(asset.id, original.fileName),
		variants,
		blurDataUrl: asset.blurDataUrl,
	};
};

const makeVariant = async (buffer: Buffer, width: number) => {
	const { data, info } = await sharp(buffer)
		.resize({ width, withoutEnlargement: true })
		.webp({ quality: 84 })
		.toBuffer({ resolveWithObject: true });

	if (!info.width || !info.height) {
		throw new Error('image_processing_failed');
	}

	return {
		buffer: data,
		width: info.width,
		height: info.height,
	};
};

export const uploadMediaAsset = async (file: File): Promise<PortfolioMedia> => {
	ensureImageFile(file);
	await ensureMediaStorage();

	const source = Buffer.from(await file.arrayBuffer());
	const sourceMeta = await sharp(source).metadata();
	if (!sourceMeta.width || !sourceMeta.height) {
		throw new Error('invalid_image_metadata');
	}

	const assetId = normalizeId(randomUUID());
	const assetDir = path.join(STORAGE_MEDIA_ASSETS_DIR, assetId);
	await fs.mkdir(assetDir, { recursive: true });

	const files: StoredMediaFile[] = [];

	const originalBuffer = await sharp(source).webp({ quality: 92 }).toBuffer();
	const originalFileName = `original-${sourceMeta.width}w.webp`;
	await fs.writeFile(path.join(assetDir, originalFileName), originalBuffer);
	files.push({
		fileName: originalFileName,
		width: sourceMeta.width,
		height: sourceMeta.height,
		format: 'webp',
		byteSize: originalBuffer.byteLength,
		role: 'original',
	});

	const targetWidths = VARIANT_WIDTHS.filter((width) => width < sourceMeta.width);
	const writtenVariantNames = new Set<string>();

	for (const width of targetWidths) {
		const variant = await makeVariant(source, width);
		const fileName = `w${variant.width}.webp`;
		if (writtenVariantNames.has(fileName)) continue;
		writtenVariantNames.add(fileName);
		await fs.writeFile(path.join(assetDir, fileName), variant.buffer);
		files.push({
			fileName,
			width: variant.width,
			height: variant.height,
			format: 'webp',
			byteSize: variant.buffer.byteLength,
			role: 'variant',
		});
	}

	const blurBuffer = await sharp(source).resize({ width: 24, withoutEnlargement: true }).webp({ quality: 35 }).toBuffer();
	const blurDataUrl = `data:image/webp;base64,${blurBuffer.toString('base64')}`;

	const manifest = await readManifest();
	manifest.assets[assetId] = {
		id: assetId,
		createdAt: new Date().toISOString(),
		originalName: file.name,
		inputMimeType: file.type,
		blurDataUrl,
		files,
	};
	await writeManifest(manifest);

	return toPublicMedia(manifest.assets[assetId]);
};

export const deleteMediaAsset = async (assetIdRaw: string) => {
	const assetId = normalizeId(assetIdRaw);
	if (!assetId) return false;

	const manifest = await readManifest();
	if (!manifest.assets[assetId]) return false;

	delete manifest.assets[assetId];
	await writeManifest(manifest);

	const assetDir = path.join(STORAGE_MEDIA_ASSETS_DIR, assetId);
	await fs.rm(assetDir, { recursive: true, force: true });
	return true;
};

const fileMimeByName = (fileName: string) => {
	if (fileName.endsWith('.webp')) return 'image/webp';
	if (fileName.endsWith('.avif')) return 'image/avif';
	if (fileName.endsWith('.png')) return 'image/png';
	return 'image/jpeg';
};

export const resolveMediaFile = async (assetIdRaw: string, fileNameRaw: string) => {
	const assetId = normalizeId(assetIdRaw);
	const fileName = path.basename(fileNameRaw.trim());
	if (!assetId || !fileName) return null;

	const manifest = await readManifest();
	const asset = manifest.assets[assetId];
	if (!asset) return null;

	const knownFile = asset.files.find((file) => file.fileName === fileName);
	if (!knownFile) return null;

	const filePath = path.join(STORAGE_MEDIA_ASSETS_DIR, assetId, fileName);
	try {
		if (!(await pathExists(filePath))) {
			return null;
		}
	} catch {
		return null;
	}

	return {
		filePath,
		contentType: fileMimeByName(fileName),
	};
};

export const inspectMediaStorage = async (): Promise<MediaStorageIntegrity> => {
	const manifest = await readManifest();
	const diskFiles = await listDiskAssetFiles();
	const diskFileSet = new Set(diskFiles.map((file) => `${file.assetId}/${file.fileName}`));
	const manifestFileCounts = new Map<string, number>();
	const missingFiles: MediaFileIssue[] = [];
	const duplicateManifestFiles: MediaDuplicateIssue[] = [];
	const invalidAssets: MediaAssetIssue[] = [];
	let manifestFileCount = 0;

	for (const [assetId, asset] of Object.entries(manifest.assets)) {
		if (asset.id !== assetId) {
			invalidAssets.push({ assetId, error: 'asset_id_mismatch' });
		}
		if (!Array.isArray(asset.files)) {
			invalidAssets.push({ assetId, error: 'asset_files_invalid' });
			continue;
		}
		if (!asset.files.some((file) => file.role === 'original')) {
			invalidAssets.push({ assetId, error: 'asset_missing_original' });
		}

		for (const file of asset.files) {
			const fileName = path.basename(file.fileName || '');
			if (!fileName || fileName !== file.fileName) {
				invalidAssets.push({ assetId, error: 'asset_file_name_invalid' });
				continue;
			}

			manifestFileCount += 1;
			const key = `${assetId}/${fileName}`;
			manifestFileCounts.set(key, (manifestFileCounts.get(key) ?? 0) + 1);
			if (!diskFileSet.has(key)) {
				missingFiles.push({ assetId, fileName });
			}
		}
	}

	for (const [key, count] of manifestFileCounts) {
		if (count <= 1) continue;
		const [assetId, fileName] = key.split('/');
		duplicateManifestFiles.push({ assetId, fileName, count });
	}

	const orphanFiles = diskFiles.filter(
		(file) => !manifestFileCounts.has(`${file.assetId}/${file.fileName}`),
	);

	return {
		assetCount: Object.keys(manifest.assets).length,
		manifestFileCount,
		diskFileCount: diskFiles.length,
		missingFiles,
		orphanFiles,
		duplicateManifestFiles,
		invalidAssets,
	};
};

export const repairMediaManifest = async () => {
	const before = await inspectMediaStorage();
	const manifest = await readManifest();
	let changed = false;

	for (const [assetId, asset] of Object.entries(manifest.assets)) {
		if (asset.id !== assetId) {
			asset.id = assetId;
			changed = true;
		}
		if (!Array.isArray(asset.files)) {
			asset.files = [];
			changed = true;
			continue;
		}

		const seen = new Set<string>();
		const files: StoredMediaFile[] = [];
		for (const file of asset.files) {
			const fileName = path.basename(file.fileName || '');
			if (!fileName || fileName !== file.fileName) {
				changed = true;
				continue;
			}

			const key = `${file.role}:${fileName}`;
			if (seen.has(key)) {
				changed = true;
				continue;
			}
			seen.add(key);
			files.push(await readDiskMediaFileMeta(assetId, file));
		}

		if (files.length !== asset.files.length) {
			changed = true;
		}
		asset.files = files;
	}

	if (changed) {
		await writeManifest(manifest);
	}

	return {
		changed,
		before,
		after: await inspectMediaStorage(),
	};
};
