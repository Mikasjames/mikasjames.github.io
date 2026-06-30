<script lang="ts">
	import Modal from "./Modal.svelte";

	let {
		show = $bindable(false),
		title = "Confirm",
		message = "Are you sure?",
		confirmText = "Confirm",
		cancelText = "Cancel",
		variant = "danger",
		onConfirm,
		onCancel,
	}: {
		show: boolean;
		title?: string;
		message?: string;
		confirmText?: string;
		cancelText?: string;
		variant?: "danger" | "primary";
		onConfirm?: () => void;
		onCancel?: () => void;
	} = $props();

	function confirm() {
		show = false;
		onConfirm?.();
	}

	function cancel() {
		show = false;
		onCancel?.();
	}

	const confirmBtnStyles: Record<string, string> = {
		danger:
			"bg-red-950/40 border border-red-900/40 text-red-400 hover:border-red-700/60 hover:bg-red-900/60",
		primary:
			"bg-accent-600 text-white hover:bg-accent-500 shadow-lg shadow-accent-600/20",
	};
</script>

<Modal bind:show size="sm" {title}>
	{#snippet children()}
		<p class="text-sm text-zinc-300 leading-relaxed">{message}</p>
	{/snippet}
	{#snippet footer()}
		<button
			type="button"
			onclick={cancel}
			class="w-full cursor-pointer rounded-lg border border-zinc-700/50 bg-zinc-800 px-4 py-2 text-xs font-semibold text-zinc-300 transition-colors hover:bg-zinc-700 sm:w-auto"
		>
			{cancelText}
		</button>
		<button
			type="button"
			onclick={confirm}
			class="w-full cursor-pointer rounded-lg px-4 py-2 text-xs font-semibold transition-colors sm:w-auto {confirmBtnStyles[variant]}"
		>
			{confirmText}
		</button>
	{/snippet}
</Modal>
