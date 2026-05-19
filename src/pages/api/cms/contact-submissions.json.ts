import type { APIRoute } from 'astro';

import { isCmsAuthorized } from '../../../lib/cms/auth';
import { listContactSubmissions } from '../../../lib/contact/submissions-service';

export const prerender = false;

const jsonHeaders = {
	'Content-Type': 'application/json; charset=utf-8',
	'Cache-Control': 'no-store, max-age=0',
};

export const GET: APIRoute = async ({ request }) => {
	if (!isCmsAuthorized(request)) {
		return new Response(JSON.stringify({ error: 'unauthorized' }), {
			status: 401,
			headers: jsonHeaders,
		});
	}

	try {
		const submissions = await listContactSubmissions();
		return new Response(JSON.stringify({ ok: true, submissions }), {
			status: 200,
			headers: jsonHeaders,
		});
	} catch {
		return new Response(JSON.stringify({ error: 'contact_submissions_read_failed' }), {
			status: 500,
			headers: jsonHeaders,
		});
	}
};
