<script lang="ts">
	import { tick } from "svelte";
	import CoverImage from "$lib/components/CoverImage.svelte";
	import MarkdownEditor from "$lib/components/MarkdownEditor.svelte";
	import ContentImagesHelper from "$lib/components/ContentImagesHelper.svelte";
	import {
		createJournalEntry,
		updateJournalEntry,
		type ImageMeta,
	} from "$lib/firebase/firestore.svelte";
	import {
		resolveMissingImageMeta,
		sanitizeImageMetaFromMarkdown,
	} from "$lib/utils/imageMeta";
	import type { User } from "firebase/auth";

	interface JournalFormState {
		id: string | null;
		title: string;
		excerpt: string;
		content: string;
		coverImage: string | null;
		imageMeta: Record<string, ImageMeta>;
		happinessRating: number;
		submitting: boolean;
		successMsg: string;
		error: string;
		coverUploading: boolean;
		coverError: string;
	}

	let {
		journalForm = $bindable(),
		user,
		mediaStore,
		habitsStore,
		loadJournalEntries,
		resetJournalForm,
		openMediaGallery,
		todayDateKey,
		getHappinessLabel,
		selectedJournalEntryDate = $bindable(),
	} = $props<{
		journalForm: JournalFormState;
		user: User | null;
		mediaStore: any;
		habitsStore: any;
		loadJournalEntries: () => Promise<void>;
		resetJournalForm: () => void;
		openMediaGallery: (insertCb?: any, coverCb?: any) => Promise<void>;
		todayDateKey: () => string;
		getHappinessLabel: (rating: number) => string;
		selectedJournalEntryDate: string | null;
	}>();

	let activeTab = $state<"write" | "preview">("write");
	let textareaRef = $state<HTMLTextAreaElement | null>(null);

	async function handleJournalSubmit(e: Event) {
		e.preventDefault();
		if (!journalForm.content) {
			journalForm.error = "Content is required.";
			return;
		}

		journalForm.submitting = true;
		journalForm.error = "";
		journalForm.successMsg = "";
		try {
			const resolvedImageMeta = await resolveMissingImageMeta(
				journalForm.content,
				journalForm.imageMeta,
			);
			const sanitizedImageMeta = sanitizeImageMetaFromMarkdown(
				journalForm.content,
				resolvedImageMeta,
			);
			journalForm.imageMeta = sanitizedImageMeta;

			const payload = {
				title: journalForm.title || "Untitled Entry",
				excerpt: journalForm.excerpt,
				content: journalForm.content,
				coverImage: journalForm.coverImage,
				imageMeta: sanitizedImageMeta,
				happinessRating: journalForm.happinessRating,
				ownerUid: user?.uid,
			};

			if (journalForm.id) {
				await updateJournalEntry(journalForm.id, payload);
				await habitsStore.saveSelectedHabitLogs(
					user!.uid,
					journalForm.id,
					selectedJournalEntryDate ?? todayDateKey(),
				);
				journalForm.successMsg = "Journal entry updated successfully!";
			} else {
				const entryId = await createJournalEntry(payload);
				await habitsStore.saveSelectedHabitLogs(
					user!.uid,
					entryId,
					todayDateKey(),
				);
				journalForm.successMsg = "Journal entry added successfully!";
			}
			resetJournalForm();
			await loadJournalEntries();
			await habitsStore.loadHabits(user!.uid);
		} catch (err: unknown) {
			journalForm.error =
				err instanceof Error
					? err.message
					: "Failed to save journal entry.";
		} finally {
			journalForm.submitting = false;
		}
	}

	async function handleJournalCoverUpload(e: Event) {
		const target = e.target as HTMLInputElement;
		if (!target.files || target.files.length === 0) return;
		try {
			const result = await mediaStore.handleGalleryUpload(
				target.files[0],
			);
			journalForm.coverImage = result.url;
		} catch (err: unknown) {
			journalForm.coverError =
				err instanceof Error ? err.message : "Upload failed.";
		} finally {
			target.value = "";
		}
	}

	async function handleContentUpload(e: Event) {
		const target = e.target as HTMLInputElement;
		if (!target.files || target.files.length === 0) return;
		const file = target.files[0];
		try {
			const { url, width, height, name } =
				await mediaStore.handleGalleryUpload(file);
			journalForm.imageMeta = {
				...journalForm.imageMeta,
				[url]: { width, height },
			};
			await insertMarkdownAtCursor(url, name.split(".")[0], {
				width,
				height,
			});
		} catch (err: unknown) {
			// error handled by store
		} finally {
			target.value = "";
		}
	}

	async function insertMarkdownAtCursor(
		url: string,
		altText: string,
		dims?: { width?: number; height?: number },
	) {
		activeTab = "write";
		await tick();
		if (!textareaRef) return;

		if (dims?.width && dims?.height) {
			journalForm.imageMeta = {
				...journalForm.imageMeta,
				[url]: { width: dims.width, height: dims.height },
			};
		}

		const start = textareaRef.selectionStart;
		const end = textareaRef.selectionEnd;
		const text = journalForm.content;

		const before = text.substring(0, start);
		const after = text.substring(end, text.length);
		const tag = `![${altText}](${url})`;
		const newValue = before + tag + after;

		textareaRef.value = newValue;
		journalForm.content = newValue;

		textareaRef.focus();
		textareaRef.selectionStart = textareaRef.selectionEnd =
			start + tag.length;

		await tick();

		if (textareaRef) {
			textareaRef.focus();
			textareaRef.selectionStart = textareaRef.selectionEnd =
				start + tag.length;
		}
	}

	async function insertTextAtCursor(textToInsert: string) {
		activeTab = "write";
		await tick();
		if (!textareaRef) return;

		const start = textareaRef.selectionStart;
		const end = textareaRef.selectionEnd;
		const text = journalForm.content;
		const before = text.substring(0, start);
		const after = text.substring(end, text.length);
		const newValue = before + textToInsert + after;

		textareaRef.value = newValue;
		journalForm.content = newValue;

		await tick();

		if (textareaRef) {
			textareaRef.focus();
			textareaRef.selectionStart = textareaRef.selectionEnd =
				start + textToInsert.length;
		}
	}

	async function insertCurrentJournalTimestamp() {
		const now = new Date();
		const stamp = now.toLocaleString("en-US", {
			weekday: "long",
			year: "numeric",
			month: "long",
			day: "numeric",
			hour: "numeric",
			minute: "2-digit",
		});
		await insertTextAtCursor(`\n\n### ${stamp}\n\n`);
	}

	function setEditorCoverImage(url: string | null) {
		journalForm.coverImage = url;
	}
