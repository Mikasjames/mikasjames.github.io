<script lang="ts">
	import { onMount } from "svelte";
	import type { BlogPost } from "$lib/firebase/firestore.svelte";
	import { renderMarkdown } from "$lib/utils/renderMarkdown";
	import { formatDateLong, readingTime } from "$lib/utils/date";
	import { onAdminSession } from "$lib/utils/admin-session";

	let { post, backHref = "/blogs/", postId, backLabel }: { post: BlogPost; backHref?: string; postId?: string; backLabel?: string } =
		$props();

	let showEdit = $state(false);

	onMount(() => {
		if (!postId) return;
		return onAdminSession(() => {
			showEdit = true;
		});
	});
</script>

<a
	href={backHref}
	class="inline-flex items-center gap-1.5 text-sm text-zinc-400 hover:text-zinc-300 transition-colors duration-200 mb-10 group"
>
	<svg
		class="w-4 h-4 group-hover:-translate-x-0.5 transition-transform duration-200"
		fill="none"
		stroke="currentColor"
		viewBox="0 0 24 24"
	>
		<path
			stroke-linecap="round"
			stroke-linejoin="round"
			stroke-width="2"
			d="M7 16l-4-4m0 0l4-4m-4 4h18"
		/>
	</svg>
	{backLabel || (backHref === "/admin/" ? "Back" : "All posts")}
</a>

<header class="mb-10">
	{#if post.coverImage}
		<div
			class="w-full aspect-video mb-8 overflow-hidden rounded-xl bg-zinc-950 border border-zinc-800/80 shadow-lg"
		>
			<img
				src={post.coverImage}
				alt={post.title}
				width="1280"
				height="720"
				loading="eager"
				fetchpriority="high"
				class="w-full h-full object-cover"
			/>
		</div>
	{/if}

	<div class="flex items-center gap-3 mb-5">
		{#if post.createdAt}
			<time class="text-xs text-zinc-650 font-mono"
				>{formatDateLong(post.createdAt)}</time
			>
			<span class="w-1 h-1 rounded-full bg-zinc-800"></span>
		{/if}
		<span class="text-xs text-zinc-650">{readingTime(post.content)}</span>
		{#if showEdit}
			<span class="w-1 h-1 rounded-full bg-zinc-800"></span>
			<a
				href="/admin/?edit={postId}"
				class="inline-flex items-center gap-1 font-mono text-xs text-accent-400 hover:text-accent-300 transition-colors"
			>
				<svg class="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
				</svg>
				Edit
			</a>
		{/if}
	</div>

	<h1 class="text-3xl md:text-4xl font-bold text-zinc-100 leading-tight mb-5">
		{post.title}
	</h1>

	<p class="text-zinc-450 text-lg leading-relaxed">
		{post.excerpt}
	</p>

	<div
		class="mt-8 h-px bg-gradient-to-r from-accent-500/30 via-zinc-700/50 to-transparent"
	></div>
</header>

<article class="prose-custom text-zinc-400 leading-relaxed text-[0.96rem]">
	<!-- eslint-disable-next-line svelte/no-at-html-tags -->
	{@html renderMarkdown(post.content, post.imageMeta)}
</article>

<div
	class="mt-16 pt-8 border-t border-zinc-800/60 flex items-center justify-between"
>
	<a
		href={backHref}
		class="inline-flex items-center gap-1.5 text-sm text-zinc-400 hover:text-zinc-300 transition-colors duration-200 group"
	>
		<svg
			class="w-4 h-4 group-hover:-translate-x-0.5 transition-transform duration-200"
			fill="none"
			stroke="currentColor"
			viewBox="0 0 24 24"
		>
			<path
				stroke-linecap="round"
				stroke-linejoin="round"
				stroke-width="2"
				d="M7 16l-4-4m0 0l4-4m-4 4h18"
			/>
		</svg>
		{backLabel || (backHref === "/admin/" ? "Back" : "All posts")}
	</a>
	<span class="font-mono text-xs text-zinc-700"
		>/{post.status === "draft" ? "drafts" : "blogs"}/{post.slug}</span
	>
</div>
