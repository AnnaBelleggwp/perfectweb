import { promises as fs } from 'node:fs';

import type { APIRoute } from 'astro';

import { StorageError } from '../../../../../../lib/cms/storage-utils';
import { resolveMediaFile } from '../../../../../../lib/cms/media-service';

export const prerender = false;

export const GET: APIRoute = async ({ params }) => {
	const id = params.id;
	const fileParam = params.file;
	if (!id || !fileParam) {
		return new Response('Not Found', { status: 404 });
	}

	let resolved;
	try {
		resolved = await resolveMediaFile(id, fileParam);
	} catch (error) {
		if (error instanceof StorageError) {
			return new Response('Media storage unavailable', { status: 500 });
		}
		throw error;
	}

	if (!resolved) {
		return new Response('Not Found', { status: 404 });
	}

	try {
		const fileBuffer = await fs.readFile(resolved.filePath);
		return new Response(fileBuffer, {
			status: 200,
			headers: {
				'Content-Type': resolved.contentType,
				'Cache-Control': 'public, max-age=31536000, immutable',
			},
		});
	} catch {
		return new Response('Not Found', { status: 404 });
	}
};
