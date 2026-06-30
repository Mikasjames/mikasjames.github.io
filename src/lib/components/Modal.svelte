<script lang="ts">
	import { fade, fly } from "svelte/transition";

	let {
		show = $bindable(false),
		size = "md",
		title = "",
		description = "",
		onclose,
		children,
		footer,
	}: {
		show: boolean;
		size?: "sm" | "md" | "lg";
		title?: string;
		description?: string;
		onclose?: () => void;
		children?: import("svelte").Snippet;
		footer?: import("svelte").Snippet;
	} = $props();

	function close() {
		show = false;
		onclose?.();
	}

	function onBackdropClick(e: MouseEvent) {
		if (e.target === e.currentTarget) close();
	}

	function onKeydown(e: KeyboardEvent) {
		if (e.key === "Escape") close();
	}

	const sizeClasses: Record<string, string> = {
		sm: "max-w-sm",
		md: "max-w-lg",
		lg: "max-w-2xl",
	};

	$effect(() => {
		if (show) {
			document.body.classList.add("overflow-hidden");
		} else {
			document.body.classList.remove("overflow-hidden");
		}
		return () => {
			document.body.classList.remove("overflow-hidden");
		};
	});
</script>

<svelte:window onkeydown={onKeydown} />

{#if show}
	<div
		transition:fade={{ duration: 150 }}
		class="fixed inset-0 z-50 flex items-start justify-center bg-black/80 backdrop-blur-md sm:items-center overflow-y-auto"
		role="dialog"
		aria-modal="true"
		tabindex="-1"
		aria-label={title || "Dialog"}
		onclick={onBackdropClick}
		onkeydown={onKeydown}
	>
		<div
			transition:fly={{ y: 16, duration: 200 }}
			class="relative my-8 w-full {sizeClasses[size]} flex flex-col overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900 shadow-2xl shadow-black/40 sm:my-4 sm:rounded-2xl"
		>
			{#if title || description}
				<div
					class="flex items-start justify-between gap-3 border-b border-zinc-800 px-4 py-3 sm:px-6 sm:py-4"
				>
					<div class="min-w-0">
						{#if title}
							<h3 class="text-lg font-bold text-zinc-100">
								{title}
							</h3>
						{/if}
						{#if description}
							<p class="text-xs text-zinc-500 mt-0.5">
								{description}
							</p>
						{/if}
					</div>
					<button
						type="button"
						onclick={close}
						class="text-zinc-400 hover:text-zinc-200 transition-colors p-1.5 hover:bg-zinc-800 rounded-lg cursor-pointer"
						aria-label="Close"
					>
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
					</button>
				</div>
			{:else}
				<button
					type="button"
					onclick={close}
					class="absolute top-3 right-3 z-10 text-zinc-400 hover:text-zinc-200 transition-colors p-1.5 hover:bg-zinc-800 rounded-lg cursor-pointer"
					aria-label="Close"
				>
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
				</button>
			{/if}

			{#if children}
				<div class="flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-5">
					{@render children()}
				</div>
			{/if}

			{#if footer}
				<div
					class="flex justify-end gap-3 border-t border-zinc-800 bg-zinc-950 px-4 py-3 sm:px-6 sm:py-4"
				>
					{@render footer()}
				</div>
			{/if}
		</div>
	</div>
{/if}
