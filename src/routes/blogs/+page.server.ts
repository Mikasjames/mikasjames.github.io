import { getPublishedPosts } from '$lib/firebase/firestore.svelte';
import type { BlogPost } from '$lib/firebase/firestore.svelte';

export const prerender = true;

export async function load(): Promise<{ posts: BlogPost[] }> {
	const posts = await getPublishedPosts();
	return { posts };
}
