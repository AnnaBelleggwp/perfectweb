import { promises as fs } from 'node:fs';
import path from 'node:path';

import type { APIRoute } from 'astro';

import { getCmsSessionStoreStatus, isCmsAuthorized } from '../../../lib/cms/auth';
import { listBackups } from '../../../lib/cms/backup-service';
import { inspectMediaStorage } from '../../../lib/cms/media-service';
import { STORAGE_DIR, pathExists, writeTextAtomic } from '../../../lib/cms/storage-utils';

export const prerender = false;

const jsonHeaders = {
	'Content-Type': 'application/json; charset=utf-8',
	'Cache-Control': 'no-store, max-age=0',
};

const fileStat = async (filePath: string) => {
	try {
		const stat = await fs.stat(filePath);
		return {
			exists: true,
			size: stat.size,
			mtime: stat.mtime.toISOString(),
		};
	} catch {
		return {
			exists: false,
			size: 0,
			mtime: null,
		};
	}
};

const countFiles = async (dir: string): Promise<number> => {
	try {
		const entries = await fs.readdir(dir, { withFileTypes: true });
		let count = 0;
		for (const entry of entries) {
			const entryPath = path.join(dir, entry.name);
			count += entry.isDirectory() ? await countFiles(entryPath) : 1;
		}
		return count;
	} catch {
		return 0;
	}
};

const checkWritable = async () => {
	const checkPath = path.join(STORAGE_DIR, '.write-check');
	try {
		await writeTextAtomic(checkPath, `${new Date().toISOString()}\n`);
		await fs.rm(checkPath, { force: true });
		return true;
	} catch {
		return false;
	}
};

export const GET: APIRoute = async ({ request }) => {
	if (!isCmsAuthorized(request)) {
		return new Response(JSON.stringify({ error: 'unauthorized' }), {
			status: 401,
			headers: jsonHeaders,
		});
	}

	const contentFile = path.join(STORAGE_DIR, 'site-content.json');
	const contactFile = path.join(STORAGE_DIR, 'contact-submissions.jsonl');
	const reviewsFile = path.join(STORAGE_DIR, 'reviews.jsonl');
	const mediaDir = path.join(STORAGE_DIR, 'media');
	const mediaManifest = path.join(mediaDir, 'manifest.json');
	const backups = await listBackups().catch(() => []);
	const mediaIntegrity = await inspectMediaStorage().catch(() => null);

	const payload = {
		ok: true,
		storage: {
			path: STORAGE_DIR,
			exists: await pathExists(STORAGE_DIR),
			writable: await checkWritable(),
		},
		sessions: getCmsSessionStoreStatus(),
		files: {
			content: await fileStat(contentFile),
			contactSubmissions: await fileStat(contactFile),
			reviews: await fileStat(reviewsFile),
			mediaManifest: await fileStat(mediaManifest),
			mediaFileCount: await countFiles(path.join(mediaDir, 'assets')),
			backups: {
				count: backups.length,
				latest: backups[0] ?? null,
			},
		},
		mediaIntegrity,
	};

	return new Response(JSON.stringify(payload), {
		status: 200,
		headers: jsonHeaders,
	});
};
