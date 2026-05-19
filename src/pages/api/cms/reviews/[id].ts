import type { APIRoute } from 'astro';

import { isCmsAuthorized } from '../../../../lib/cms/auth';
import { deleteReview, updateReviewApproval } from '../../../../lib/reviews/reviews-service';

export const prerender = false;

const jsonHeaders = {
	'Content-Type': 'application/json; charset=utf-8',
	'Cache-Control': 'no-store, max-age=0',
};

export const PATCH: APIRoute = async ({ request, params }) => {
	if (!isCmsAuthorized(request)) {
		return new Response(JSON.stringify({ error: 'unauthorized' }), {
			status: 401,
			headers: jsonHeaders,
		});
	}

	let payload: Record<string, unknown>;
	try {
		payload = (await request.json()) as Record<string, unknown>;
	} catch {
		return new Response(JSON.stringify({ error: 'invalid_json' }), {
			status: 400,
			headers: jsonHeaders,
		});
	}

	if (typeof payload.approved !== 'boolean') {
		return new Response(JSON.stringify({ error: 'invalid_approved' }), {
			status: 400,
			headers: jsonHeaders,
		});
	}

	try {
		const review = await updateReviewApproval(params.id ?? '', payload.approved);
		if (!review) {
			return new Response(JSON.stringify({ error: 'not_found' }), {
				status: 404,
				headers: jsonHeaders,
			});
		}
		return new Response(JSON.stringify({ ok: true, review }), {
			status: 200,
			headers: jsonHeaders,
		});
	} catch {
		return new Response(JSON.stringify({ error: 'review_update_failed' }), {
			status: 500,
			headers: jsonHeaders,
		});
	}
};

export const DELETE: APIRoute = async ({ request, params }) => {
	if (!isCmsAuthorized(request)) {
		return new Response(JSON.stringify({ error: 'unauthorized' }), {
			status: 401,
			headers: jsonHeaders,
		});
	}

	try {
		const deleted = await deleteReview(params.id ?? '');
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
		return new Response(JSON.stringify({ error: 'review_delete_failed' }), {
			status: 500,
			headers: jsonHeaders,
		});
	}
};
