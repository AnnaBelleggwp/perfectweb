import type { APIRoute } from 'astro';

import {
	ReviewValidationError,
	createReview,
	listApprovedReviews,
} from '../../lib/reviews/reviews-service';

export const prerender = false;

const jsonHeaders = {
	'Content-Type': 'application/json; charset=utf-8',
	'Cache-Control': 'no-store, max-age=0',
};

const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 3;
const buckets = new Map<string, number[]>();

const rateLimit = (key: string) => {
	const now = Date.now();
	const recent = (buckets.get(key) ?? []).filter((ts) => now - ts < WINDOW_MS);
	if (recent.length >= MAX_PER_WINDOW) return false;
	recent.push(now);
	buckets.set(key, recent);
	return true;
};

export const GET: APIRoute = async () => {
	try {
		const reviews = await listApprovedReviews();
		return new Response(JSON.stringify(reviews), { headers: jsonHeaders });
	} catch {
		return new Response(JSON.stringify([]), { headers: jsonHeaders });
	}
};

export const POST: APIRoute = async ({ request, clientAddress }) => {
	if (!rateLimit(clientAddress)) {
		return new Response(
			JSON.stringify({ ok: false, error: 'Слишком много запросов, попробуйте позже' }),
			{ status: 429, headers: jsonHeaders },
		);
	}

	let payload: Record<string, unknown>;
	try {
		payload = await request.json();
	} catch {
		return new Response(
			JSON.stringify({ ok: false, error: 'Некорректный JSON' }),
			{ status: 400, headers: jsonHeaders },
		);
	}

	try {
		const review = await createReview(payload, clientAddress);
		return new Response(
			JSON.stringify({ ok: true, id: review.id, createdAt: review.createdAt }),
			{ status: 201, headers: jsonHeaders },
		);
	} catch (error) {
		if (error instanceof ReviewValidationError) {
			return new Response(
				JSON.stringify({ ok: false, error: error.message, field: error.field }),
				{ status: 400, headers: jsonHeaders },
			);
		}
		return new Response(
			JSON.stringify({ ok: false, error: 'server' }),
			{ status: 500, headers: jsonHeaders },
		);
	}
};
