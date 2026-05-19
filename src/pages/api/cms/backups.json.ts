import type { APIRoute } from 'astro';

import { isCmsAuthorized } from '../../../lib/cms/auth';
import { createBackup, listBackups } from '../../../lib/cms/backup-service';

export const prerender = false;

const jsonHeaders = {
	'Content-Type': 'application/json; charset=utf-8',
	'Cache-Control': 'no-store, max-age=0',
};

const unauthorized = () =>
	new Response(JSON.stringify({ error: 'unauthorized' }), {
		status: 401,
		headers: jsonHeaders,
	});

export const GET: APIRoute = async ({ request }) => {
	if (!isCmsAuthorized(request)) return unauthorized();

	try {
		const backups = await listBackups();
		return new Response(JSON.stringify({ ok: true, backups }), {
			status: 200,
			headers: jsonHeaders,
		});
	} catch {
		return new Response(JSON.stringify({ error: 'backups_read_failed' }), {
			status: 500,
			headers: jsonHeaders,
		});
	}
};

export const POST: APIRoute = async ({ request }) => {
	if (!isCmsAuthorized(request)) return unauthorized();

	let note = 'manual';
	try {
		const payload = (await request.json().catch(() => ({}))) as Record<string, unknown>;
		if (typeof payload.note === 'string' && payload.note.trim()) {
			note = payload.note.trim().slice(0, 120);
		}
	} catch {
		note = 'manual';
	}

	try {
		const backup = await createBackup(note);
		return new Response(JSON.stringify({ ok: true, backup }), {
			status: 201,
			headers: jsonHeaders,
		});
	} catch {
		return new Response(JSON.stringify({ error: 'backup_create_failed' }), {
			status: 500,
			headers: jsonHeaders,
		});
	}
};
