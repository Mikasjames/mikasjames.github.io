<script lang="ts">
	import { goto } from "$app/navigation";
	import { subscribeToAuth, logout } from "$lib/firebase/auth";
	import {
		getPostsPage,
		deletePost,
		type BlogPost,
		getJournalEntriesPage,
		deleteJournalEntry,
		getJournalEntryByDate,
		upsertJournalEntry,
		type JournalEntry,
		DEFAULT_PAGE_SIZE,
	} from "$lib/firebase/firestore.svelte";
	import type { DocumentSnapshot } from "firebase/firestore";
	import type { User } from "firebase/auth";
	import { createInsightsStore } from "$lib/firebase/insights.svelte";
	import { createMediaStore } from "$lib/firebase/media.svelte";
	import { createHabitsStore } from "$lib/firebase/habits.svelte";
	import { getHappinessLabel, todayDateKey } from "$lib/utils/date";
	import GridBackground from "$lib/components/GridBackground.svelte";
	import Spinner from "$lib/components/Spinner.svelte";
	import AppButton from "$lib/components/AppButton.svelte";
	import HabitsManager from "$lib/components/HabitsManager.svelte";
	import BlogPostForm from "./BlogPostForm.svelte";
	import JournalEntryForm from "./JournalEntryForm.svelte";
	import InsightsDashboard from "./InsightsDashboard.svelte";
	import EntryList from "./EntryList.svelte";
	import ConfirmDialog from "$lib/components/ConfirmDialog.svelte";
	import { toast } from "$lib/stores/toast.svelte";

	let user = $state<User | null>(null);
	let authReady = $state(false);

	const insightsStore = createInsightsStore();
	const mediaStore = createMediaStore();
	const habitsStore = createHabitsStore();

	let blogPostFormRef = $state<ReturnType<typeof BlogPostForm>>();
	let journalEntryFormRef = $state<ReturnType<typeof JournalEntryForm>>();

	let currentSection = $state<"habits" | "blogs" | "journal" | "insights">("habits");

	let habitsHappiness = $state(3);
	let habitsSaving = $state(false);
	let habitsSaveMsg = $state("");
	let currentUser = $derived(user!);

	$effect(() => {
		const unsub = subscribeToAuth((u) => {
			user = u;
			authReady = true;
			if (!u) goto("/admin/login/");
		});
		return unsub;
	});

	$effect(() => {
		if (authReady && user) {
			loadPosts();
			mediaStore.loadRecentMedia();
			loadJournalEntries();
			habitsStore.loadHabits(user.uid);
			insightsStore.loadLatest(user.uid);
			loadTodayCheckin(user.uid);
		}
	});

	async function loadTodayCheckin(uid: string) {
		const today = todayDateKey();
		try {
			const entry = await getJournalEntryByDate(uid, today);
			if (entry) {
				habitsHappiness = entry.happinessRating ?? 3;
				await habitsStore.loadHabitLogsForDate(uid, today);
			} else {
				habitsHappiness = 3;
				habitsStore.selectedHabitIds = new Set();
			}
		} catch {
			habitsHappiness = 3;
			habitsStore.selectedHabitIds = new Set();
		}
	}

	async function handleHabitsSave() {
		if (!user) return;
		habitsSaving = true;
		habitsSaveMsg = "";
		const today = todayDateKey();
		try {
			const existing = await getJournalEntryByDate(user.uid, today);
			const payload = {
				title: "",
				excerpt: "",
				content: "",
				coverImage: null as string | null,
				imageMeta: {} as Record<string, { width: number; height: number }>,
				happinessRating: habitsHappiness,
				ownerUid: user.uid,
				entryDate: today,
			};

			const entryId = await upsertJournalEntry(payload, existing?.id);

			await habitsStore.saveHabitLogsForDate(user.uid, today, entryId);
			habitsSaveMsg = "Saved!";
			setTimeout(() => { habitsSaveMsg = ""; }, 2000);
		} catch (err) {
			habitsSaveMsg = err instanceof Error ? err.message : "Failed to save.";
		} finally {
			habitsSaving = false;
		}
	}

	let posts = $state<BlogPost[]>([]);
	let postsLoading = $state(false);
	let postsLoadingMore = $state(false);
	let postsCursor = $state<DocumentSnapshot | null>(null);
	let postsHasMore = $state(false);
	let postsStatusFilter = $state<string | undefined>(undefined);

	let showConfirm = $state(false);
	let confirmTitle = $state("");
	let confirmMessage = $state("");
	let confirmVariant = $state<"danger" | "primary">("danger");
	let confirmAction = $state<() => void>(() => {});

	function openConfirm(
		title: string,
		message: string,
		action: () => void,
		variant: "danger" | "primary" = "danger",
	) {
		confirmTitle = title;
		confirmMessage = message;
		confirmAction = action;
		confirmVariant = variant;
		showConfirm = true;
	}
	let journalEntries = $state<JournalEntry[]>([]);
	let journalEntriesLoading = $state(false);
	let journalEntriesLoadError = $state("");
	let journalEntriesLoadingMore = $state(false);
	let journalEntriesCursor = $state<DocumentSnapshot | null>(null);
	let journalEntriesHasMore = $state(false);

	async function loadPosts(status?: string) {
		postsLoading = true;
		postsStatusFilter = status;
		posts = [];
		postsCursor = null;
		try {
			const result = await getPostsPage(undefined, DEFAULT_PAGE_SIZE, status ? { status: status as 'draft' | 'published' | 'unlisted' } : undefined);
			posts = result.items;
			postsCursor = result.nextCursor;
			postsHasMore = result.hasMore;
		} finally {
			postsLoading = false;
		}
	}

	async function loadMorePosts() {
		if (!postsCursor || postsLoadingMore) return;
		postsLoadingMore = true;
		try {
			const result = await getPostsPage(postsCursor, DEFAULT_PAGE_SIZE, postsStatusFilter ? { status: postsStatusFilter as 'draft' | 'published' | 'unlisted' } : undefined);
			posts = [...posts, ...result.items];
			postsCursor = result.nextCursor;
			postsHasMore = result.hasMore;
		} finally {
			postsLoadingMore = false;
		}
	}

	async function loadJournalEntries() {
		journalEntriesLoading = true;
		journalEntriesLoadError = "";
		journalEntries = [];
		journalEntriesCursor = null;
		try {
			const result = await getJournalEntriesPage();
			journalEntries = result.items;
			journalEntriesCursor = result.nextCursor;
			journalEntriesHasMore = result.hasMore;
		} catch (err: unknown) {
			console.error("Failed to load journal entries:", err);
			journalEntriesLoadError =
				err instanceof Error
					? err.message
					: "Failed to load journal entries. Check Firestore rules.";
		} finally {
			journalEntriesLoading = false;
		}
	}

	async function loadMoreJournalEntries() {
		if (!journalEntriesCursor || journalEntriesLoadingMore) return;
		journalEntriesLoadingMore = true;
		try {
			const result = await getJournalEntriesPage(journalEntriesCursor);
			journalEntries = [...journalEntries, ...result.items];
			journalEntriesCursor = result.nextCursor;
			journalEntriesHasMore = result.hasMore;
		} catch (err: unknown) {
			console.error("Failed to load more journal entries:", err);
		} finally {
			journalEntriesLoadingMore = false;
		}
	}

	async function handleDeleteJournal(entry: JournalEntry) {
		openConfirm(
			"Delete Journal Entry",
			"Are you sure you want to delete this journal entry? This action cannot be undone.",
			async () => {
				try {
					await deleteJournalEntry(entry.id);
					if (journalEntryFormRef?.isEditing(entry.id)) {
						journalEntryFormRef.resetJournalForm();
					}
					await loadJournalEntries();
				} catch (err: unknown) {
					toast(
						err instanceof Error
							? err.message
							: "Failed to delete journal entry.",
						"error",
					);
				}
			},
		);
	}

	async function handleDelete(post: BlogPost) {
		openConfirm(
			"Delete Blog Post",
			`Are you sure you want to delete "${post.title}"? This action cannot be undone.`,
			async () => {
				try {
					await deletePost(post.id);
					if (blogPostFormRef?.isEditing(post.id)) {
						blogPostFormRef.resetForm();
					}
					await loadPosts();
				} catch (err: unknown) {
					toast(
						err instanceof Error
							? err.message
							: "Failed to delete post.",
						"error",
					);
				}
			},
		);
	}

	async function handleLogout() {
		await logout();
		goto("/admin/login/");
	}

	function handlePostsStatusFilterChange(status: string | undefined) {
		loadPosts(status);
	}
