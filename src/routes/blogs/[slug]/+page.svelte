<script lang="ts">
	import { marked } from "marked";
	import type { BlogPost } from "$lib/firebase/firestore.svelte";

	let { data } = $props();
	let post = $derived(data.post);

	function renderMarkdown(md: string): string {
		if (!md) return "";

		const renderer = {
			image(token: { href: string; title: string | null; text: string }) {
				return `<img src="${token.href}" alt="${token.text}" loading="lazy" style="max-width: 100%; height: auto;" />`;
			}
		};

		marked.use({ renderer });
		return marked.parse(md, { async: false }) as string;
	}

	function formatDate(d: Date | null) {
		if (!d) return "";
		return d.toLocaleDateString("en-US", {
			year: "numeric",
			month: "long",
			day: "numeric",
		});
	}

	function readingTime(content: string) {
		const words = content.trim().split(/\s+/).length;
		const mins = Math.max(1, Math.round(words / 200));
		return `${mins} min read`;
	}
</script>

<svelte:head>
	<title>{post ? `${post.title} · Mikas James` : "Blog · Mikas James"}</title>
	{#if post}
		<meta name="description" content={post.excerpt} />
	{/if}
</svelte:head>

<div class="min-h-screen bg-[#09090b] pt-28 pb-24 px-4">
	<div
		class="fixed inset-0 bg-[linear-gradient(rgba(99,102,241,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(99,102,241,0.03)_1px,transparent_1px)] bg-[size:64px_64px] pointer-events-none"
	></div>

	<div class="relative mx-auto max-w-2xl">
		<a
			href="/blogs/"
			class="inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-300 transition-colors duration-200 mb-10 group"
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
			All posts
		</a>

		{#if post}
			<header class="mb-10">
				{#if post.coverImage}
					<div class="w-full aspect-video mb-8 overflow-hidden rounded-xl bg-zinc-950 border border-zinc-800/80 shadow-lg">
						<img
							src={post.coverImage}
							alt={post.title}
							width="1280"
							height="720"
							loading="eager"
							class="w-full h-full object-cover"
						/>
					</div>
				{/if}

				<div class="flex items-center gap-3 mb-5">
					{#if post.createdAt}
						<time class="text-xs text-zinc-650 font-mono"
							>{formatDate(post.createdAt)}</time
						>
						<span class="w-1 h-1 rounded-full bg-zinc-800"></span>
					{/if}
					<span class="text-xs text-zinc-650"
						>{readingTime(post.content)}</span
					>
				</div>

				<h1
					class="text-3xl md:text-4xl font-bold text-zinc-100 leading-tight mb-5"
				>
					{post.title}
				</h1>

				<p class="text-zinc-450 text-lg leading-relaxed">
					{post.excerpt}
				</p>

				<div
					class="mt-8 h-px bg-gradient-to-r from-accent-500/30 via-zinc-700/50 to-transparent"
				></div>
			</header>

			<article
				class="prose-custom text-zinc-400 leading-relaxed text-[0.96rem]"
			>
				<!-- eslint-disable-next-line svelte/no-at-html-tags -->
				{@html renderMarkdown(post.content)}
			</article>

			<div
				class="mt-16 pt-8 border-t border-zinc-800/60 flex items-center justify-between"
			>
				<a
					href="/blogs/"
					class="inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-300 transition-colors duration-200 group"
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
					All posts
				</a>
				<span class="font-mono text-xs text-zinc-700"
					>/blogs/{post.slug}</span
				>
			</div>
		{/if}
	</div>
</div>
