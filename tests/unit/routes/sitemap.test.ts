import { describe, expect, it, vi } from 'vitest';

const firestore = vi.hoisted(() => ({
	getPublishedPosts: vi.fn(),
	getPrerenderPosts: vi.fn(),
	getPostBySlug: vi.fn(),
}));

vi.mock('../../../src/lib/firebase/firestore.svelte', () => firestore);

describe('sitemap.xml GET', () => {
	it('emits static entries plus per-post urls with date lastmods', async () => {
		const { GET } = await import('../../../src/routes/sitemap.xml/+server.js');
		firestore.getPublishedPosts.mockResolvedValue([
			{ slug: 'hello-world', createdAt: new Date(Date.UTC(2026, 6, 15)) },
			{ slug: 'tricky&<slug>', createdAt: null },
		]);

		const res = await GET();
		const body = await res.text();

		expect(res.headers.get('Content-Type')).toBe('application/xml');
		expect(body).toContain('<?xml version="1.0" encoding="UTF-8"?>');
		expect(body).toContain('<loc>https://test.local/</loc>');
		expect(body).toContain('<loc>https://test.local/blogs/</loc>');
		expect(body).toContain('<loc>https://test.local/blogs/hello-world/</loc>');
		expect(body).toContain('<lastmod>2026-07-15</lastmod>');
	});

	it('escapes XML-significant characters in slugs and drops empty lastmods', async () => {
		const { GET } = await import('../../../src/routes/sitemap.xml/+server.js');
		firestore.getPublishedPosts.mockResolvedValue([
			{ slug: 'tricky&<slug>', createdAt: null },
		]);

		const body = await (await GET()).text();
		expect(body).toContain(
			'<loc>https://test.local/blogs/tricky&amp;&lt;slug&gt;/</loc>',
		);
		expect(body).not.toContain('<lastmod>');
	});
});
