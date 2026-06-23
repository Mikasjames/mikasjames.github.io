<script lang="ts">
	import { onMount } from "svelte";
	import type { BlogPost } from "$lib/firebase/firestore.svelte";
	import BlogPostContent from "$lib/components/BlogPostContent.svelte";
	import { logEvent } from "$lib/firebase/analytics";

	let { data } = $props();
	let post = $derived(data.post as BlogPost);

	onMount(() => {
		logEvent("blog_read", { slug: post.slug, title: post.title });
	});
</script>

<svelte:head>
	<title>{post ? `${post.title} · Mikas James` : "Blog · Mikas James"}</title>
	{#if post}
		<meta name="description" content={post.excerpt} />
		<meta property="og:title" content={post.title} />
		<meta property="og:description" content={post.excerpt} />
		<meta
			property="og:url"
			content="https://mikasjames.com/blogs/{post.slug}"
		/>
		<meta
			property="og:image"
			content={post.coverImage || "https://mikasjames.com/og-default.png"}
		/>
		<meta name="twitter:title" content="{post.title} · Mikas James" />
		<meta name="twitter:description" content={post.excerpt} />
		<meta
			name="twitter:image"
			content={post.coverImage || "https://mikasjames.com/og-default.png"}
		/>
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
