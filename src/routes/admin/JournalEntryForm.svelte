<script lang="ts">
	import { tick } from "svelte";
	import CoverImage from "$lib/components/CoverImage.svelte";
	import MarkdownEditor from "$lib/components/MarkdownEditor.svelte";
	import ContentImagesHelper from "$lib/components/ContentImagesHelper.svelte";
	import {
		createJournalEntry,
		updateJournalEntry,
		type ImageMeta,
		type JournalEntry,
	} from "$lib/firebase/firestore.svelte";
	import {
		resolveMissingImageMeta,
		sanitizeImageMetaFromMarkdown,
		enrichImageMetaFromGallery,
	} from "$lib/utils/imageMeta";
	import { todayDateKey, getHappinessLabel } from "$lib/utils/date";
	import type { User } from "firebase/auth";
	import type { MediaItem, Habit } from "$lib/firebase/firestore.svelte";
	import type { createMediaStore } from "$lib/firebase/media.svelte";
	import type { createHabitsStore } from "$lib/firebase/habits.svelte";
	import MediaGalleryDialog from "$lib/components/MediaGalleryDialog.svelte";
	import ConfirmDialog from "$lib/components/ConfirmDialog.svelte";
	import AppButton from "$lib/components/AppButton.svelte";
	import Spinner from "$lib/components/Spinner.svelte";
	import HabitsManager from "$lib/components/HabitsManager.svelte";
	import { toast } from "$lib/stores/toast.svelte";

	type MediaStore = ReturnType<typeof createMediaStore>;
	type HabitsStore = ReturnType<typeof createHabitsStore>;

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

	let { user, mediaStore, habitsStore, loadJournalEntries } = $props<{
		user: User | null;
		mediaStore: MediaStore;
		habitsStore: HabitsStore;
		loadJournalEntries: () => Promise<void>;
	}>();

	let journalForm = $state<JournalFormState>({
		id: null,
		title: "",
		excerpt: "",
		content: "",
		coverImage: null,
		imageMeta: {},
		happinessRating: 3,
		submitting: false,
		successMsg: "",
		error: "",
		coverUploading: false,
		coverError: "",
	});

	let selectedJournalEntryDate = $state<string | null>(null);
	let showMediaGallery = $state(false);
	let showConfirmDelete = $state(false);
	let confirmDeleteMessage = $state("");
	let confirmDeleteAction = $state<(val: boolean) => void>(() => {});
	let showConfirmHabitDelete = $state(false);
	let confirmHabitDeleteMessage = $state("");
	let confirmHabitDeleteAction = $state<(val: boolean) => void>(() => {});
	let activeTab = $state<"write" | "preview">("write");
	let textareaRef = $state<HTMLTextAreaElement | null>(null);
	let showJournalDetails = $state(false);

	export function startEditJournal(entry: JournalEntry) {
		journalForm.id = entry.id;
		journalForm.title = entry.title;
		journalForm.excerpt = entry.excerpt || "";
		journalForm.content = entry.content;
		journalForm.coverImage = entry.coverImage || null;
		journalForm.happinessRating = entry.happinessRating ?? 3;
		selectedJournalEntryDate = entry.entryDate;
		habitsStore.selectedHabitIds = new Set();
		journalForm.imageMeta = sanitizeImageMetaFromMarkdown(
			entry.content,
			enrichImageMetaFromGallery(
				entry.content,
				entry.imageMeta ?? {},
				mediaStore.mediaItems,
			),
		);
		journalForm.successMsg = "";
		journalForm.error = "";
		if (user) {
			habitsStore.loadSelectedHabitLogs(
				user.uid,
				entry.id,
				journalForm.id,
			);
		}
		showJournalDetails = !!entry.content || !!entry.title || !!entry.coverImage;
		window.scrollTo({ top: 0, behavior: "smooth" });
	}

	export function resetJournalForm() {
		journalForm.id = null;
		journalForm.title = "";
		journalForm.excerpt = "";
		journalForm.content = "";
		journalForm.coverImage = null;
		journalForm.imageMeta = {};
		journalForm.happinessRating = 3;
		journalForm.successMsg = "";
		journalForm.error = "";
		selectedJournalEntryDate = todayDateKey();
		habitsStore.selectedHabitIds = new Set();
		showJournalDetails = false;
	}

	async function handleJournalSubmit(e: Event) {
		e.preventDefault();

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
				title: journalForm.title || (journalForm.content ? "Untitled Entry" : ""),
				excerpt: journalForm.excerpt,
				content: journalForm.content,
				coverImage: journalForm.coverImage,
				imageMeta: sanitizedImageMeta,
				happinessRating: journalForm.happinessRating,
				ownerUid: user?.uid,
				entryDate: selectedJournalEntryDate ?? todayDateKey(),
			};

			if (journalForm.id) {
				await updateJournalEntry(journalForm.id, payload);
				await habitsStore.saveSelectedHabitLogs(
					user!.uid,
					journalForm.id,
					payload.entryDate,
				);
				journalForm.successMsg = "Journal entry updated successfully!";
			} else {
				const entryId = await createJournalEntry(payload);
				await habitsStore.saveSelectedHabitLogs(
					user!.uid,
					entryId,
					payload.entryDate,
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

		toast("Image inserted into editor", "success");
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

	function copyToClipboard(text: string) {
		navigator.clipboard.writeText(text).then(() => {
			toast("Copied markdown image tag to clipboard!", "success");
		});
	}

	async function handleDeleteMediaWrapper(item: MediaItem) {
		await mediaStore.handleDeleteMedia(
			item,
			(url: string) => {
				journalForm.imageMeta = { ...journalForm.imageMeta };
				delete journalForm.imageMeta[url];
				journalForm.content = journalForm.content.replace(
					new RegExp(`!\\[.*?\\]\\(${url}\\)`, "g"),
					"",
				);
			},
			(message: string) =>
				new Promise<boolean>((resolve) => {
					confirmDeleteMessage = message;
					confirmDeleteAction = resolve;
					showConfirmDelete = true;
				}),
			(message: string) => toast(message, "error"),
		);
	}

	function handleConfirmHabitDelete(habit: Habit, userUid: string) {
		habitsStore.handleDeleteHabit(
			habit,
			userUid,
			(message: string) =>
				new Promise<boolean>((resolve) => {
					confirmHabitDeleteMessage = message;
					confirmHabitDeleteAction = resolve;
					showConfirmHabitDelete = true;
				}),
		);
	}

	export function isEditing(entryId: string) {
		return journalForm.id === entryId;
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
		{#if selectedJournalEntryDate && selectedJournalEntryDate !== todayDateKey()}
			<div
				class="rounded-lg bg-amber-500/10 border border-amber-500/20 p-3 mb-4"
			>
				<p class="text-sm text-amber-300">
					Editing a past entry from {selectedJournalEntryDate}.
					Habits will be saved for this date.
				</p>
			</div>
		{/if}

		<div
			class="space-y-3 rounded-xl border border-zinc-800/60 bg-zinc-900/40 p-4"
		>
			<HabitsManager
				{habitsStore}
				userId={user!.uid}
				manageLabel="Manage Habits"
				doneLabel="Manage Habits"
				showAddOneInEmpty={false}
				onDeleteHabit={(habit, uid) => handleConfirmHabitDelete(habit, uid)}
			/>
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

		<div class="rounded-xl border border-zinc-800/60 bg-zinc-900/40">
			<button
				type="button"
				onclick={() => (showJournalDetails = !showJournalDetails)}
				class="flex w-full items-center justify-between p-4 text-xs font-semibold uppercase tracking-wide text-zinc-400 transition hover:text-zinc-200"
			>
				<span>Journal Details</span>
				<svg
					class="h-4 w-4 transition-transform {showJournalDetails ? 'rotate-180' : ''}"
					fill="none" stroke="currentColor" viewBox="0 0 24 24"
				>
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
				</svg>
			</button>
			{#if showJournalDetails}
				<div class="space-y-5 border-t border-zinc-800/60 p-4 pt-5">
					<div class="grid grid-cols-1 gap-5 sm:grid-cols-2">
						<div class="space-y-1.5">
							<label
								for="journal-title"
								class="block text-xs font-medium text-zinc-400 tracking-wide uppercase"
								>Title <span class="normal-case font-normal text-zinc-600">(Optional)</span></label
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
								>Excerpt <span class="normal-case font-normal text-zinc-600">(Optional)</span></label
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

					<div class="space-y-1.5">
						<label
							for="journal-entry-date"
							class="block text-xs font-medium text-zinc-400 tracking-wide uppercase"
							>Entry Date</label
						>
						<input
							id="journal-entry-date"
							type="date"
							bind:value={selectedJournalEntryDate}
							class="w-full px-3.5 py-2.5 rounded-lg bg-zinc-900 border border-zinc-700/60 text-zinc-100 text-sm focus:outline-none focus:border-accent-500 focus:ring-1 focus:ring-accent-500/30 transition-all duration-200 [color-scheme:dark]"
						/>
					</div>

					<CoverImage
						bind:coverImage={journalForm.coverImage}
						onCoverUpload={handleJournalCoverUpload}
						coverUploading={mediaStore.mediaUploading}
						coverError={journalForm.coverError}
					/>

					<div class="space-y-2">
						<div class="flex justify-end">
							<AppButton variant="ghost" size="sm" onclick={insertCurrentJournalTimestamp}>
								<svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
								</svg>
								Insert Date & Time
							</AppButton>
						</div>
						<MarkdownEditor
							id="journal-content"
							bind:content={journalForm.content}
							bind:imageMeta={journalForm.imageMeta}
							bind:textareaRef
							bind:activeTab
							onOpenMediaGallery={() => {
								showMediaGallery = true;
								mediaStore.openMediaGallery();
							}}
							placeholderText="What's on your mind today? Markdown is supported."
						/>
					</div>

					<ContentImagesHelper
						onOpenMediaGallery={() => {
							showMediaGallery = true;
							mediaStore.openMediaGallery();
						}}
						{handleContentUpload}
						contentUploading={mediaStore.mediaUploading}
						contentUploadError={mediaStore.mediaUploadError}
						recentMediaItems={mediaStore.recentMediaItems}
						mediaLoadError={mediaStore.mediaLoadError}
						{insertMarkdownAtCursor}
						{setEditorCoverImage}
					/>
				</div>
			{/if}
		</div>

		{#if journalForm.error}
			<div
				class="flex items-center gap-2 px-3.5 py-2.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm"
			>
				<svg class="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
				</svg>
				{journalForm.error}
			</div>
		{/if}

		{#if journalForm.successMsg}
			<div
				class="flex items-center gap-2 px-3.5 py-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm"
			>
				<svg class="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
				</svg>
				{journalForm.successMsg}
			</div>
		{/if}

		<div class="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
			{#if journalForm.id}
				<AppButton variant="ghost" size="md" onclick={resetJournalForm}>Cancel Edit</AppButton>
			{/if}

			<AppButton variant="primary" size="md" type="submit" disabled={journalForm.submitting} loading={journalForm.submitting}>
				{#if journalForm.id}Save Changes{:else}Save Entry{/if}
			</AppButton>
		</div>
	</form>
</section>

<MediaGalleryDialog
	bind:showMediaGallery
	mediaItems={mediaStore.mediaItems}
	mediaUploading={mediaStore.mediaUploading}
	mediaUploadError={mediaStore.mediaUploadError}
	handleGalleryUpload={(e: Event & { target: HTMLInputElement }) => {
		const file = e.target.files?.[0];
		if (file) mediaStore.handleGalleryUpload(file);
	}}
	handleDeleteMedia={handleDeleteMediaWrapper}
	{copyToClipboard}
	{insertMarkdownAtCursor}
	{setEditorCoverImage}
	mediaLoading={mediaStore.mediaLoading}
	deletingMediaIds={mediaStore.deletingMediaIds}
	loadMoreMediaItems={mediaStore.loadMoreMediaItems}
	mediaHasMore={mediaStore.mediaHasMore}
/>

<ConfirmDialog
	bind:show={showConfirmDelete}
	title="Delete Image"
	message={confirmDeleteMessage}
	variant="danger"
	confirmText="Delete"
	onConfirm={() => {
		confirmDeleteAction(true);
		confirmDeleteAction = () => {};
	}}
	onCancel={() => {
		confirmDeleteAction(false);
		confirmDeleteAction = () => {};
	}}
/>

<ConfirmDialog
	bind:show={showConfirmHabitDelete}
	title="Delete Habit"
	message={confirmHabitDeleteMessage}
	variant="danger"
	confirmText="Delete"
	onConfirm={() => {
		confirmHabitDeleteAction(true);
		confirmHabitDeleteAction = () => {};
	}}
	onCancel={() => {
		confirmHabitDeleteAction(false);
		confirmHabitDeleteAction = () => {};
	}}
/>
