import type { APIRoute } from 'astro';

import { isCmsAuthorized } from '../../../../lib/cms/auth';
import { deleteBackup } from '../../../../lib/cms/backup-service';

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

	try {
		const deleted = await deleteBackup(params.id ?? '');
		if (!deleted) {
			return new Response(JSON.stringify({ error: 'not_found' }), {
				status: 404,
				headers: jsonHeaders,
			});
		}
		return new Response(JSON.stringify({ ok: true }), {
			status: 200,
			headers: jsonHeaders,
		});
	} catch {
		return new Response(JSON.stringify({ error: 'backup_delete_failed' }), {
			status: 500,
			headers: jsonHeaders,
		});
	}
};
