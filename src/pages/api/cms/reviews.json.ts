import type { APIRoute } from 'astro';

import { isCmsAuthorized } from '../../../lib/cms/auth';
import { listReviews } from '../../../lib/reviews/reviews-service';

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
		const reviews = await listReviews();
		return new Response(JSON.stringify({ ok: true, reviews }), {
			status: 200,
			headers: jsonHeaders,
		});
	} catch {
		return new Response(JSON.stringify({ error: 'reviews_read_failed' }), {
			status: 500,
			headers: jsonHeaders,
		});
	}
};
