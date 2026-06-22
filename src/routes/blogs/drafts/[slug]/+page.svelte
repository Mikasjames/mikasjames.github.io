<script lang="ts">
	import { page } from "$app/stores";
	import { goto } from "$app/navigation";
	import { subscribeToAuth } from "$lib/firebase/auth";
	import { getPostBySlug, type BlogPost } from "$lib/firebase/firestore.svelte";
	import BlogPostContent from "$lib/components/BlogPostContent.svelte";

	let user = $state<import("firebase/auth").User | null>(null);
	let authReady = $state(false);
	let post = $state<BlogPost | null>(null);
	let loading = $state(true);
	let notFound = $state(false);

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
		const slug = $page.params.slug;
		if (!slug) { notFound = true; loading = false; return; }
		getPostBySlug(slug).then((fetched) => {
			if (fetched) {
				post = fetched;
			} else {
				notFound = true;
			}
			loading = false;
		});
	});
</script>

<svelte:head>
	<title>{post ? `${post.title} · Mikas James` : "Draft · Mikas James"}</title>
	<meta name="robots" content="noindex, nofollow" />
</svelte:head>

<div class="min-h-screen bg-[#09090b] pt-28 pb-24 px-4">
	<div
		class="fixed inset-0 bg-[linear-gradient(rgba(99,102,241,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(99,102,241,0.03)_1px,transparent_1px)] bg-[size:64px_64px] pointer-events-none"
	></div>

	<div class="relative mx-auto max-w-2xl">
		{#if !authReady || loading}
			<div
				class="flex items-center justify-center py-20 text-zinc-500 text-sm"
			>
				<div
					class="w-5 h-5 border-2 border-zinc-700/60 border-t-zinc-400 rounded-full animate-spin mr-3"
				></div>
				Loading post…
			</div>
		{:else if post}
			<BlogPostContent {post} backHref="/admin/" />
		{:else if notFound}
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
				<p class="text-zinc-500 text-sm">Post not found.</p>
			</div>
		{/if}
	</div>
</div>
