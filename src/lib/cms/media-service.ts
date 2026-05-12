import { randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';

import sharp from 'sharp';

import type { PortfolioMedia, PortfolioMediaVariant } from '../../data/site-content';

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

const STORAGE_DIR = path.join(process.cwd(), 'storage');
const STORAGE_MEDIA_DIR = path.join(STORAGE_DIR, 'media');
const STORAGE_MEDIA_ASSETS_DIR = path.join(STORAGE_MEDIA_DIR, 'assets');
const STORAGE_MEDIA_MANIFEST_FILE = path.join(STORAGE_MEDIA_DIR, 'manifest.json');

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
		await fs.writeFile(STORAGE_MEDIA_MANIFEST_FILE, `${JSON.stringify(initial, null, 2)}\n`, 'utf-8');
	}
};

const readManifest = async (): Promise<StoredMediaManifest> => {
	await ensureMediaStorage();
	try {
		const raw = await fs.readFile(STORAGE_MEDIA_MANIFEST_FILE, 'utf-8');
		const parsed = JSON.parse(raw) as unknown;
		if (typeof parsed !== 'object' || parsed === null || !('assets' in parsed)) {
			return { assets: {} };
		}
		const assets = (parsed as { assets?: Record<string, StoredMediaAsset> }).assets;
		return { assets: assets ?? {} };
	} catch {
		return { assets: {} };
	}
};

const writeManifest = async (manifest: StoredMediaManifest) => {
	await ensureMediaStorage();
	await fs.writeFile(STORAGE_MEDIA_MANIFEST_FILE, `${JSON.stringify(manifest, null, 2)}\n`, 'utf-8');
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

	const variants: PortfolioMediaVariant[] = asset.files
		.filter((file) => file.role === 'variant')
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
	const transformed = sharp(buffer).resize({ width, withoutEnlargement: true });
	const metadata = await transformed.metadata();
	if (!metadata.width || !metadata.height) {
		throw new Error('image_processing_failed');
	}
	const output = await transformed.webp({ quality: 84 }).toBuffer();
	return {
		buffer: output,
		width: metadata.width,
		height: metadata.height,
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

	for (const width of targetWidths) {
		const variant = await makeVariant(source, width);
		const fileName = `w${variant.width}.webp`;
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
		await fs.access(filePath);
	} catch {
		return null;
	}

	return {
		filePath,
		contentType: fileMimeByName(fileName),
	};
};
