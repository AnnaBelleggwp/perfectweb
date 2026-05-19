import { createHash, randomBytes } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';

import {
	STORAGE_DIR,
	StorageError,
	ensureStorageDir,
	pathExists,
	writeTextAtomic,
} from './storage-utils';

type BackupFile = {
	path: string;
	encoding: 'base64';
	byteSize: number;
	sha256: string;
	content: string;
};

type BackupDocument = {
	version: 1;
	id: string;
	createdAt: string;
	note: string;
	files: BackupFile[];
};

export type BackupSummary = {
	id: string;
	createdAt: string;
	note: string;
	fileCount: number;
	byteSize: number;
	archiveSize: number;
};

const BACKUPS_DIR = path.join(STORAGE_DIR, 'backups');
const BACKUP_EXTENSION = '.perfectweb-backup.json';
const BACKUP_ID_RE = /^[a-z0-9-]+$/;

const ROOT_FILES = [
	'site-content.json',
	'contact-submissions.jsonl',
	'reviews.jsonl',
	'media/manifest.json',
];

const ROOT_DIRS = [
	'media/assets',
];

const normalizeRelativePath = (relativePath: string) => relativePath.split(path.sep).join('/');

const backupFilePath = (id: string) => {
	if (!BACKUP_ID_RE.test(id)) {
		throw new StorageError('invalid_backup_id', 'Invalid backup id');
	}
	return path.join(BACKUPS_DIR, `${id}${BACKUP_EXTENSION}`);
};

const safeStoragePath = (relativePath: string) => {
	const normalized = path.posix.normalize(relativePath);
	if (
		!normalized ||
		normalized.startsWith('../') ||
		normalized === '..' ||
		path.isAbsolute(normalized) ||
		normalized.includes('\0') ||
		normalized.startsWith('backups/')
	) {
		throw new StorageError('invalid_backup_path', 'Invalid path inside backup');
	}

	return path.join(STORAGE_DIR, normalized);
};

const sha256 = (buffer: Buffer) => createHash('sha256').update(buffer).digest('hex');

const collectFilesFromDir = async (relativeDir: string): Promise<string[]> => {
	const dirPath = path.join(STORAGE_DIR, relativeDir);
	if (!(await pathExists(dirPath))) return [];

	const entries = await fs.readdir(dirPath, { withFileTypes: true });
	const files: string[] = [];
	for (const entry of entries) {
		const relativePath = normalizeRelativePath(path.join(relativeDir, entry.name));
		if (entry.isDirectory()) {
			files.push(...await collectFilesFromDir(relativePath));
		} else if (entry.isFile()) {
			files.push(relativePath);
		}
	}
	return files;
};

const collectBackupPaths = async () => {
	const rootFiles = [];
	for (const relativePath of ROOT_FILES) {
		if (await pathExists(path.join(STORAGE_DIR, relativePath))) {
			rootFiles.push(relativePath);
		}
	}

	const nestedFiles = (await Promise.all(ROOT_DIRS.map(collectFilesFromDir))).flat();
	return [...rootFiles, ...nestedFiles].sort();
};

const readBackupDocument = async (id: string): Promise<BackupDocument> => {
	try {
		const raw = await fs.readFile(backupFilePath(id), 'utf-8');
		const parsed = JSON.parse(raw) as BackupDocument;
		if (parsed.version !== 1 || parsed.id !== id || !Array.isArray(parsed.files)) {
			throw new Error('invalid_backup_shape');
		}
		return parsed;
	} catch (error) {
		throw new StorageError('backup_read_failed', 'Failed to read backup', error);
	}
};

const summarizeBackup = async (id: string): Promise<BackupSummary | null> => {
	try {
		const document = await readBackupDocument(id);
		const stat = await fs.stat(backupFilePath(id));
		return {
			id: document.id,
			createdAt: document.createdAt,
			note: document.note,
			fileCount: document.files.length,
			byteSize: document.files.reduce((sum, file) => sum + file.byteSize, 0),
			archiveSize: stat.size,
		};
	} catch {
		return null;
	}
};

export const listBackups = async (): Promise<BackupSummary[]> => {
	await fs.mkdir(BACKUPS_DIR, { recursive: true });
	const entries = await fs.readdir(BACKUPS_DIR, { withFileTypes: true });
	const ids = entries
		.filter((entry) => entry.isFile() && entry.name.endsWith(BACKUP_EXTENSION))
		.map((entry) => entry.name.slice(0, -BACKUP_EXTENSION.length))
		.filter((id) => BACKUP_ID_RE.test(id));

	const backups = (await Promise.all(ids.map(summarizeBackup)))
		.filter((backup): backup is BackupSummary => Boolean(backup));

	return backups.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
};

export const createBackup = async (note = 'manual'): Promise<BackupSummary> => {
	await ensureStorageDir();
	await fs.mkdir(BACKUPS_DIR, { recursive: true });

	const createdAt = new Date().toISOString();
	const id = `${createdAt.replace(/[^0-9]/g, '').slice(0, 14)}-${randomBytes(4).toString('hex')}`;
	const files: BackupFile[] = [];

	for (const relativePath of await collectBackupPaths()) {
		const filePath = path.join(STORAGE_DIR, relativePath);
		const buffer = await fs.readFile(filePath);
		files.push({
			path: relativePath,
			encoding: 'base64',
			byteSize: buffer.byteLength,
			sha256: sha256(buffer),
			content: buffer.toString('base64'),
		});
	}

	const document: BackupDocument = {
		version: 1,
		id,
		createdAt,
		note,
		files,
	};

	await writeTextAtomic(backupFilePath(id), `${JSON.stringify(document, null, 2)}\n`);
	const summary = await summarizeBackup(id);
	if (!summary) {
		throw new StorageError('backup_create_failed', 'Failed to create backup');
	}
	return summary;
};

export const restoreBackup = async (id: string) => {
	const document = await readBackupDocument(id);
	const currentBackup = await createBackup(`pre-restore:${id}`);
	const restoreTargets = new Set(document.files.map((file) => file.path));
	const managedPaths = await collectBackupPaths();

	for (const relativePath of managedPaths) {
		if (restoreTargets.has(relativePath)) continue;
		await fs.rm(safeStoragePath(relativePath), { force: true });
	}

	for (const file of document.files) {
		const buffer = Buffer.from(file.content, file.encoding);
		if (buffer.byteLength !== file.byteSize || sha256(buffer) !== file.sha256) {
			throw new StorageError('backup_checksum_failed', 'Backup file checksum mismatch');
		}
		await fs.mkdir(path.dirname(safeStoragePath(file.path)), { recursive: true });
		await fs.writeFile(safeStoragePath(file.path), buffer);
	}

	return {
		restored: {
			id: document.id,
			fileCount: document.files.length,
		},
		preRestoreBackup: currentBackup,
	};
};

export const deleteBackup = async (id: string) => {
	const filePath = backupFilePath(id);
	if (!(await pathExists(filePath))) return false;
	await fs.rm(filePath, { force: true });
	return true;
};
