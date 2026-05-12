import type { APIRoute } from 'astro';

import { isCmsAuthorized } from '../../../../lib/cms/auth';
import { uploadMediaAsset } from '../../../../lib/cms/media-service';

export const prerender = false;

const jsonHeaders = {
	'Content-Type': 'application/json; charset=utf-8',
	'Cache-Control': 'no-store, max-age=0',
};

export const POST: APIRoute = async ({ request }) => {
	if (!isCmsAuthorized(request)) {
		return new Response(JSON.stringify({ error: 'unauthorized' }), {
			status: 401,
			headers: jsonHeaders,
		});
	}

	let formData: FormData;
	try {
		formData = await request.formData();
	} catch {
		return new Response(JSON.stringify({ error: 'invalid_form_data' }), {
			status: 400,
			headers: jsonHeaders,
		});
	}

	const fileField = formData.get('file');
	if (!(fileField instanceof File)) {
		return new Response(JSON.stringify({ error: 'file_required' }), {
			status: 400,
			headers: jsonHeaders,
		});
	}

	try {
		const media = await uploadMediaAsset(fileField);
		return new Response(JSON.stringify(media), {
			status: 200,
			headers: jsonHeaders,
		});
	} catch (error) {
		const message = error instanceof Error ? error.message : 'media_upload_failed';
		return new Response(JSON.stringify({ error: message }), {
			status: 400,
			headers: jsonHeaders,
		});
	}
};