</script>

<svelte:head>
	<title>Admin Dashboard · Mikas James</title>
	<meta name="robots" content="noindex, nofollow" />
</svelte:head>

{#if !authReady}
	<div class="min-h-screen bg-[#09090b] flex items-center justify-center">
		<Spinner size="lg" color="accent" />
	</div>
{:else if user}
	<div
		class="min-h-screen bg-[#09090b] px-3 pt-16 pb-12 sm:px-4 sm:pt-20 sm:pb-16 lg:px-6"
	>
		<GridBackground opacity="3" />

		<div class="relative mx-auto w-full max-w-5xl space-y-8 sm:space-y-10">
			<div
				class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
			>
				<div class="min-w-0">
					<p
						class="font-mono text-xs text-accent-400 tracking-widest uppercase mb-1"
					>
						&gt;_ admin
					</p>
					<h1 class="text-2xl font-bold text-zinc-100">Dashboard</h1>
					<p class="mt-0.5 break-words text-sm text-zinc-500">
						Signed in as <span class="text-zinc-300"
							>{user.email}</span
						>
					</p>
				</div>
				<div
					class="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:gap-3 sm:self-auto"
				>
					<AppButton variant="ghost" size="md" href="/blogs/drafts/">View Drafts</AppButton>
					<AppButton
						variant="ghost" size="md"
						href={currentSection === "blogs"
							? "/blogs/"
							: currentSection === "journal"
								? "/journal/"
								: "/habits/"}
					>
						View {currentSection === "blogs" ? "Blog" : currentSection === "journal" ? "Journal" : "Habits"}
					</AppButton>
					<AppButton variant="secondary" size="md" onclick={handleLogout}>Sign Out</AppButton>
				</div>
			</div>

			<div
				class="flex gap-5 overflow-x-auto border-b border-zinc-800/40 sm:gap-6"
			>
				<button
					type="button"
					onclick={() => (currentSection = "habits")}
					class="relative shrink-0 pb-3 text-sm font-semibold tracking-wide transition-all duration-200 {currentSection ===
					'habits'
						? 'text-accent-400'
						: 'text-zinc-400 hover:text-zinc-200'}"
				>
					Habits
					{#if currentSection === "habits"}
						<span
							class="absolute bottom-0 left-0 right-0 h-0.5 bg-accent-500 rounded-t-full"
						></span>
					{/if}
				</button>
				<button
					type="button"
					onclick={() => (currentSection = "journal")}
					class="relative shrink-0 pb-3 text-sm font-semibold tracking-wide transition-all duration-200 {currentSection ===
					'journal'
						? 'text-accent-400'
						: 'text-zinc-400 hover:text-zinc-200'}"
				>
					Personal Journal
					{#if currentSection === "journal"}
						<span
							class="absolute bottom-0 left-0 right-0 h-0.5 bg-accent-500 rounded-t-full"
						></span>
					{/if}
				</button>
				<button
					type="button"
					onclick={() => (currentSection = "blogs")}
					class="relative shrink-0 pb-3 text-sm font-semibold tracking-wide transition-all duration-200 {currentSection ===
					'blogs'
						? 'text-accent-400'
						: 'text-zinc-400 hover:text-zinc-200'}"
				>
					Blog Posts
					{#if currentSection === "blogs"}
						<span
							class="absolute bottom-0 left-0 right-0 h-0.5 bg-accent-500 rounded-t-full"
						></span>
					{/if}
				</button>
				<button
					type="button"
					onclick={() => (currentSection = "insights")}
					class="relative shrink-0 pb-3 text-sm font-semibold tracking-wide transition-all duration-200 {currentSection ===
					'insights'
						? 'text-accent-400'
						: 'text-zinc-400 hover:text-zinc-200'}"
				>
					Insights
					{#if currentSection === "insights"}
						<span
							class="absolute bottom-0 left-0 right-0 h-0.5 bg-accent-500 rounded-t-full"
						></span>
					{/if}
				</button>
			</div>

			{#if currentSection === "habits"}
				<div class="space-y-6">
					<div class="rounded-xl border border-zinc-800/60 bg-zinc-900/50 p-5">
						<div class="mb-4">
							<p class="text-xs font-semibold uppercase tracking-wide text-zinc-400">
								Today's Check-in
							</p>
							<p class="mt-1 text-xs text-zinc-550">
								{todayDateKey()}
							</p>
						</div>

						<div class="mb-4">
							<p class="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-400">Mood</p>
							<div class="flex items-center gap-4">
								<span class="text-lg font-bold text-zinc-100 min-w-[2rem] text-center tabular-nums">
									{habitsHappiness}
								</span>
								<input
									type="range"
									min="1"
									max="5"
									step="1"
									bind:value={habitsHappiness}
									class="h-2 flex-1 cursor-pointer appearance-none rounded-full bg-gradient-to-r from-red-500 via-amber-400 to-emerald-400 accent-accent-500"
								/>
								<span class="text-xs font-semibold text-zinc-300 min-w-[4.5rem] text-right">
									{getHappinessLabel(habitsHappiness)}
								</span>
							</div>
						</div>

						<div class="space-y-3">
							<HabitsManager {habitsStore} userId={currentUser.uid} />
						</div>

						<div class="mt-4 flex items-center gap-4 pt-4 border-t border-zinc-800/60">
							<AppButton variant="primary" size="md" onclick={handleHabitsSave} disabled={habitsSaving} loading={habitsSaving}>
								{habitsSaving ? "Saving..." : "Save Today"}
							</AppButton>
							{#if habitsSaveMsg}
								<span class="text-sm {habitsSaveMsg === 'Saved!' ? 'text-emerald-400' : 'text-red-400'}">{habitsSaveMsg}</span>
							{/if}
							<a href="/habits/" class="ml-auto text-xs text-accent-400 hover:text-accent-300 underline">
								Full Check-in Page →
							</a>
						</div>
					</div>
				</div>
			{:else if currentSection === "journal"}
				<JournalEntryForm
					bind:this={journalEntryFormRef}
					{user}
					{mediaStore}
					{habitsStore}
					{loadJournalEntries}
				/>

				<EntryList
					items={journalEntries}
					loading={journalEntriesLoading}
					type="journal"
					onEdit={(entry) =>
						journalEntryFormRef?.startEditJournal(
							entry as JournalEntry,
						)}
					onDelete={(entry) =>
						handleDeleteJournal(entry as JournalEntry)}
					error={journalEntriesLoadError}
					onLoadMore={loadMoreJournalEntries}
					hasMore={journalEntriesHasMore}
					loadingMore={journalEntriesLoadingMore}
				/>
			{:else if currentSection === "blogs"}
				<BlogPostForm
					bind:this={blogPostFormRef}
					{mediaStore}
					{loadPosts}
				/>

				<EntryList
					items={posts}
					loading={postsLoading}
					type="blog"
					onEdit={(post) =>
						blogPostFormRef?.startEdit(post as BlogPost)}
					onDelete={(post) => handleDelete(post as BlogPost)}
					onLoadMore={loadMorePosts}
					hasMore={postsHasMore}
					loadingMore={postsLoadingMore}
					onStatusFilterChange={handlePostsStatusFilterChange}
				/>
			{:else if currentSection === "insights"}
				<InsightsDashboard {user} {insightsStore} />
			{/if}
		</div>
	</div>
{/if}

<ConfirmDialog
	bind:show={showConfirm}
	title={confirmTitle}
	message={confirmMessage}
	variant={confirmVariant}
	onConfirm={confirmAction}
/>
