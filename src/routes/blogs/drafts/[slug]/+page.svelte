<script lang="ts">
	import { onMount } from "svelte";
	import { page } from "$app/stores";
	import { goto } from "$app/navigation";
	import { getDraftBySlug, type BlogPost } from "$lib/firebase/firestore.svelte";
	import BlogPostContent from "$lib/components/BlogPostContent.svelte";
	import GridBackground from "$lib/components/GridBackground.svelte";
	import Spinner from "$lib/components/Spinner.svelte";
	import { onAdminSession } from "$lib/utils/admin-session";

	let post = $state<BlogPost | null>(null);
	let loading = $state(true);
	let notFound = $state(false);
	let authReady = $state(false);
	let slug = $state<string | undefined>();

	onMount(() => {
		const unsubscribe = page.subscribe(($page) => {
			slug = $page.params.slug;
		});
		if (!localStorage.getItem("mj_admin_session")) {
			goto("/admin/login/");
			return unsubscribe;
		}

		const cleanup = onAdminSession(async (user) => {
			authReady = true;
			try {
				if (!slug) {
					notFound = true;
					loading = false;
					return;
				}
				const fetched = await getDraftBySlug(slug);
				if (fetched) {
					post = fetched;
				} else {
					notFound = true;
				}
			} catch {
				notFound = true;
			} finally {
				loading = false;
			}
		});

		return cleanup;
	});
</script>

<svelte:head>
	<title>{post ? `${post.title} · Mikas James` : "Draft · Mikas James"}</title>
	<meta name="robots" content="noindex, nofollow" />
</svelte:head>

<div class="min-h-screen bg-[#09090b] pt-28 pb-24 px-4">
	<GridBackground opacity="3" />

	<div class="relative mx-auto max-w-2xl">
		{#if !authReady || loading}
			<div class="flex items-center justify-center py-20 gap-3 text-zinc-500 text-sm">
				<Spinner size="md" color="zinc" />
				Loading post…
			</div>
		{:else if post}
			<BlogPostContent {post} postId={post.id} backHref="/blogs/drafts/" backLabel="All Drafts" />
		{:else if notFound}
			<div class="text-center py-20">
				<div class="w-12 h-12 rounded-xl bg-surface-800 border border-zinc-800 flex items-center justify-center mx-auto mb-4">
					<svg class="w-6 h-6 text-zinc-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
					</svg>
				</div>
				<p class="text-zinc-500 text-sm">Draft not found.</p>
			</div>
		{/if}
	</div>
</div>