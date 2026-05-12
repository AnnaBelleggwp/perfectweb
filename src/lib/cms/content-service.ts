import { promises as fs } from 'node:fs';
import path from 'node:path';

import { DEFAULT_SITE_CONTENT, normalizeSiteContent, type SiteContent } from '../../data/site-content';

const STORAGE_DIR = path.join(process.cwd(), 'storage');
const STORAGE_FILE = path.join(STORAGE_DIR, 'site-content.json');

const serialize = (value: SiteContent) => `${JSON.stringify(value, null, 2)}\n`;

const ensureStorage = async () => {
	try {
		await fs.access(STORAGE_FILE);
	} catch {
		await fs.mkdir(STORAGE_DIR, { recursive: true });
		await fs.writeFile(STORAGE_FILE, serialize(DEFAULT_SITE_CONTENT), 'utf-8');
	}
};

export const readSiteContent = async (): Promise<SiteContent> => {
	await ensureStorage();

	try {
		const raw = await fs.readFile(STORAGE_FILE, 'utf-8');
		const parsed = JSON.parse(raw) as unknown;
		return normalizeSiteContent(parsed);
	} catch {
		await fs.writeFile(STORAGE_FILE, serialize(DEFAULT_SITE_CONTENT), 'utf-8');
		return DEFAULT_SITE_CONTENT;
	}
};

export const writeSiteContent = async (value: unknown): Promise<SiteContent> => {
	const normalized = normalizeSiteContent(value);
	await fs.mkdir(STORAGE_DIR, { recursive: true });
	await fs.writeFile(STORAGE_FILE, serialize(normalized), 'utf-8');
	return normalized;
};

export const resetSiteContent = async (): Promise<SiteContent> => {
	await fs.mkdir(STORAGE_DIR, { recursive: true });
	await fs.writeFile(STORAGE_FILE, serialize(DEFAULT_SITE_CONTENT), 'utf-8');
	return DEFAULT_SITE_CONTENT;
};
