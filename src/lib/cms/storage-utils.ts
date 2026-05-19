import { promises as fs } from 'node:fs';
import path from 'node:path';

export const STORAGE_DIR = path.join(process.cwd(), 'storage');

export class StorageError extends Error {
	code: string;
	cause?: unknown;

	constructor(code: string, message: string, cause?: unknown) {
		super(message);
		this.name = 'StorageError';
		this.code = code;
		this.cause = cause;
	}
}

export const pathExists = async (filePath: string) => {
	try {
		await fs.access(filePath);
		return true;
	} catch {
		return false;
	}
};

export const ensureStorageDir = async () => {
	await fs.mkdir(STORAGE_DIR, { recursive: true });
};

export const writeTextAtomic = async (filePath: string, content: string) => {
	await fs.mkdir(path.dirname(filePath), { recursive: true });
	const tmpPath = path.join(
		path.dirname(filePath),
		`.${path.basename(filePath)}.${process.pid}.${Date.now()}.tmp`,
	);

	await fs.writeFile(tmpPath, content, 'utf-8');
	await fs.rename(tmpPath, filePath);
};

export const backupExistingFile = async (filePath: string, backupName: string) => {
	if (!(await pathExists(filePath))) return null;
	const backupPath = path.join(path.dirname(filePath), backupName);
	await fs.copyFile(filePath, backupPath);
	return backupPath;
};
