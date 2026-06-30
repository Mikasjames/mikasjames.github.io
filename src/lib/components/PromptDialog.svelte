<script lang="ts">
	import Modal from "./Modal.svelte";

	let {
		show = $bindable(false),
		title = "Input",
		label = "",
		placeholder = "",
		value = $bindable(""),
		onConfirm,
		onCancel,
	}: {
		show: boolean;
		title?: string;
		label?: string;
		placeholder?: string;
		value?: string;
		onConfirm?: (value: string) => void;
		onCancel?: () => void;
	} = $props();

	function confirm() {
		show = false;
		onConfirm?.(value);
	}

	function cancel() {
		show = false;
		value = "";
		onCancel?.();
	}
</script>

<Modal bind:show size="sm" {title}>
	{#snippet children()}
		<div class="space-y-1.5">
			{#if label}
				<label
					for="prompt-input"
					class="block text-xs font-medium text-zinc-400 tracking-wide uppercase"
					>{label}</label
				>
			{/if}
			<input
				id="prompt-input"
				type="text"
				bind:value
				{placeholder}
				onkeydown={(e) => {
					if (e.key === "Enter") confirm();
					if (e.key === "Escape") cancel();
				}}
				autofocus
				class="w-full px-3.5 py-2.5 rounded-lg bg-zinc-900 border border-zinc-700/60 text-zinc-100 text-sm placeholder-zinc-600 focus:outline-none focus:border-accent-500 focus:ring-1 focus:ring-accent-500/30 transition-all duration-200"
			/>
		</div>
	{/snippet}
	{#snippet footer()}
		<button
			type="button"
			onclick={cancel}
			class="w-full cursor-pointer rounded-lg border border-zinc-700/50 bg-zinc-800 px-4 py-2 text-xs font-semibold text-zinc-300 transition-colors hover:bg-zinc-700 sm:w-auto"
		>
			Cancel
		</button>
		<button
			type="button"
			onclick={confirm}
			disabled={!value.trim()}
			class="w-full cursor-pointer rounded-lg bg-accent-600 px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-accent-600/20 transition-colors hover:bg-accent-500 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
		>
			Confirm
		</button>
	{/snippet}
</Modal>
