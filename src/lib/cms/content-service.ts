import { promises as fs } from 'node:fs';
import path from 'node:path';

import { DEFAULT_SITE_CONTENT, normalizeSiteContent, type SiteContent } from '../../data/site-content';
import {
	STORAGE_DIR,
	StorageError,
	backupExistingFile,
	ensureStorageDir,
	pathExists,
	writeTextAtomic,
} from './storage-utils';

const STORAGE_FILE = path.join(STORAGE_DIR, 'site-content.json');
const STORAGE_PREVIOUS_FILE = 'site-content.previous.json';

const serialize = (value: SiteContent) => `${JSON.stringify(value, null, 2)}\n`;

const ensureStorage = async () => {
	await ensureStorageDir();
	if (!(await pathExists(STORAGE_FILE))) {
		await writeTextAtomic(STORAGE_FILE, serialize(DEFAULT_SITE_CONTENT));
	}
};

export const readSiteContent = async (): Promise<SiteContent> => {
	await ensureStorage();

	try {
		const raw = await fs.readFile(STORAGE_FILE, 'utf-8');
		const parsed = JSON.parse(raw) as unknown;
		return normalizeSiteContent(parsed);
	} catch (error) {
		throw new StorageError(
			'site_content_read_failed',
			'Failed to read or parse storage/site-content.json',
			error,
		);
	}
};

export const writeSiteContent = async (value: unknown): Promise<SiteContent> => {
	const normalized = normalizeSiteContent(value);
	await ensureStorageDir();
	await backupExistingFile(STORAGE_FILE, STORAGE_PREVIOUS_FILE);
	await writeTextAtomic(STORAGE_FILE, serialize(normalized));
	return normalized;
};

export const resetSiteContent = async (): Promise<SiteContent> => {
	await ensureStorageDir();
	await backupExistingFile(STORAGE_FILE, STORAGE_PREVIOUS_FILE);
	await writeTextAtomic(STORAGE_FILE, serialize(DEFAULT_SITE_CONTENT));
	return DEFAULT_SITE_CONTENT;
};
