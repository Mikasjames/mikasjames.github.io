import { getPublishedPosts } from '$lib/firebase/firestore.svelte';

export const prerender = true;

export async function load() {
  const posts = await getPublishedPosts();
  return {
    posts
  };
}
