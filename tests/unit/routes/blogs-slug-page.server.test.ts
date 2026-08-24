import { describe, expect, it, vi } from 'vitest';

const firestore = vi.hoisted(() => ({
	getPrerenderPosts: vi.fn(),
	getPostBySlug: vi.fn(),
}));

vi.mock('../../../src/lib/firebase/firestore.svelte', () => firestore);

import { entries, load } from '../../../src/routes/blogs/[slug]/+page.server.js';

describe('blogs/[slug] entries', () => {
	it('maps prerender posts to slug params', async () => {
		firestore.getPrerenderPosts.mockResolvedValue([
			{ slug: 'a' },
			{ slug: 'b' },
		]);
		await expect(entries()).resolves.toEqual([{ slug: 'a' }, { slug: 'b' }]);
	});
});

describe('blogs/[slug] load', () => {
	it('returns the post when it exists and is not a draft', async () => {
		const post = { slug: 'published-post', status: 'published' };
		firestore.getPostBySlug.mockResolvedValue(post);

		await expect(load({ params: { slug: 'published-post' } })).resolves.toEqual({ post });
	});

	it('throws a 404 kit error for unknown slugs', async () => {
		firestore.getPostBySlug.mockResolvedValue(null);
		await expect(load({ params: { slug: 'ghost' } })).rejects.toMatchObject({
			status: 404,
		});
	});

	it('throws a 404 kit error for draft posts (draft-leak prevention)', async () => {
		firestore.getPostBySlug.mockResolvedValue({ slug: 'secret', status: 'draft' });
		await expect(load({ params: { slug: 'secret' } })).rejects.toMatchObject({
			status: 404,
			body: { message: 'Post not found' },
		});
	});
});
