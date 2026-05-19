import type { APIRoute } from 'astro';

import { isCmsAuthorized } from '../../../../../lib/cms/auth';
import { restoreBackup } from '../../../../../lib/cms/backup-service';

export const prerender = false;

const jsonHeaders = {
	'Content-Type': 'application/json; charset=utf-8',
	'Cache-Control': 'no-store, max-age=0',
};

export const POST: APIRoute = async ({ request, params }) => {
	if (!isCmsAuthorized(request)) {
		return new Response(JSON.stringify({ error: 'unauthorized' }), {
			status: 401,
			headers: jsonHeaders,
		});
	}

	try {
		const result = await restoreBackup(params.id ?? '');
		return new Response(JSON.stringify({ ok: true, ...result }), {
			status: 200,
			headers: jsonHeaders,
		});
	} catch {
		return new Response(JSON.stringify({ error: 'backup_restore_failed' }), {
			status: 500,
			headers: jsonHeaders,
		});
	}
};
