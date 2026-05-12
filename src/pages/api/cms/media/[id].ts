import type { APIRoute } from 'astro';

import { isCmsAuthorized } from '../../../../lib/cms/auth';
import { deleteMediaAsset } from '../../../../lib/cms/media-service';

export const prerender = false;

const jsonHeaders = {
	'Content-Type': 'application/json; charset=utf-8',
	'Cache-Control': 'no-store, max-age=0',
};

export const DELETE: APIRoute = async ({ request, params }) => {
	if (!isCmsAuthorized(request)) {
		return new Response(JSON.stringify({ error: 'unauthorized' }), {
			status: 401,
			headers: jsonHeaders,
		});
	}

	const id = params.id;
	if (!id) {
		return new Response(JSON.stringify({ error: 'media_id_required' }), {
			status: 400,
			headers: jsonHeaders,
		});
	}

	const deleted = await deleteMediaAsset(id);
	return new Response(JSON.stringify({ ok: deleted }), {
		status: deleted ? 200 : 404,
		headers: jsonHeaders,
	});
};
