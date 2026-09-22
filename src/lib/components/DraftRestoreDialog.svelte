<script lang="ts">
	import ConfirmDialog from "./ConfirmDialog.svelte";
	import { formattedDate } from "$lib/utils/date";

	let {
		show = $bindable(false),
		date = null,
		restoreHabits = false,
		restoreNote = false,
		onRestore,
		onDiscard,
		onDismiss,
	}: {
		show: boolean;
		date?: string | null;
		restoreHabits?: boolean;
		restoreNote?: boolean;
		onRestore: (date: string) => void;
		onDiscard: (date: string) => void;
		onDismiss: (date: string) => void;
	} = $props();

	const title = $derived(
		!date
			? ""
			: restoreHabits && restoreNote
				? "Restore unsaved changes?"
				: restoreHabits
					? "Restore unsaved habits?"
					: "Restore unsaved note?",
	);

	const message = $derived.by(() => {
		if (!date) return "";
		const when = formattedDate(date);
		if (restoreHabits && restoreNote) {
			return `You have unsaved habit selections and a journal note for ${when}. Would you like to restore them?`;
		}
		if (restoreHabits) {
			return `You have unsaved habit selections for ${when}. Would you like to restore them?`;
		}
		return `You have an unsaved journal note for ${when}. Would you like to restore it?`;
	});
</script>

<ConfirmDialog
	bind:show
	{title}
	{message}
	confirmText="Restore"
	cancelText="Discard"
	variant="primary"
	onConfirm={() => {
		if (date) onRestore(date);
	}}
	onCancel={() => {
		if (date) onDiscard(date);
	}}
	onDismiss={() => {
		if (date) onDismiss(date);
	}}
/>
