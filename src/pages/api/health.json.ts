import type { APIRoute } from 'astro';

export const prerender = false;

export const GET: APIRoute = async () => {
	return new Response(
		JSON.stringify({
			ok: true,
			service: 'perfectweb',
			timestamp: new Date().toISOString(),
		}),
		{
			status: 200,
			headers: {
				'Content-Type': 'application/json; charset=utf-8',
				'Cache-Control': 'no-store, max-age=0',
			},
		},
	);
};
