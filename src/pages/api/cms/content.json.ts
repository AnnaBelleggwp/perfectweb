import type { APIRoute } from 'astro';

import { resetSiteContent, readSiteContent, writeSiteContent } from '../../../lib/cms/content-service';
import { isCmsAuthorized } from '../../../lib/cms/auth';

export const prerender = false;

const jsonHeaders = {
	'Content-Type': 'application/json; charset=utf-8',
	'Cache-Control': 'no-store, max-age=0',
};

export const GET: APIRoute = async () => {
	const content = await readSiteContent();
	return new Response(JSON.stringify(content), {
		status: 200,
		headers: jsonHeaders,
	});
};

export const PUT: APIRoute = async ({ request }) => {
	if (!isCmsAuthorized(request)) {
		return new Response(JSON.stringify({ error: 'unauthorized' }), {
			status: 401,
			headers: jsonHeaders,
		});
	}

	let payload: unknown;
	try {
		payload = await request.json();
	} catch {
		return new Response(JSON.stringify({ error: 'invalid_json' }), {
			status: 400,
			headers: jsonHeaders,
		});
	}

	const next = await writeSiteContent(payload);
	return new Response(JSON.stringify(next), {
		status: 200,
		headers: jsonHeaders,
	});
};

export const DELETE: APIRoute = async ({ request }) => {
	if (!isCmsAuthorized(request)) {
		return new Response(JSON.stringify({ error: 'unauthorized' }), {
			status: 401,
			headers: jsonHeaders,
		});
	}

	const next = await resetSiteContent();
	return new Response(JSON.stringify(next), {
		status: 200,
		headers: jsonHeaders,
	});
};
