import type { APIRoute } from 'astro';

import { isCmsAuthorized } from '../../../../lib/cms/auth';
import {
	deleteContactSubmission,
	updateContactSubmissionStatus,
	type ContactSubmission,
} from '../../../../lib/contact/submissions-service';

export const prerender = false;

const jsonHeaders = {
	'Content-Type': 'application/json; charset=utf-8',
	'Cache-Control': 'no-store, max-age=0',
};

const validStatuses = new Set<ContactSubmission['status']>(['new', 'read', 'archived']);

export const PATCH: APIRoute = async ({ request, params }) => {
	if (!isCmsAuthorized(request)) {
		return new Response(JSON.stringify({ error: 'unauthorized' }), {
			status: 401,
			headers: jsonHeaders,
		});
	}

	const id = params.id ?? '';
	let payload: Record<string, unknown>;
	try {
		payload = (await request.json()) as Record<string, unknown>;
	} catch {
		return new Response(JSON.stringify({ error: 'invalid_json' }), {
			status: 400,
			headers: jsonHeaders,
		});
	}

	const status = payload.status;
	if (status !== 'new' && status !== 'read' && status !== 'archived') {
		return new Response(JSON.stringify({ error: 'invalid_status' }), {
			status: 400,
			headers: jsonHeaders,
		});
	}
	if (!validStatuses.has(status)) {
		return new Response(JSON.stringify({ error: 'invalid_status' }), {
			status: 400,
			headers: jsonHeaders,
		});
	}

	try {
		const submission = await updateContactSubmissionStatus(id, status);
		if (!submission) {
			return new Response(JSON.stringify({ error: 'not_found' }), {
				status: 404,
				headers: jsonHeaders,
			});
		}
		return new Response(JSON.stringify({ ok: true, submission }), {
			status: 200,
			headers: jsonHeaders,
		});
	} catch {
		return new Response(JSON.stringify({ error: 'contact_submission_update_failed' }), {
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
		const deleted = await deleteContactSubmission(params.id ?? '');
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
		return new Response(JSON.stringify({ error: 'contact_submission_delete_failed' }), {
			status: 500,
			headers: jsonHeaders,
		});
	}
};
