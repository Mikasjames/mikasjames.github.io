import { getPrerenderPosts, getPostBySlug } from '$lib/firebase/firestore.svelte';
import type { BlogPost } from '$lib/firebase/firestore.svelte';
import { error } from '@sveltejs/kit';

export const prerender = true;

export async function entries(): Promise<Array<{ slug: string }>> {
	const posts = await getPrerenderPosts();
	return posts.map((post: BlogPost) => ({
		slug: post.slug
	}));
}

export async function load({ params }: { params: Record<string, string> }) {
	const post = await getPostBySlug(params.slug);

	if (!post || post.status === 'draft') {
		throw error(404, 'Post not found');
	}

	return { post };
}
