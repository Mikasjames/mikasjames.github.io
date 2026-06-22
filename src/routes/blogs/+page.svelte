<script lang="ts">
	import { page } from "$app/stores";
	import type { BlogPost } from "$lib/firebase/firestore.svelte";

	let { data } = $props();
	let posts = $derived(data.posts ?? []);

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
	<title>Blog · Mikas James</title>
	<meta name="description" content="Some stuff that came to mind." />
	<link rel="canonical" href="https://mikasjames.com/blogs" />
	<meta property="og:title" content="Blog · Mikas James" />
	<meta property="og:description" content="Some stuff that came to mind." />
	<meta property="og:url" content="https://mikasjames.com/blogs" />
	<meta property="og:image" content="https://mikasjames.com/og-default.png" />
	<meta name="twitter:title" content="Blog · Mikas James" />
	<meta name="twitter:description" content="Some stuff that came to mind." />
</svelte:head>

<div class="min-h-screen bg-[#09090b] pt-28 pb-20 px-4">
	<div
		class="fixed inset-0 bg-[linear-gradient(rgba(99,102,241,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(99,102,241,0.03)_1px,transparent_1px)] bg-[size:64px_64px] pointer-events-none"
	></div>

	<div class="relative mx-auto max-w-3xl">
		<div class="mb-14">
			<p
				class="font-mono text-xs text-accent-400 tracking-widest uppercase mb-3"
			>
				&gt;_ writing
			</p>
			<h1
				class="text-4xl md:text-5xl font-bold text-zinc-100 leading-tight"
			>
				Blog
			</h1>
			<p class="mt-4 text-zinc-400 text-lg leading-relaxed max-w-xl">
				Some stuff that came to mind.
			</p>
			<div class="mt-6 h-px w-16 bg-accent-500/50 rounded-full"></div>
		</div>

		{#if posts.length === 0}
			<div class="text-center py-20">
				<div
					class="w-12 h-12 rounded-xl bg-surface-800 border border-zinc-800 flex items-center justify-center mx-auto mb-4"
				>
					<svg
						class="w-6 h-6 text-zinc-600"
						fill="none"
						stroke="currentColor"
						viewBox="0 0 24 24"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
						/>
					</svg>
				</div>
				<p class="text-zinc-500 text-sm">
					No posts yet — check back soon.
				</p>
			</div>
		{:else}
			<div class="space-y-5">
				{#each posts as post (post.id)}
					<a
						href="/blogs/{post.slug}/"
						class="block group rounded-xl bg-surface-900/60 border border-zinc-800/40 hover:border-accent-500/30 hover:bg-surface-900/90 p-6 transition-all duration-300 hover:shadow-lg hover:shadow-accent-600/5"
					>
						<div class="flex flex-col md:flex-row gap-5">
							{#if post.coverImage}
								<div
									class="w-full md:w-44 h-28 shrink-0 overflow-hidden rounded-lg bg-zinc-950 border border-zinc-800/80"
								>
									<img
										src={post.coverImage}
										fetchpriority="high"
										alt=""
										class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
									/>
								</div>
							{/if}

							<div class="flex-1 min-w-0">
								<div class="flex items-center gap-3 mb-2.5">
									{#if post.createdAt}
										<time
											class="text-xs text-zinc-550 font-mono"
											>{formatDate(post.createdAt)}</time
										>
										<span
											class="w-1 h-1 rounded-full bg-zinc-800"
										></span>
									{/if}
									<span class="text-xs text-zinc-550"
										>{readingTime(post.content)}</span
									>
								</div>

								<h2
									class="text-lg font-semibold text-zinc-100 group-hover:text-accent-300 transition-colors duration-200 leading-snug mb-2"
								>
									{post.title}
								</h2>

								<p
									class="text-sm text-zinc-400 leading-relaxed line-clamp-2"
								>
									{post.excerpt}
								</p>

								<div
									class="mt-4 flex items-center gap-1.5 text-xs font-medium text-accent-400 group-hover:text-accent-300 transition-colors duration-200"
								>
									Read post
									<svg
										class="w-3.5 h-3.5 translate-x-0 group-hover:translate-x-1 transition-transform duration-200"
										fill="none"
										stroke="currentColor"
										viewBox="0 0 24 24"
									>
										<path
											stroke-linecap="round"
											stroke-linejoin="round"
											stroke-width="2"
											d="M17 8l4 4m0 0l-4 4m4-4H3"
										/>
									</svg>
								</div>
							</div>
						</div>
					</a>
				{/each}
			</div>
		{/if}
	</div>
</div>
