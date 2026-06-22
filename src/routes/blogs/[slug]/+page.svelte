<script lang="ts">
	import type { BlogPost } from "$lib/firebase/firestore.svelte";
	import BlogPostContent from "$lib/components/BlogPostContent.svelte";

	let { data } = $props();
	let post = $derived(data.post as BlogPost);
</script>

<svelte:head>
	<title>{post ? `${post.title} · Mikas James` : "Blog · Mikas James"}</title>
	{#if post}
		<meta name="description" content={post.excerpt} />
		{#if post.status === "unlisted"}
			<meta name="robots" content="noindex, nofollow" />
		{:else}
			<link
				rel="canonical"
				href={`https://mikasjames.com/blogs/${post.slug}`}
			/>
		{/if}
	{/if}
</svelte:head>

<div class="min-h-screen bg-[#09090b] pt-28 pb-24 px-4">
	<div
		class="fixed inset-0 bg-[linear-gradient(rgba(99,102,241,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(99,102,241,0.03)_1px,transparent_1px)] bg-[size:64px_64px] pointer-events-none"
	></div>

	<div class="relative mx-auto max-w-2xl">
		{#if post}
			<BlogPostContent {post} />
		{/if}
	</div>
</div>
