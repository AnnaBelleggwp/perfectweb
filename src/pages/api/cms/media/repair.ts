import type { APIRoute } from 'astro';

import { isCmsAuthorized } from '../../../../lib/cms/auth';
import { repairMediaManifest } from '../../../../lib/cms/media-service';
import { StorageError } from '../../../../lib/cms/storage-utils';

export const prerender = false;

const jsonHeaders = {
	'Content-Type': 'application/json; charset=utf-8',
	'Cache-Control': 'no-store, max-age=0',
};

export const POST: APIRoute = async ({ request }) => {
	if (!isCmsAuthorized(request)) {
		return new Response(JSON.stringify({ error: 'unauthorized' }), {
			status: 401,
			headers: jsonHeaders,
		});
	}

	try {
		const result = await repairMediaManifest();
		return new Response(JSON.stringify({ ok: true, ...result }), {
			status: 200,
			headers: jsonHeaders,
		});
	} catch (error) {
		return new Response(
			JSON.stringify({ error: error instanceof StorageError ? error.code : 'media_repair_failed' }),
			{ status: 500, headers: jsonHeaders },
		);
	}
};