</script>

<section
	class="bg-surface-900/80 rounded-xl border border-zinc-800/60 p-4 shadow-2xl shadow-black/40 backdrop-blur-md sm:rounded-2xl sm:p-5 md:p-8"
>
	<h2
		class="text-lg font-semibold text-zinc-100 mb-6 flex items-center gap-2"
	>
		{#if journalForm.id}
			<svg
				class="w-4 h-4 text-accent-400"
				fill="none"
				stroke="currentColor"
				viewBox="0 0 24 24"
			>
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
				/>
			</svg>
			Edit Journal Entry
		{:else}
			<svg
				class="w-4 h-4 text-accent-400"
				fill="none"
				stroke="currentColor"
				viewBox="0 0 24 24"
			>
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M12 4v16m8-8H4"
				/>
			</svg>
			New Journal Entry
		{/if}
	</h2>

	<form onsubmit={handleJournalSubmit} class="space-y-5">
		<div class="grid grid-cols-1 gap-5 sm:grid-cols-2">
			<div class="space-y-1.5">
				<label
					for="journal-title"
					class="block text-xs font-medium text-zinc-400 tracking-wide uppercase"
					>Title (Optional)</label
				>
				<input
					id="journal-title"
					type="text"
					bind:value={journalForm.title}
					placeholder="Untitled Entry"
					class="w-full px-3.5 py-2.5 rounded-lg bg-zinc-900 border border-zinc-700/60 text-zinc-100 text-sm placeholder-zinc-600 focus:outline-none focus:border-accent-500 focus:ring-1 focus:ring-accent-500/30 transition-all duration-200"
				/>
			</div>
			<div class="space-y-1.5">
				<label
					for="journal-excerpt"
					class="block text-xs font-medium text-zinc-400 tracking-wide uppercase"
					>Excerpt <span class="normal-case font-normal text-zinc-600"
						>(Optional)</span
					></label
				>
				<input
					id="journal-excerpt"
					type="text"
					bind:value={journalForm.excerpt}
					placeholder="A short summary or mood for this entry…"
					class="w-full px-3.5 py-2.5 rounded-lg bg-zinc-900 border border-zinc-700/60 text-zinc-100 text-sm placeholder-zinc-600 focus:outline-none focus:border-accent-500 focus:ring-1 focus:ring-accent-500/30 transition-all duration-200"
				/>
			</div>
		</div>

		<div class="rounded-xl border border-zinc-800/60 bg-zinc-900/40 p-4">
			<div
				class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
			>
				<div>
					<label
						for="journal-happiness"
						class="block text-xs font-semibold text-zinc-400 tracking-wide uppercase"
						>Overall Happiness</label
					>
					<p class="mt-1 text-xs text-zinc-550">
						Daily rating for monthly and yearly insights.
					</p>
				</div>
				<div
					class="flex items-center gap-2 rounded-lg border border-accent-500/20 bg-accent-500/10 px-3 py-2"
				>
					<span class="text-2xl font-bold text-accent-300"
						>{journalForm.happinessRating}</span
					>
					<span class="text-xs font-medium text-accent-200"
						>{getHappinessLabel(journalForm.happinessRating)}</span
					>
				</div>
			</div>
			<div class="mt-4">
				<input
					id="journal-happiness"
					type="range"
					min="1"
					max="5"
					step="1"
					bind:value={journalForm.happinessRating}
					class="h-2 w-full cursor-pointer appearance-none rounded-full bg-gradient-to-r from-red-500 via-amber-400 to-emerald-400 accent-accent-500"
				/>
				<div
					class="mt-2 flex justify-between text-[10px] font-mono uppercase tracking-wider text-zinc-600"
				>
					<span>1 Low</span>
					<span>3 Steady</span>
					<span>5 High</span>
				</div>
			</div>
		</div>

		<CoverImage
			bind:coverImage={journalForm.coverImage}
			onCoverUpload={handleJournalCoverUpload}
			coverUploading={mediaStore.mediaUploading}
			coverError={journalForm.coverError}
		/>

		<div
			class="space-y-3 rounded-xl border border-zinc-800/60 bg-zinc-900/40 p-4"
		>
			<div class="flex flex-wrap items-center justify-between gap-3">
				<div>
					<p
						class="text-xs font-semibold uppercase tracking-wide text-zinc-400"
					>
						{journalForm.id ? "Habits for Entry" : "Habits Today"}
					</p>
					{#if habitsStore.habitsError}
						<p class="mt-1 text-xs text-red-400">
							{habitsStore.habitsError}
						</p>
					{/if}
				</div>
				<button
					type="button"
					onclick={() =>
						(habitsStore.showHabitManager =
							!habitsStore.showHabitManager)}
					class="text-xs font-semibold text-accent-400 transition-colors hover:text-accent-300"
				>
					Manage Habits
				</button>
			</div>

			{#if habitsStore.habitsLoading}
				<div class="flex flex-wrap gap-2">
					<div
						class="h-9 w-24 animate-pulse rounded-lg bg-zinc-800/70"
					></div>
					<div
						class="h-9 w-28 animate-pulse rounded-lg bg-zinc-800/70"
					></div>
					<div
						class="h-9 w-20 animate-pulse rounded-lg bg-zinc-800/70"
					></div>
				</div>
			{:else if habitsStore.habits.length === 0}
				<p class="text-xs text-zinc-550">No habits yet.</p>
			{:else}
				<div class="flex flex-wrap gap-2">
					{#each habitsStore.habits as habit (habit.id)}
						<button
							type="button"
							onclick={() => habitsStore.toggleHabit(habit.id)}
							class="rounded-lg border px-3 py-2 text-sm font-medium transition-all {habitsStore.selectedHabitIds.has(
								habit.id,
							)
								? 'border-accent-500/50 bg-accent-600/20 text-accent-200 shadow-lg shadow-accent-600/10'
								: 'border-zinc-700/60 bg-zinc-900 text-zinc-300 hover:border-zinc-600 hover:text-zinc-100'}"
						>
							{habit.emoji}
							{habit.name}
						</button>
					{/each}
				</div>
			{/if}

			{#if habitsStore.showHabitManager}
				<div class="space-y-3 border-t border-zinc-800/60 pt-4">
					<div class="space-y-2">
						{#each habitsStore.habits as habit, index (habit.id)}
							<div
								class="flex flex-wrap items-center gap-2 rounded-lg border border-zinc-800/50 bg-zinc-950/30 px-3 py-2"
							>
								<span
									class="min-w-0 flex-1 truncate text-sm text-zinc-300"
								>
									{habit.emoji}
									{habit.name}
								</span>
								<button
									type="button"
									onclick={() =>
										habitsStore.moveHabit(
											index,
											-1,
											user!.uid,
										)}
									disabled={index === 0}
									class="rounded border border-zinc-700/60 px-2 py-1 text-xs text-zinc-400 transition hover:border-accent-500/50 hover:text-accent-300 disabled:cursor-not-allowed disabled:opacity-40"
								>
									Up
								</button>
								<button
									type="button"
									onclick={() =>
										habitsStore.moveHabit(
											index,
											1,
											user!.uid,
										)}
									disabled={index ===
										habitsStore.habits.length - 1}
									class="rounded border border-zinc-700/60 px-2 py-1 text-xs text-zinc-400 transition hover:border-accent-500/50 hover:text-accent-300 disabled:cursor-not-allowed disabled:opacity-40"
								>
									Down
								</button>
								<button
									type="button"
									onclick={() =>
										habitsStore.handleDeleteHabit(
											habit,
											user!.uid,
										)}
									class="rounded border border-red-500/20 px-2 py-1 text-xs text-red-400 transition hover:border-red-500/40 hover:text-red-300"
								>
									Delete
								</button>
							</div>
						{/each}
					</div>

					<div
						class="grid gap-2 sm:grid-cols-[5rem_minmax(0,1fr)_auto]"
					>
						<input
							type="text"
							bind:value={habitsStore.habitForm.emoji}
							placeholder="🙏"
							class="w-full rounded-lg border border-zinc-700/60 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:border-accent-500 focus:outline-none focus:ring-1 focus:ring-accent-500/30"
						/>
						<input
							type="text"
							bind:value={habitsStore.habitForm.name}
							placeholder="Habit name"
							class="w-full rounded-lg border border-zinc-700/60 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:border-accent-500 focus:outline-none focus:ring-1 focus:ring-accent-500/30"
						/>
						<button
							type="button"
							onclick={() =>
								habitsStore.handleAddHabit(user!.uid)}
							disabled={habitsStore.habitForm.submitting}
							class="rounded-lg bg-accent-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-accent-500 disabled:cursor-not-allowed disabled:opacity-50"
						>
							Save
						</button>
					</div>
					{#if habitsStore.habitForm.error}
						<p class="text-xs text-red-400">
							{habitsStore.habitForm.error}
						</p>
					{/if}
				</div>
			{/if}
		</div>

		<div class="space-y-2">
			<div class="flex justify-end">
				<button
					type="button"
					onclick={insertCurrentJournalTimestamp}
					class="inline-flex items-center gap-2 rounded-lg border border-zinc-700/60 bg-zinc-900 px-3 py-2 text-xs font-semibold text-zinc-300 transition-all duration-200 hover:border-accent-500/50 hover:text-accent-300"
				>
					<svg
						class="h-3.5 w-3.5"
						fill="none"
						stroke="currentColor"
						viewBox="0 0 24 24"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
						/>
					</svg>
					Insert Date & Time
				</button>
			</div>
			<MarkdownEditor
				id="journal-content"
				bind:content={journalForm.content}
				bind:imageMeta={journalForm.imageMeta}
				bind:textareaRef
				bind:activeTab
				onOpenMediaGallery={() =>
					openMediaGallery(
						insertMarkdownAtCursor,
						setEditorCoverImage,
					)}
				placeholderText="What's on your mind today? Markdown is supported."
			/>
		</div>

		<ContentImagesHelper
			onOpenMediaGallery={() =>
				openMediaGallery(insertMarkdownAtCursor, setEditorCoverImage)}
			{handleContentUpload}
			contentUploading={mediaStore.mediaUploading}
			contentUploadError={mediaStore.mediaUploadError}
			recentMediaItems={mediaStore.recentMediaItems}
			mediaLoadError={mediaStore.mediaLoadError}
			{insertMarkdownAtCursor}
			{setEditorCoverImage}
		/>

		{#if journalForm.error}
			<div
				class="flex items-center gap-2 px-3.5 py-2.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm"
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
						d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
					/>
				</svg>
				{journalForm.error}
			</div>
		{/if}

		{#if journalForm.successMsg}
			<div
				class="flex items-center gap-2 px-3.5 py-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm"
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
						d="M5 13l4 4L19 7"
					/>
				</svg>
				{journalForm.successMsg}
			</div>
		{/if}

		<div class="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
			{#if journalForm.id}
				<button
					type="button"
					onclick={resetJournalForm}
					class="w-full rounded-lg border border-zinc-700/60 px-6 py-2.5 text-sm font-semibold text-zinc-300 transition-all duration-200 hover:border-zinc-500 hover:text-zinc-100 sm:w-auto"
				>
					Cancel Edit
				</button>
			{/if}

			<button
				type="submit"
				disabled={journalForm.submitting}
				class="flex w-full items-center justify-center gap-2 rounded-lg bg-accent-600 px-6 py-2.5 text-sm font-semibold text-white shadow-lg shadow-accent-600/20 transition-all duration-200 hover:bg-accent-500 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
			>
				{#if journalForm.submitting}
					<div
						class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"
					></div>
					Saving…
				{:else}
					<svg
						class="w-4 h-4"
						fill="none"
						stroke="currentColor"
						viewBox="0 0 24 24"
					>
						{#if journalForm.id}
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"
							/>
						{:else}
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
							/>
						{/if}
					</svg>
					{#if journalForm.id}Save Changes{:else}Save Entry{/if}
				{/if}
			</button>
		</div>
	</form>
</section>
