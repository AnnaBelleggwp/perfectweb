import type { APIRoute } from 'astro';
import { appendFileSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

export const prerender = false;

const STORAGE_PATH = join(process.cwd(), 'storage', 'reviews.jsonl');

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

const sanitize = (val: unknown, max: number): string => {
	if (typeof val !== 'string') return '';
	return val.trim().slice(0, max);
};

export const GET: APIRoute = async () => {
	if (!existsSync(STORAGE_PATH)) {
		return new Response(JSON.stringify([]), { headers: jsonHeaders });
	}
	const lines = readFileSync(STORAGE_PATH, 'utf-8').split('\n').filter(Boolean);
	const reviews = lines
		.map((line) => { try { return JSON.parse(line); } catch { return null; } })
		.filter((r) => r && r.approved);
	return new Response(JSON.stringify(reviews), { headers: jsonHeaders });
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

	const name = sanitize(payload.name, 80);
	const role = sanitize(payload.role, 100);
	const message = sanitize(payload.message, 1200);
	const project = sanitize(payload.project, 120);
	const stars = Math.min(5, Math.max(1, Number(payload.stars) || 5));

	if (!name || !message) {
		return new Response(
			JSON.stringify({ ok: false, error: 'Имя и отзыв обязательны' }),
			{ status: 400, headers: jsonHeaders },
		);
	}

	const review = {
		id: crypto.randomUUID(),
		name,
		role,
		message,
		project,
		stars,
		approved: false,
		createdAt: new Date().toISOString(),
		ip: clientAddress,
	};

	appendFileSync(STORAGE_PATH, JSON.stringify(review) + '\n', 'utf-8');

	return new Response(
		JSON.stringify({ ok: true }),
		{ status: 201, headers: jsonHeaders },
	);
};
