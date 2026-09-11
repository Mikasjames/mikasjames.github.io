<script lang="ts">
	import { onMount } from "svelte";
	import { goto } from "$app/navigation";
	import { fly, slide } from "svelte/transition";
	import { onAdminSession } from "$lib/utils/admin-session";
	import type { User } from "firebase/auth";

	let { mobileMode = false }: { mobileMode?: boolean } = $props();

	let user = $state<User | null>(null);
	let authReady = $state(false);
	let isOpen = $state(false);
	let containerRef = $state<HTMLDivElement>();

	onMount(() => {
		const authCleanup = onAdminSession((u) => {
			user = u;
			authReady = true;
		});

		function handleClickOutside(e: MouseEvent) {
			if (containerRef && !containerRef.contains(e.target as Node)) {
				isOpen = false;
			}
		}

		document.addEventListener("click", handleClickOutside);
		return () => {
			authCleanup?.();
			document.removeEventListener("click", handleClickOutside);
		};
	});

	async function handleLogout() {
		const { logout } = await import("$lib/firebase/auth");
		await logout();
		user = null;
		isOpen = false;
		goto("/");
	}
</script>

{#if !mobileMode}
	<!-- Desktop Dropdown -->
	{#if authReady && user}
		<div class="relative inline-block" bind:this={containerRef}>
			<button
				class="flex items-center gap-1.5 rounded-lg border border-accent-500/20 bg-accent-500/10 px-3 py-1.5 text-xs font-medium text-accent-400 transition-all hover:border-accent-500/40 hover:bg-accent-500/20"
				onclick={() => (isOpen = !isOpen)}
				aria-expanded={isOpen}
			>
				<svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
				</svg>
				Admin
				<svg class="h-3.5 w-3.5 transition-transform duration-200 {isOpen ? 'rotate-180' : ''}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
				</svg>
			</button>

			{#if isOpen}
				<div transition:fly={{ y: -6, duration: 150 }} class="absolute right-0 top-full z-50 mt-2 min-w-[170px] rounded-xl border border-zinc-800 bg-zinc-950/95 p-1.5 shadow-xl shadow-black/50 backdrop-blur-md">
					<a href="/admin/" class="block rounded-lg px-3 py-1.5 text-xs text-zinc-300 transition-colors hover:bg-zinc-800/60 hover:text-zinc-100">Dashboard</a>
					<a href="/blogs/drafts/" class="block rounded-lg px-3 py-1.5 text-xs text-zinc-300 transition-colors hover:bg-zinc-800/60 hover:text-zinc-100">Drafts</a>
					<a href="/blogs/" class="block rounded-lg px-3 py-1.5 text-xs text-zinc-300 transition-colors hover:bg-zinc-800/60 hover:text-zinc-100">Blog</a>
					<a href="/journal/" class="block rounded-lg px-3 py-1.5 text-xs text-zinc-300 transition-colors hover:bg-zinc-800/60 hover:text-zinc-100">Journal</a>
					<a href="/habits/" class="block rounded-lg px-3 py-1.5 text-xs text-zinc-300 transition-colors hover:bg-zinc-800/60 hover:text-zinc-100">Habits</a>
					<hr class="my-1 border-zinc-800/60" />
					<button onclick={handleLogout} class="w-full rounded-lg px-3 py-1.5 text-left text-xs text-red-400 transition-colors hover:bg-red-500/10 hover:text-red-300">
						Sign Out
					</button>
				</div>
			{/if}
		</div>
	{:else}
		<!-- Unauthenticated: Show "Get in touch" button -->
		<a href="mailto:mikasjames@gmail.com" class="hidden md:inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-accent-500/40 text-accent-400 text-sm font-medium hover:bg-accent-500/10 hover:border-accent-400 transition-all duration-200">
			<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
			</svg>
			Get in touch
		</a>
	{/if}
{:else}
	<!-- Mobile Drawer Menu Section -->
	{#if authReady && user}
		<div transition:slide={{ duration: 150 }} class="pt-2">
			<span class="mb-2 block font-mono text-[10px] uppercase tracking-wider text-accent-400">Admin Controls</span>
			<div class="flex flex-col gap-1">
				<a href="/admin/" class="block rounded-lg px-3 py-2 text-sm text-zinc-300 transition-colors hover:bg-zinc-800/50 hover:text-zinc-100">Dashboard</a>
				<a href="/blogs/drafts/" class="block rounded-lg px-3 py-2 text-sm text-zinc-300 transition-colors hover:bg-zinc-800/50 hover:text-zinc-100">Drafts</a>
				<a href="/blogs/" class="block rounded-lg px-3 py-2 text-sm text-zinc-300 transition-colors hover:bg-zinc-800/50 hover:text-zinc-100">Blog</a>
				<a href="/journal/" class="block rounded-lg px-3 py-2 text-sm text-zinc-300 transition-colors hover:bg-zinc-800/50 hover:text-zinc-100">Journal</a>
				<a href="/habits/" class="block rounded-lg px-3 py-2 text-sm text-zinc-300 transition-colors hover:bg-zinc-800/50 hover:text-zinc-100">Habits</a>
				<button onclick={handleLogout} class="w-full rounded-lg px-3 py-2 text-left text-sm text-red-400 transition-colors hover:bg-red-500/10 hover:text-red-300">
					Sign Out
				</button>
			</div>
		</div>
	{:else}
		<!-- Unauthenticated mobile: nothing extra needed, email link already exists in mobile menu -->
	{/if}
{/if}