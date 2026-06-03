<script lang="ts">
	import "../app.css";

	let { children } = $props();

	const navLinks = [
		{ href: "#about", label: "About" },
		{ href: "#experience", label: "Experience" },
		{ href: "#skills", label: "Skills" },
		{ href: "#contact", label: "Contact" },
	];

	let mobileOpen = $state(false);
	let scrolled = $state(false);

	function onScroll() {
		scrolled = window.scrollY > 20;
	}

	function toggleMobile() {
		mobileOpen = !mobileOpen;
	}

	function closeMobile() {
		mobileOpen = false;
	}
</script>

<svelte:window onscroll={onScroll} />

<header
	class="fixed top-0 left-0 right-0 z-50 transition-all duration-300 {scrolled
		? 'bg-[#09090b]/90 backdrop-blur-md border-b border-zinc-800/50 shadow-lg shadow-black/20'
		: 'bg-transparent'}"
>
	<nav class="mx-auto max-w-5xl px-6 py-4 flex items-center justify-between">
		<a
			href="#about"
			onclick={closeMobile}
			class="font-mono text-sm font-medium text-zinc-400 hover:text-accent-400 transition-colors duration-200 tracking-widest uppercase"
		>
			<span class="text-accent-400">&gt;_</span> mikas
		</a>

		<ul class="hidden md:flex items-center gap-8">
			{#each navLinks as link}
				<li>
					<a
						href={link.href}
						class="text-sm text-zinc-400 hover:text-zinc-100 transition-colors duration-200 relative group font-medium"
					>
						{link.label}
						<span
							class="absolute -bottom-0.5 left-0 w-0 h-px bg-accent-400 transition-all duration-300 group-hover:w-full"
						></span>
					</a>
				</li>
			{/each}
		</ul>

		<a
			href="mailto:mikasjames@gmail.com"
			class="hidden md:inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-accent-500/40 text-accent-400 text-sm font-medium hover:bg-accent-500/10 hover:border-accent-400 transition-all duration-200"
		>
			<svg
				class="w-3.5 h-3.5"
				fill="none"
				stroke="currentColor"
				viewBox="0 0 24 24"
			>
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
				/>
			</svg>
			Get in touch
		</a>

		<button
			id="mobile-menu-btn"
			onclick={toggleMobile}
			class="md:hidden p-2 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/60 transition-colors duration-200"
			aria-label="Toggle mobile menu"
		>
			{#if mobileOpen}
				<svg
					class="w-5 h-5"
					fill="none"
					stroke="currentColor"
					viewBox="0 0 24 24"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M6 18L18 6M6 6l12 12"
					/>
				</svg>
			{:else}
				<svg
					class="w-5 h-5"
					fill="none"
					stroke="currentColor"
					viewBox="0 0 24 24"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M4 6h16M4 12h16M4 18h16"
					/>
				</svg>
			{/if}
		</button>
	</nav>

	{#if mobileOpen}
		<div
			class="md:hidden border-t border-zinc-800/60 bg-[#09090b]/95 backdrop-blur-md px-6 py-4"
		>
			<ul class="flex flex-col gap-1">
				{#each navLinks as link}
					<li>
						<a
							href={link.href}
							onclick={closeMobile}
							class="block py-3 px-4 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/50 transition-all duration-200 text-sm font-medium"
						>
							{link.label}
						</a>
					</li>
				{/each}
				<li class="mt-2 pt-2 border-t border-zinc-800/60">
					<a
						href="mailto:mikasjames@gmail.com"
						onclick={closeMobile}
						class="block py-3 px-4 rounded-lg text-accent-400 hover:bg-accent-500/10 transition-all duration-200 text-sm font-medium"
					>
						mikasjames@gmail.com
					</a>
				</li>
			</ul>
		</div>
	{/if}
</header>

<main class="relative">
	{@render children()}
</main>
