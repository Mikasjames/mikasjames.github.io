<script lang="ts">
	import { page } from '$app/stores';
</script>

<svelte:head>
	<title>Error · Mikas James</title>
</svelte:head>

<div class="min-h-screen bg-[#09090b] flex items-center justify-center px-6 py-20 relative overflow-hidden">
	<div
		class="fixed inset-0 bg-[linear-gradient(to_right,#27272a18_1px,transparent_1px),linear-gradient(to_bottom,#27272a18_1px,transparent_1px)] bg-[size:4rem_4rem] pointer-events-none"
	></div>
	<div
		class="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-accent-500/5 blur-[120px] pointer-events-none"
	></div>

	<div class="relative max-w-2xl mx-auto text-center">
		<div class="mb-8">
			<div class="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-accent-500/10 border border-accent-500/20 mb-6">
				<svg
					class="w-8 h-8 text-accent-400"
					fill="none"
					stroke="currentColor"
					viewBox="0 0 24 24"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M12 9v2m0 4v2m0 4v2m6-4a9 9 0 11-18 0 9 9 0 0118 0z"
					/>
				</svg>
			</div>

			<h1 class="text-6xl md:text-7xl font-bold mb-4">
				<span class="text-zinc-100">{$page.status}</span>
			</h1>

			<div class="h-px w-16 bg-gradient-to-r from-accent-500 to-transparent mx-auto mb-6"></div>

			<p class="text-2xl md:text-3xl font-semibold text-zinc-100 mb-3">
				{$page.error?.message || 'Something went wrong'}
			</p>

			<p class="text-zinc-400 text-lg leading-relaxed max-w-lg mx-auto">
				{#if $page.status === 404}
					The page you're looking for doesn't exist. Let me help you find what you need.
				{:else if $page.status === 500}
					We encountered an unexpected error. Our team has been notified.
				{:else}
					An error occurred while processing your request. Please try again.
				{/if}
			</p>
		</div>

		<div class="flex flex-col sm:flex-row gap-4 justify-center mt-10">
			<a
				href="/blogs/"
				class="inline-flex items-center gap-2.5 px-6 py-3 rounded-lg bg-accent-500/10 border border-accent-500/30 text-accent-400 text-sm font-medium hover:bg-accent-500/20 hover:border-accent-400/50 transition-all duration-200"
			>
				<svg
					class="w-4 h-4"
					fill="none"
					stroke="currentColor"
					viewBox="0 0 24 24"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M10 19l-7-7m0 0l7-7m-7 7h18"
					/>
				</svg>
				Back to Blog
			</a>
			<a
				href="/"
				class="inline-flex items-center gap-2.5 px-6 py-3 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-200 text-sm font-medium hover:bg-zinc-800 hover:border-zinc-700 transition-all duration-200"
			>
				<svg
					class="w-4 h-4"
					fill="none"
					stroke="currentColor"
					viewBox="0 0 24 24"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M3 12a9 9 0 1118 0 9 9 0 01-18 0z"
					/>
				</svg>
				Go Home
			</a>
		</div>

		<p class="mt-16 text-xs text-zinc-600 font-mono">
			error <span class="text-accent-400">/{$page.status}</span>
		</p>
	</div>
</div>
