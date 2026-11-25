<script lang="ts">
	import Modal from "./Modal.svelte";
	import { logEvent } from "$lib/firebase/analytics";
	import { RESUME_DOWNLOAD_NAME, RESUME_URL } from "$lib/site";

	let {
		open = $bindable(false),
		onclose,
	}: {
		open: boolean;
		onclose?: () => void;
	} = $props();

	function trackDownload() {
		logEvent("download_resume", { url: RESUME_URL });
	}
</script>

<Modal
	bind:show={open}
	size="xl"
	title="Résumé"
	description="Mikas James Gamboa Arayata · Full-Stack Software Engineer"
	{onclose}
>
	{#snippet children()}
		<div class="flex flex-col gap-3">
			<iframe
				src="{RESUME_URL}#view=FitH"
				title="Mikas James Arayata résumé"
				class="h-[60vh] w-full rounded-lg border border-zinc-800 bg-zinc-950 sm:h-[70vh]"
			></iframe>
			<p class="text-xs text-zinc-500">
				Trouble viewing?
				<a
					href={RESUME_URL}
					target="_blank"
					rel="noopener noreferrer"
					class="text-accent-400 underline underline-offset-2 transition-colors hover:text-accent-300"
					>Open the PDF in a new tab</a
				>.
			</p>
		</div>
	{/snippet}

	{#snippet footer()}
		<a
			href={RESUME_URL}
			download={RESUME_DOWNLOAD_NAME}
			onclick={trackDownload}
			class="inline-flex items-center gap-2 rounded-lg bg-accent-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-accent-600"
		>
			<svg
				class="h-4 w-4"
				fill="none"
				stroke="currentColor"
				viewBox="0 0 24 24"
				aria-hidden="true"
			>
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M12 4v12m0 0l-4-4m4 4l4-4M4 20h16"
				/>
			</svg>
			Download PDF
		</a>
	{/snippet}
</Modal>
