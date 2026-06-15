import { getPrerenderPosts, getPostBySlug } from '$lib/firebase/firestore.svelte';
import { error } from '@sveltejs/kit';

export const prerender = true;

export async function entries() {
  const posts = await getPrerenderPosts();
  return posts.map(post => ({
    slug: post.slug
  }));
}

/** @type {import('./$types').PageServerLoad} */
export async function load({ params }) {
  const post = await getPostBySlug(params.slug);

  if (!post || post.status === 'draft') {
    throw error(404, 'Post not found');
  }

  return {
    post
  };
}
