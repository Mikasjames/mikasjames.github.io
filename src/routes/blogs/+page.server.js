import { getPosts } from '$lib/firebase/firestore.svelte';

export const prerender = true;

export async function load() {
  const posts = await getPosts();
  return {
    posts
  };
}
