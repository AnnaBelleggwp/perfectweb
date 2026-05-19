import type { APIRoute } from 'astro';

import { resetSiteContent, readSiteContent, writeSiteContent } from '../../../lib/cms/content-service';
import { isCmsAuthorized } from '../../../lib/cms/auth';

export const prerender = false;

const jsonHeaders = {
	'Content-Type': 'application/json; charset=utf-8',
	'Cache-Control': 'no-store, max-age=0',
};

const serverError = (error = 'content_storage_error') =>
	new Response(JSON.stringify({ error }), {
		status: 500,
		headers: jsonHeaders,
	});

export const GET: APIRoute = async ({ request }) => {
	if (!isCmsAuthorized(request)) {
		return new Response(JSON.stringify({ error: 'unauthorized' }), {
			status: 401,
			headers: jsonHeaders,
		});
	}

	try {
		const content = await readSiteContent();
		return new Response(JSON.stringify(content), {
			status: 200,
			headers: jsonHeaders,
		});
	} catch {
		return serverError('content_read_failed');
	}
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

	try {
		const next = await writeSiteContent(payload);
		return new Response(JSON.stringify(next), {
			status: 200,
			headers: jsonHeaders,
		});
	} catch {
		return serverError('content_write_failed');
	}
};

export const DELETE: APIRoute = async ({ request }) => {
	if (!isCmsAuthorized(request)) {
		return new Response(JSON.stringify({ error: 'unauthorized' }), {
			status: 401,
			headers: jsonHeaders,
		});
	}

	try {
		const next = await resetSiteContent();
		return new Response(JSON.stringify(next), {
			status: 200,
			headers: jsonHeaders,
		});
	} catch {
		return serverError('content_reset_failed');
	}
};
