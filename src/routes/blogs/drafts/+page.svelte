<script lang="ts">
	import { goto } from "$app/navigation";
	import { subscribeToAuth } from "$lib/firebase/auth";
	import { getPosts, type BlogPost } from "$lib/firebase/firestore.svelte";

	let user = $state<import("firebase/auth").User | null>(null);
	let authReady = $state(false);
	let posts = $state<BlogPost[]>([]);
	let loading = $state(true);

	$effect(() => {
		const unsub = subscribeToAuth((u) => {
			user = u;
			authReady = true;
			if (!u) goto("/admin/login/");
		});
		return unsub;
	});

	$effect(() => {
		if (!authReady || !user) return;
		getPosts().then((all) => {
			posts = all.filter((p) => p.status === "draft");
			loading = false;
		});
	});

	function formatDate(d: Date | null) {
		if (!d) return "";
		return d.toLocaleDateString("en-US", {
			year: "numeric",
			month: "long",
			day: "numeric",
		});
	}
</script>

<svelte:head>
	<title>Drafts · Mikas James</title>
	<meta name="robots" content="noindex, nofollow" />
</svelte:head>

<div class="min-h-screen bg-[#09090b] pt-28 pb-20 px-4">
	<div
		class="fixed inset-0 bg-[linear-gradient(rgba(99,102,241,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(99,102,241,0.03)_1px,transparent_1px)] bg-[size:64px_64px] pointer-events-none"
	></div>

	<div class="relative mx-auto max-w-3xl">
		<div class="flex items-center justify-between mb-10">
			<a
				href="/admin/"
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
				Back
			</a>
			<a
				href="/admin/"
				class="rounded-lg border border-zinc-700/60 px-3 py-2 text-center text-sm font-medium text-zinc-400 transition-all duration-200 hover:border-zinc-600 hover:text-zinc-200"
			>
				Dashboard
			</a>
		</div>

		<div class="mb-14">
			<p
				class="font-mono text-xs text-accent-400 tracking-widest uppercase mb-3"
			>
				&gt;_ admin
			</p>
			<h1 class="text-4xl md:text-5xl font-bold text-zinc-100 leading-tight">
				Drafts
			</h1>
			<p class="mt-4 text-zinc-400 text-lg leading-relaxed max-w-xl">
				Unpublished blog posts — only visible to you.
			</p>
			<div class="mt-6 h-px w-16 bg-accent-500/50 rounded-full"></div>
		</div>

		{#if loading}
			<div
				class="flex items-center justify-center py-20 text-zinc-500 text-sm"
			>
				<div
					class="w-5 h-5 border-2 border-zinc-700/60 border-t-zinc-400 rounded-full animate-spin mr-3"
				></div>
				Loading drafts…
			</div>
		{:else if posts.length === 0}
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
				<p class="text-zinc-500 text-sm">No drafts yet.</p>
			</div>
		{:else}
			<div class="space-y-5">
				{#each posts as post (post.id)}
					<a
						href="/blogs/drafts/{post.slug}/"
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
									<span
										class="px-1.5 py-0.5 rounded bg-zinc-800 text-[10px] font-medium text-zinc-450 border border-zinc-700/50 uppercase tracking-wider font-mono"
									>
										Draft
									</span>
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
									View draft
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
