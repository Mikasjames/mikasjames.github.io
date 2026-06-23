import { SITE_URL } from '$lib/site';

export const prerender = true;

export function GET(): Response {
	const body = `User-agent: *
Disallow: /admin/
Disallow: /journal/

Sitemap: ${SITE_URL}/sitemap.xml
`;

	return new Response(body, {
		headers: {
			'Content-Type': 'text/plain'
		}
	});
}
