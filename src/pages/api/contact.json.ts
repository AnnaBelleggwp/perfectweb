import type { APIRoute } from 'astro';

import {
	ContactValidationError,
	saveContactSubmission,
} from '../../lib/contact/submissions-service';

export const prerender = false;

const jsonHeaders = {
	'Content-Type': 'application/json; charset=utf-8',
	'Cache-Control': 'no-store, max-age=0',
};

const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 5;
const buckets = new Map<string, number[]>();

const rateLimit = (key: string) => {
	const now = Date.now();
	const recent = (buckets.get(key) ?? []).filter((ts) => now - ts < WINDOW_MS);
	if (recent.length >= MAX_PER_WINDOW) return false;
	recent.push(now);
	buckets.set(key, recent);
	return true;
};

export const POST: APIRoute = async ({ request, clientAddress }) => {
	let payload: Record<string, unknown>;
	try {
		payload = (await request.json()) as Record<string, unknown>;
	} catch {
		return new Response(JSON.stringify({ error: 'invalid_json' }), {
			status: 400,
			headers: jsonHeaders,
		});
	}

	if (typeof payload.website === 'string' && payload.website.trim().length > 0) {
		return new Response(JSON.stringify({ ok: true, id: 'skipped' }), {
			status: 200,
			headers: jsonHeaders,
		});
	}

	const ip = clientAddress ?? request.headers.get('x-forwarded-for') ?? 'unknown';
	if (!rateLimit(ip)) {
		return new Response(
			JSON.stringify({ error: 'rate_limited', message: 'слишком много запросов. попробуйте позже.' }),
			{ status: 429, headers: jsonHeaders },
		);
	}

	try {
		const submission = await saveContactSubmission({
			email: String(payload.email ?? ''),
			question: String(payload.question ?? ''),
			ip,
			userAgent: request.headers.get('user-agent'),
		});
		return new Response(
			JSON.stringify({ ok: true, id: submission.id, createdAt: submission.createdAt }),
			{ status: 200, headers: jsonHeaders },
		);
	} catch (err) {
		if (err instanceof ContactValidationError) {
			return new Response(
				JSON.stringify({ error: 'validation', field: err.field, message: err.message }),
				{ status: 422, headers: jsonHeaders },
			);
		}
		return new Response(JSON.stringify({ error: 'server' }), {
			status: 500,
			headers: jsonHeaders,
		});
	}
};
