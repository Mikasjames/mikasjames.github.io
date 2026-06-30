<script lang="ts">
	import { getToasts, dismissToast, type ToastVariant } from "$lib/stores/toast.svelte";
	import { fade, fly } from "svelte/transition";

	let toasts = $derived(getToasts());

	const variantStyles: Record<ToastVariant, string> = {
		success: "bg-emerald-500/10 border-emerald-500/20 text-emerald-400",
		error: "bg-red-500/10 border-red-500/20 text-red-400",
		info: "bg-zinc-800/90 border-zinc-700/60 text-zinc-200",
	};

	const variantIcons: Record<ToastVariant, string> = {
		success: "M5 13l4 4L19 7",
		error: "M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
		info: "M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
	};
</script>

{#if toasts.length > 0}
	<div
		class="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 max-w-sm w-full pointer-events-none"
	>
		{#each toasts as t (t.id)}
			<div
				in:fly={{ y: 20, duration: 250 }}
				out:fade={{ duration: 200 }}
				class="pointer-events-auto flex items-center gap-2.5 rounded-xl border px-4 py-3 text-sm shadow-2xl shadow-black/40 backdrop-blur-md {variantStyles[t.variant]}"
			>
				<svg
					class="w-4 h-4 shrink-0"
					fill="none"
					stroke="currentColor"
					viewBox="0 0 24 24"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d={variantIcons[t.variant]}
					/>
				</svg>
				<span class="flex-1">{t.message}</span>
				<button
					type="button"
					onclick={() => dismissToast(t.id)}
					class="shrink-0 p-0.5 rounded transition-colors hover:bg-white/10 opacity-60 hover:opacity-100"
					aria-label="Dismiss"
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
							d="M6 18L18 6M6 6l12 12"
						/>
					</svg>
				</button>
			</div>
		{/each}
	</div>
{/if}
