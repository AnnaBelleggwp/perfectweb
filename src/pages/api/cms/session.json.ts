import type { APIRoute } from 'astro';

import {
	clearCmsSessionSetCookie,
	createCmsSessionSetCookie,
	isCmsCredentialsValid,
	isCmsSessionAuthorized,
	isCmsTokenValid,
	revokeCmsSession,
} from '../../../lib/cms/auth';

export const prerender = false;

const jsonHeaders = {
	'Content-Type': 'application/json; charset=utf-8',
	'Cache-Control': 'no-store, max-age=0',
};

const LOGIN_WINDOW_MS = 15 * 60_000;
const MAX_LOGIN_ATTEMPTS = 6;
const loginBuckets = new Map<string, number[]>();

const clientKey = (request: Request, clientAddress?: string) => {
	const forwardedFor = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
	return clientAddress || forwardedFor || 'unknown';
};

const recordFailedLogin = (key: string) => {
	const now = Date.now();
	const recent = (loginBuckets.get(key) ?? []).filter((ts) => now - ts < LOGIN_WINDOW_MS);
	recent.push(now);
	loginBuckets.set(key, recent);
};

const clearFailedLogins = (key: string) => {
	loginBuckets.delete(key);
};

const isLoginLimited = (key: string) => {
	const now = Date.now();
	const recent = (loginBuckets.get(key) ?? []).filter((ts) => now - ts < LOGIN_WINDOW_MS);
	loginBuckets.set(key, recent);
	return recent.length >= MAX_LOGIN_ATTEMPTS;
};

export const GET: APIRoute = async ({ request }) => {
	return new Response(JSON.stringify({ ok: true, authorized: isCmsSessionAuthorized(request) }), {
		status: 200,
		headers: jsonHeaders,
	});
};

export const POST: APIRoute = async ({ request, clientAddress }) => {
	const key = clientKey(request, clientAddress);
	if (isLoginLimited(key)) {
		return new Response(JSON.stringify({ ok: false, error: 'rate_limited' }), {
			status: 429,
			headers: jsonHeaders,
		});
	}

	let payload: Record<string, unknown>;
	try {
		payload = (await request.json()) as Record<string, unknown>;
	} catch {
		return new Response(JSON.stringify({ ok: false, error: 'invalid_json' }), {
			status: 400,
			headers: jsonHeaders,
		});
	}

	const token = typeof payload.token === 'string' ? payload.token.trim() : '';
	const username = typeof payload.username === 'string' ? payload.username.trim() : '';
	const password = typeof payload.password === 'string' ? payload.password.trim() : '';
	const isAuthorized = token ? isCmsTokenValid(token) : isCmsCredentialsValid(username, password);

	if (!isAuthorized) {
		recordFailedLogin(key);
		return new Response(JSON.stringify({ ok: false, error: 'unauthorized' }), {
			status: 401,
			headers: jsonHeaders,
		});
	}

	const setCookie = createCmsSessionSetCookie(request);
	if (!setCookie) {
		return new Response(JSON.stringify({ ok: false, error: 'session_not_configured' }), {
			status: 500,
			headers: jsonHeaders,
		});
	}

	clearFailedLogins(key);

	return new Response(JSON.stringify({ ok: true }), {
		status: 200,
		headers: {
			...jsonHeaders,
			'Set-Cookie': setCookie,
		},
	});
};

export const DELETE: APIRoute = async ({ request }) => {
	try {
		revokeCmsSession(request);
	} catch {
		return new Response(JSON.stringify({ ok: false, error: 'session_revoke_failed' }), {
			status: 500,
			headers: jsonHeaders,
		});
	}

	return new Response(JSON.stringify({ ok: true }), {
		status: 200,
		headers: {
			...jsonHeaders,
			'Set-Cookie': clearCmsSessionSetCookie(),
		},
	});
};
