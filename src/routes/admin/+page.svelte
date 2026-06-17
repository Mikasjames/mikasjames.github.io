<script lang="ts">
	import { onMount, tick } from "svelte";
	import { goto } from "$app/navigation";
	import CoverImage from "$lib/components/CoverImage.svelte";
	import { subscribeToAuth, logout } from "$lib/firebase/auth";
	import {
		getPosts,
		deletePost,
		deleteMediaItem,
		type BlogPost,
		type ImageMeta,
		type MediaItem,
		getJournalEntries,
		deleteJournalEntry,
		type JournalEntry,
	} from "$lib/firebase/firestore.svelte";
	import {
		removeImageReferencesFromMarkdown,
		sanitizeImageMetaFromMarkdown,
		extractImageUrlsFromMarkdown,
	} from "$lib/utils/imageMeta";
	import { deleteImage } from "$lib/firebase/storage";
	import type { User } from "firebase/auth";
	import MediaGalleryDialog from "$lib/components/MediaGalleryDialog.svelte";
	import { createInsightsStore } from "$lib/firebase/insights.svelte";
	import { createMediaStore } from "$lib/firebase/media.svelte";
	import { createHabitsStore } from "$lib/firebase/habits.svelte";
	import BlogPostForm from "./BlogPostForm.svelte";
	import JournalEntryForm from "./JournalEntryForm.svelte";

	let user = $state<User | null>(null);
	let authReady = $state(false);

	const insightsStore = createInsightsStore();
	const mediaStore = createMediaStore();
	const habitsStore = createHabitsStore();

	$effect(() => {
		const unsub = subscribeToAuth((u) => {
			user = u;
			authReady = true;
			if (!u) goto("/admin/login/");
		});
		return unsub;
	});

	let posts = $state<BlogPost[]>([]);
	let postsLoading = $state(false);

	let blogForm = $state({
		id: null as string | null,
		title: "",
		slug: "",
		excerpt: "",
		content: "",
		status: "published" as "draft" | "published" | "unlisted",
		coverImage: null as string | null,
		imageMeta: {} as Record<string, ImageMeta>,
		slugManuallyEdited: false,
		submitting: false,
		successMsg: "",
		error: "",
		coverUploading: false,
		coverError: "",
	});

	let journalForm = $state({
		id: null as string | null,
		title: "",
		excerpt: "",
		content: "",
		coverImage: null as string | null,
		imageMeta: {} as Record<string, ImageMeta>,
		happinessRating: 3,
		submitting: false,
		successMsg: "",
		error: "",
		coverUploading: false,
		coverError: "",
	});

	let showMediaGallery = $state(false);

	let currentSection = $state<"blogs" | "journal" | "insights">("blogs");
	let journalEntries = $state<JournalEntry[]>([]);
	let journalEntriesLoading = $state(false);
	let journalEntriesLoadError = $state("");

	let selectedJournalEntryDate = $state<string | null>(null);

	let blogSearch = $state("");
	let blogStatusFilter = $state<"all" | "published" | "unlisted" | "draft">(
		"all",
	);
	let blogSort = $state<"newest" | "oldest">("newest");

	let journalSearch = $state("");
	let journalSort = $state<"newest" | "oldest">("newest");


	let filteredPosts = $derived.by(() => {
		let result = posts;
		if (blogSearch.trim()) {
			const q = blogSearch.toLowerCase();
			const primaryMatches = result.filter(
				(p) =>
					p.title.toLowerCase().includes(q) ||
					p.slug.toLowerCase().includes(q) ||
					p.excerpt.toLowerCase().includes(q),
			);
			result =
				primaryMatches.length > 0
					? primaryMatches
					: result.filter((p) => p.content.toLowerCase().includes(q));
		}
		if (blogStatusFilter !== "all") {
			result = result.filter((p) => p.status === blogStatusFilter);
		}
		return blogSort === "oldest"
			? [...result].sort(
					(a, b) =>
						(a.createdAt?.getTime() ?? 0) -
						(b.createdAt?.getTime() ?? 0),
				)
			: result;
	});

	let filteredJournals = $derived.by(() => {
		let result = journalEntries;
		if (journalSearch.trim()) {
			const q = journalSearch.toLowerCase();
			const primaryMatches = result.filter(
				(e) =>
					e.title.toLowerCase().includes(q) ||
					(e.excerpt ?? "").toLowerCase().includes(q),
			);
			result =
				primaryMatches.length > 0
					? primaryMatches
					: result.filter((e) => e.content.toLowerCase().includes(q));
		}
		return journalSort === "oldest"
			? [...result].sort(
					(a, b) =>
						(a.createdAt?.getTime() ?? 0) -
						(b.createdAt?.getTime() ?? 0),
				)
			: result;
	});

	function getHappinessLabel(rating: number) {
		if (rating <= 1) return "Very low";
		if (rating === 2) return "Low";
		if (rating === 3) return "Steady";
		if (rating === 4) return "Good";
		return "Great";
	}

	async function loadPosts() {
		postsLoading = true;
		try {
			posts = await getPosts();
		} finally {
			postsLoading = false;
		}
	}

	async function loadJournalEntries() {
		journalEntriesLoading = true;
		journalEntriesLoadError = "";
		try {
			journalEntries = await getJournalEntries();
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

	function todayDateKey() {
		return new Date().toLocaleDateString("en-CA");
	}

	function dateKeyFromDate(date: Date | null | undefined) {
		return date ? date.toLocaleDateString("en-CA") : todayDateKey();
	}

	onMount(async () => {
		await new Promise<void>((res) => {
			const check = setInterval(() => {
				if (authReady) {
					clearInterval(check);
					res();
				}
			}, 50);
		});
		if (user) {
			await loadPosts();
			await mediaStore.loadRecentMedia();
			await loadJournalEntries();
			await habitsStore.loadHabits(user.uid);
			await insightsStore.loadLatest(user.uid);
		}
	});

	async function startEditJournal(entry: JournalEntry) {
		journalForm.id = entry.id;
		journalForm.title = entry.title;
		journalForm.excerpt = entry.excerpt || "";
		journalForm.content = entry.content;
		journalForm.coverImage = entry.coverImage || null;
		journalForm.happinessRating = entry.happinessRating ?? 3;
		selectedJournalEntryDate = dateKeyFromDate(entry.createdAt);
		habitsStore.selectedHabitIds = new Set();
		journalForm.imageMeta = sanitizeImageMetaFromMarkdown(
			entry.content,
			enrichImageMetaFromGallery(entry.content, entry.imageMeta ?? {}),
		);
		journalForm.successMsg = "";
		journalForm.error = "";
		await habitsStore.loadSelectedHabitLogs(user!.uid, entry.id, journalForm.id);
		window.scrollTo({ top: 0, behavior: "smooth" });
	}

	function resetJournalForm() {
		journalForm.id = null;
		journalForm.title = "";
		journalForm.excerpt = "";
		journalForm.content = "";
		journalForm.coverImage = null;
		journalForm.imageMeta = {};
		journalForm.happinessRating = 3;
		journalForm.successMsg = "";
		journalForm.error = "";
		selectedJournalEntryDate = null;
		habitsStore.selectedHabitIds = new Set();
	}

	async function handleDeleteJournal(entry: JournalEntry) {
		if (!confirm(`Are you sure you want to delete this journal entry?`)) {
			return;
		}
		try {
			await deleteJournalEntry(entry.id);
			if (journalForm.id === entry.id) {
				resetJournalForm();
			}
			await loadJournalEntries();
		} catch (err: unknown) {
			alert(
				err instanceof Error
					? err.message
					: "Failed to delete journal entry.",
			);
		}
	}

	function enrichImageMetaFromGallery(
		markdown: string,
		currentImageMeta: Record<string, ImageMeta>,
	): Record<string, ImageMeta> {
		const urls = extractImageUrlsFromMarkdown(markdown);
		return urls.reduce(
			(acc, url) => {
				if (currentImageMeta[url]) {
					acc[url] = currentImageMeta[url];
					return acc;
				}

				const media = mediaStore.mediaItems.find((item) => item.url === url);
				if (media?.width && media?.height) {
					acc[url] = {
						width: media.width,
						height: media.height,
					};
				}
				return acc;
			},
			{} as Record<string, ImageMeta>,
		);
	}

	function startEdit(post: BlogPost) {
		blogForm.id = post.id;
		blogForm.title = post.title;
		blogForm.slug = post.slug;
		blogForm.excerpt = post.excerpt;
		blogForm.content = post.content;
		blogForm.coverImage = post.coverImage;
		blogForm.status = post.status ?? "published";
		blogForm.imageMeta = sanitizeImageMetaFromMarkdown(
			post.content,
			enrichImageMetaFromGallery(post.content, post.imageMeta ?? {}),
		);
		blogForm.slugManuallyEdited = true;
		blogForm.successMsg = "";
		blogForm.error = "";
		window.scrollTo({ top: 0, behavior: "smooth" });
	}

	function resetForm() {
		blogForm.id = null;
		blogForm.title = "";
		blogForm.slug = "";
		blogForm.excerpt = "";
		blogForm.content = "";
		blogForm.coverImage = null;
		blogForm.status = "published";
		blogForm.imageMeta = {};
		blogForm.slugManuallyEdited = false;
		blogForm.successMsg = "";
		blogForm.error = "";
	}

	async function handleDelete(post: BlogPost) {
		if (!confirm(`Are you sure you want to delete "${post.title}"?`)) {
			return;
		}
		try {
			await deletePost(post.id);
			if (blogForm.id === post.id) {
				resetForm();
			}
			await loadPosts();
		} catch (err: unknown) {
			alert(
				err instanceof Error ? err.message : "Failed to delete post.",
			);
		}
	}

	async function handleDeleteMediaWrapper(item: MediaItem) {
		await mediaStore.handleDeleteMedia(item, (url) => {
			blogForm.imageMeta = { ...blogForm.imageMeta };
			delete blogForm.imageMeta[url];
			journalForm.imageMeta = { ...journalForm.imageMeta };
			delete journalForm.imageMeta[url];
			blogForm.content = removeImageReferencesFromMarkdown(
				blogForm.content,
				url,
			);
			journalForm.content = removeImageReferencesFromMarkdown(
				journalForm.content,
				url,
			);
		});
	}

	let galleryInsertionCallback = $state<((url: string, alt: string, dims?: any) => void) | null>(null);
	let galleryCoverCallback = $state<((url: string | null) => void) | null>(null);

	async function openMediaGallery(insertCb?: any, coverCb?: any) {
		galleryInsertionCallback = insertCb || null;
		galleryCoverCallback = coverCb || null;
		showMediaGallery = true;
		await mediaStore.openMediaGallery();
	}

	function copyToClipboard(text: string) {
		navigator.clipboard.writeText(text).then(() => {
			alert("Copied markdown image tag to clipboard!");
		});
	}

	async function handleLogout() {
		await logout();
		goto("/admin/login/");
	}

	function formatDate(d: Date | null) {
		if (!d) return "—";
		return d.toLocaleDateString("en-US", {
			year: "numeric",
			month: "short",
			day: "numeric",
		});
	}
</script>

<svelte:head>
	<title>Admin Dashboard · Mikas James</title>
	<meta name="robots" content="noindex, nofollow" />
</svelte:head>

{#if !authReady}
	<div class="min-h-screen bg-[#09090b] flex items-center justify-center">
		<div
			class="w-6 h-6 border-2 border-accent-500/30 border-t-accent-500 rounded-full animate-spin"
		></div>
	</div>
{:else if user}
	<div
		class="min-h-screen bg-[#09090b] px-3 pt-16 pb-12 sm:px-4 sm:pt-20 sm:pb-16 lg:px-6"
	>
		<div
			class="fixed inset-0 bg-[linear-gradient(rgba(99,102,241,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(99,102,241,0.03)_1px,transparent_1px)] bg-[size:64px_64px] pointer-events-none"
		></div>

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
					<a
						href={currentSection === "blogs"
							? "/blogs/"
							: "/journal/"}
						class="rounded-lg border border-zinc-700/60 px-3 py-2 text-center text-sm font-medium text-zinc-400 transition-all duration-200 hover:border-zinc-600 hover:text-zinc-200 sm:px-4"
					>
						View {currentSection === "blogs" ? "Blog" : "Journal"}
					</a>
					<button
						id="admin-logout-btn"
						onclick={handleLogout}
						class="rounded-lg bg-zinc-800 px-3 py-2 text-sm font-medium text-zinc-300 transition-all duration-200 hover:bg-zinc-700 sm:px-4"
					>
						Sign Out
					</button>
				</div>
			</div>

			<div
				class="flex gap-5 overflow-x-auto border-b border-zinc-800/40 sm:gap-6"
			>
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

			{#if currentSection === "blogs"}
				<BlogPostForm
					bind:blogForm
					{mediaStore}
					{loadPosts}
					{resetForm}
					{openMediaGallery}
				/>

				<section
					class="bg-surface-900/80 rounded-xl border border-zinc-800/60 p-4 shadow-2xl shadow-black/40 backdrop-blur-md sm:rounded-2xl sm:p-5 md:p-8"
				>
					<div
						class="mb-5 grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]"
					>
						<div class="relative w-full sm:flex-1 sm:min-w-[180px]">
							<svg
								class="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500"
								fill="none"
								stroke="currentColor"
								viewBox="0 0 24 24"
							>
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
								/>
							</svg>
							<input
								type="text"
								bind:value={blogSearch}
								placeholder="Search posts…"
								class="w-full pl-9 pr-3.5 py-2 rounded-lg bg-zinc-900 border border-zinc-700/60 text-zinc-100 text-sm placeholder-zinc-600 focus:outline-none focus:border-accent-500 focus:ring-1 focus:ring-accent-500/30 transition-all"
							/>
						</div>
						<div
							class="grid w-full grid-cols-1 gap-3 min-[420px]:grid-cols-2 md:w-auto"
						>
							<select
								bind:value={blogStatusFilter}
								class="w-full rounded-lg border border-zinc-700/60 bg-zinc-900 px-3 py-2 text-sm text-zinc-300 transition-all focus:border-accent-500 focus:outline-none md:w-auto"
							>
								<option value="all">All statuses</option>
								<option value="published">Published</option>
								<option value="unlisted">Unlisted</option>
								<option value="draft">Draft</option>
							</select>
							<select
								bind:value={blogSort}
								class="w-full rounded-lg border border-zinc-700/60 bg-zinc-900 px-3 py-2 text-sm text-zinc-300 transition-all focus:border-accent-500 focus:outline-none md:w-auto"
							>
								<option value="newest">Newest first</option>
								<option value="oldest">Oldest first</option>
							</select>
						</div>
					</div>

					{#if blogSearch || blogStatusFilter !== "all"}
						<p class="text-xs text-zinc-500 mb-3">
							{filteredPosts.length} of {posts.length} posts
						</p>
					{/if}

					{#if postsLoading}
						<div
							class="flex items-center justify-center py-10 gap-3 text-zinc-500 text-sm"
						>
							<div
								class="w-4 h-4 border-2 border-zinc-700 border-t-zinc-400 rounded-full animate-spin"
							></div>
							Loading posts…
						</div>
					{:else if filteredPosts.length === 0}
						<p class="text-center py-10 text-zinc-600 text-sm">
							No posts yet. Publish your first one above!
						</p>
					{:else}
						<div class="space-y-2">
							{#each filteredPosts as post (post.id)}
								<div
									class="flex flex-col gap-3 rounded-lg border border-zinc-800/40 bg-zinc-900/60 px-3 py-3 transition-all duration-200 hover:border-zinc-700/60 sm:flex-row sm:items-center sm:gap-4 sm:px-4"
								>
									<div
										class="flex min-w-0 flex-1 items-center gap-3"
									>
										{#if post.coverImage}
											<img
												src={post.coverImage}
												alt=""
												class="w-10 h-7 object-cover rounded bg-zinc-950 border border-zinc-800 shrink-0"
											/>
										{:else}
											<div
												class="w-10 h-7 rounded bg-zinc-850 border border-zinc-800 flex items-center justify-center shrink-0"
											>
												<svg
													class="w-3.5 h-3.5 text-zinc-600"
													fill="none"
													stroke="currentColor"
													viewBox="0 0 24 24"
												>
													<path
														stroke-linecap="round"
														stroke-linejoin="round"
														stroke-width="2"
														d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
													/>
												</svg>
											</div>
										{/if}

										<div class="flex-1 min-w-0">
											<div
												class="flex items-center gap-2 flex-wrap"
											>
												<p
													class="text-sm font-medium text-zinc-200 truncate"
												>
													{post.title}
												</p>
												{#if post.status === "draft"}
													<span
														class="px-1.5 py-0.5 rounded bg-zinc-800 text-[10px] font-medium text-zinc-450 border border-zinc-700/50 uppercase tracking-wider font-mono shrink-0"
														>Draft</span
													>
												{:else if post.status === "unlisted"}
													<span
														class="px-1.5 py-0.5 rounded bg-amber-500/10 text-[10px] font-medium text-amber-400 border border-amber-500/20 uppercase tracking-wider font-mono shrink-0"
														>Unlisted</span
													>
												{:else}
													<span
														class="px-1.5 py-0.5 rounded bg-emerald-500/10 text-[10px] font-medium text-emerald-400 border border-emerald-500/20 uppercase tracking-wider font-mono shrink-0"
														>Published</span
													>
												{/if}
											</div>
											<p
												class="text-xs text-zinc-650 font-mono mt-0.5 truncate"
											>
												/blogs/{post.slug}
											</p>
										</div>
									</div>

									<div
										class="flex flex-wrap items-center justify-between gap-2 pl-[3.25rem] sm:ml-auto sm:flex-col sm:items-end sm:justify-center sm:gap-1 sm:pl-0"
									>
										<span
											class="text-xs text-zinc-600 whitespace-nowrap"
											>{formatDate(post.createdAt)}</span
										>
										<div
											class="flex flex-wrap items-center justify-end gap-x-3 gap-y-1 sm:shrink-0"
										>
											<a
												href="/blogs/{post.slug}/"
												target="_blank"
												class="text-xs text-zinc-400 hover:text-zinc-200 transition-colors font-medium"
											>
												View
											</a>
											<button
												type="button"
												onclick={() => startEdit(post)}
												class="text-xs text-accent-400 hover:text-accent-300 transition-colors font-medium"
											>
												Edit
											</button>
											<button
												type="button"
												onclick={() =>
													handleDelete(post)}
												class="text-xs text-red-400 hover:text-red-300 transition-colors font-medium"
											>
												Delete
											</button>
										</div>
									</div>
								</div>
							{/each}
						</div>
					{/if}
				</section>
			{:else if currentSection === "journal"}
				<JournalEntryForm
					bind:journalForm
					{user}
					{mediaStore}
					{habitsStore}
					{loadJournalEntries}
					{resetJournalForm}
					{openMediaGallery}
					{todayDateKey}
					{getHappinessLabel}
					bind:selectedJournalEntryDate
				/>

				<section
					class="bg-surface-900/80 rounded-xl border border-zinc-800/60 p-4 shadow-2xl shadow-black/40 backdrop-blur-md sm:rounded-2xl sm:p-5 md:p-8"
				>
					<div
						class="mb-5 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]"
					>
						<div class="relative w-full sm:flex-1 sm:min-w-[180px]">
							<svg
								class="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500"
								fill="none"
								stroke="currentColor"
								viewBox="0 0 24 24"
							>
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
								/>
							</svg>
							<input
								type="text"
								bind:value={journalSearch}
								placeholder="Search entries…"
								class="w-full pl-9 pr-3.5 py-2 rounded-lg bg-zinc-900 border border-zinc-700/60 text-zinc-100 text-sm placeholder-zinc-600 focus:outline-none focus:border-accent-500 focus:ring-1 focus:ring-accent-500/30 transition-all"
							/>
						</div>
						<select
							bind:value={journalSort}
							class="w-full rounded-lg border border-zinc-700/60 bg-zinc-900 px-3 py-2 text-sm text-zinc-300 transition-all focus:border-accent-500 focus:outline-none sm:w-auto"
						>
							<option value="newest">Newest first</option>
							<option value="oldest">Oldest first</option>
						</select>
					</div>

					{#if journalSearch}
						<p class="text-xs text-zinc-500 mb-3">
							{filteredJournals.length} of {journalEntries.length}
							entries
						</p>
					{/if}

					{#if journalEntriesLoading}
						<div
							class="flex items-center justify-center py-10 gap-3 text-zinc-500 text-sm"
						>
							<div
								class="w-4 h-4 border-2 border-zinc-700 border-t-zinc-400 rounded-full animate-spin"
							></div>
							Loading journal entries…
						</div>
					{:else if journalEntriesLoadError}
						<div
							class="p-4 rounded-lg bg-red-950/20 border border-red-900/30 text-red-400 text-xs space-y-1"
						>
							<p class="font-semibold">Journal Load Failed:</p>
							<p class="text-zinc-405 leading-normal">
								{journalEntriesLoadError}
							</p>
							<p
								class="text-[10px] text-zinc-500 leading-normal pt-1"
							>
								Please ensure your Firestore Security Rules
								permit authenticated read access to the <code
									class="bg-zinc-900 px-1 py-0.5 rounded text-red-300"
									>journal</code
								>
								collection for your Owner UID.
							</p>
						</div>
					{:else if filteredJournals.length === 0}
						<p class="text-center py-10 text-zinc-650 text-sm">
							No journal entries found. Write your first entry
							above!
						</p>
					{:else}
						<div class="space-y-2">
							{#each filteredJournals as entry (entry.id)}
								<div
									class="flex flex-col gap-3 rounded-lg border border-zinc-800/40 bg-zinc-900/60 px-3 py-3 transition-all duration-200 hover:border-zinc-700/60 sm:flex-row sm:items-center sm:gap-4 sm:px-4"
								>
									<div class="flex-1 min-w-0">
										<p
											class="text-sm font-medium text-zinc-200 truncate"
										>
											{entry.title || "Untitled Entry"}
										</p>
										<p
											class="text-xs text-zinc-500 font-mono mt-0.5 truncate"
										>
											{entry.excerpt ||
												entry.content.substring(
													0,
													80,
												)}{!entry.excerpt &&
											entry.content.length > 80
												? "..."
												: ""}
										</p>
									</div>

									<div
										class="flex flex-wrap items-center justify-between gap-2 sm:ml-auto sm:flex-col sm:items-end sm:justify-center sm:gap-1"
									>
										<span
											class="text-xs text-zinc-600 whitespace-nowrap"
											>{formatDate(entry.createdAt)}</span
										>
										<div
											class="flex flex-wrap items-center justify-end gap-x-3 gap-y-1 sm:shrink-0"
										>
											<button
												type="button"
												onclick={() =>
													startEditJournal(entry)}
												class="text-xs text-accent-400 hover:text-accent-300 transition-colors font-medium cursor-pointer"
											>
												Edit
											</button>
											<button
												type="button"
												onclick={() =>
													handleDeleteJournal(entry)}
												class="text-xs text-red-400 hover:text-red-300 transition-colors font-medium cursor-pointer"
											>
												Delete
											</button>
										</div>
									</div>
								</div>
							{/each}
						</div>
					{/if}
				</section>
			{:else if currentSection === "insights"}
				<section class="space-y-5">
					<div
						class="rounded-xl border border-zinc-800/60 bg-surface-900/80 p-4 shadow-2xl shadow-black/40 backdrop-blur-md sm:rounded-2xl sm:p-5 md:p-8"
					>
						<div
							class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
						>
							<div
								class="flex items-center justify-center gap-3 sm:justify-start"
							>
								<button
									type="button"
									onclick={() =>
										insightsStore.loadPeriod(
											user!.uid,
											insightsStore.shiftPeriod(
												insightsStore.selectedPeriod ||
													insightsStore.currentPeriodKey(),
												-1,
											),
										)}
									class="rounded-lg border border-zinc-700/60 bg-zinc-900 px-3 py-2 text-sm text-zinc-300 transition hover:border-accent-500/50 hover:text-accent-300"
								>
									←
								</button>
								<p
									class="min-w-40 text-center text-sm font-semibold text-zinc-100"
								>
									{insightsStore.formatInsightPeriod(
										insightsStore.selectedPeriod ||
											insightsStore.currentPeriodKey(),
									)}
								</p>
								<button
									type="button"
									onclick={() =>
										insightsStore.loadPeriod(
											user!.uid,
											insightsStore.shiftPeriod(
												insightsStore.selectedPeriod ||
													insightsStore.currentPeriodKey(),
												1,
											),
										)}
									class="rounded-lg border border-zinc-700/60 bg-zinc-900 px-3 py-2 text-sm text-zinc-300 transition hover:border-accent-500/50 hover:text-accent-300"
								>
									→
								</button>
							</div>
							<div
								class="grid grid-cols-2 rounded-lg border border-zinc-800/70 bg-zinc-950/40 p-1"
							>
								<button
									type="button"
									onclick={() => (insightsStore.tab = "monthly")}
									class="rounded-md px-3 py-1.5 text-xs font-semibold transition {insightsStore.tab ===
									'monthly'
										? 'bg-accent-600 text-white'
										: 'text-zinc-400 hover:text-zinc-200'}"
								>
									This Month
								</button>
								<button
									type="button"
									onclick={() => (insightsStore.tab = "yearToDate")}
									class="rounded-md px-3 py-1.5 text-xs font-semibold transition {insightsStore.tab ===
									'yearToDate'
										? 'bg-accent-600 text-white'
										: 'text-zinc-400 hover:text-zinc-200'}"
								>
									Year to Date
								</button>
							</div>
						</div>

						{#if insightsStore.selectedPeriod === insightsStore.currentPeriodKey()}
							<div
								class="mt-4 rounded-lg border border-accent-500/20 bg-accent-500/10 px-4 py-3 text-sm text-accent-200"
							>
								This month's insights will be ready on {insightsStore.nextMonthReadyLabel()}.
							</div>
						{/if}

						{#if insightsStore.loading}
							<div
								class="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
							>
								{#each Array(4) as _}
									<div
										class="h-24 animate-pulse rounded-xl border border-zinc-800/60 bg-zinc-900/60"
									></div>
								{/each}
							</div>
						{:else if insightsStore.error}
							<p
								class="mt-6 rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400"
							>
								{insightsStore.error}
							</p>
						{:else}
							<div
								class="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
							>
								<div
									class="rounded-xl border border-zinc-800/60 bg-zinc-900/60 p-4"
								>
									<p class="text-2xl font-bold text-zinc-100">
										{typeof insightsStore.selectedScope?.averageRating ===
										"number"
											? `${insightsStore.selectedScope.averageRating.toFixed(1)} / 5`
											: "—"}
									</p>
									<p
										class="mt-1 text-xs uppercase tracking-wide text-zinc-500"
									>
										Avg Happiness
									</p>
									<p class="mt-2 text-xs text-accent-300">
										{insightsStore.trendLabel(
											insightsStore.selectedScope?.trendSlopePerDay,
										)}
									</p>
								</div>
								<div
									class="rounded-xl border border-zinc-800/60 bg-zinc-900/60 p-4"
								>
									<p class="text-2xl font-bold text-zinc-100">
										{insightsStore.selectedScope?.entryCount ?? 0}
									</p>
									<p
										class="mt-1 text-xs uppercase tracking-wide text-zinc-500"
									>
										Total Entries
									</p>
								</div>
								<div
									class="rounded-xl border border-zinc-800/60 bg-zinc-900/60 p-4"
								>
									<p class="text-2xl font-bold text-zinc-100">
										{insightsStore.selectedScope?.streaks
											?.longestHighDays ?? 0}
									</p>
									<p
										class="mt-1 text-xs uppercase tracking-wide text-zinc-500"
									>
										Longest High Streak
									</p>
								</div>
								<div
									class="rounded-xl border border-zinc-800/60 bg-zinc-900/60 p-4"
								>
									<p class="text-2xl font-bold text-zinc-100">
										{insightsStore.selectedScope?.streaks
											?.longestLowDays ?? 0}
									</p>
									<p
										class="mt-1 text-xs uppercase tracking-wide text-zinc-500"
									>
										Longest Low Streak
									</p>
								</div>
							</div>

							<div
								class="mt-5 rounded-xl border border-zinc-800/60 bg-zinc-900/50 p-4"
							>
								<p
									class="mb-3 text-sm font-semibold text-zinc-200"
								>
									Daily Ratings
								</p>
								{#if insightsStore.selectedScope?.dailyRatings?.length}
									<svg
										viewBox="0 0 640 220"
										class="h-56 w-full overflow-visible"
									>
										<line
											x1="24"
											x2="616"
											y1="122"
											y2="122"
											stroke="currentColor"
											class="text-zinc-700"
											stroke-dasharray="4 6"
										/>
										<path
											d={insightsStore.chartPoints(
												insightsStore.selectedScope.dailyRatings,
											)}
											fill="none"
											stroke="currentColor"
											class="text-accent-500"
											stroke-width="3"
											stroke-linecap="round"
											stroke-linejoin="round"
										/>
										{#each insightsStore.selectedScope.dailyRatings as point}
											<circle
												cx={insightsStore.selectedScope
													.dailyRatings.length === 1
													? 320
													: 24 +
														((point.time -
															insightsStore.selectedScope
																.dailyRatings[0]
																.time) /
															(insightsStore.selectedScope
																.dailyRatings[
																insightsStore.selectedScope
																	.dailyRatings
																	.length - 1
															].time -
																insightsStore.selectedScope
																	.dailyRatings[0]
																	.time)) *
															592}
												cy={24 +
													((5 - point.rating) / 4) *
														172}
												r="3"
												fill="currentColor"
												class="text-accent-300"
											/>
										{/each}
									</svg>
								{:else}
									<p
										class="py-8 text-center text-sm text-zinc-550"
									>
										No daily ratings for this scope.
									</p>
								{/if}
							</div>

							<div
								class="mt-5 rounded-xl border border-zinc-800/60 bg-zinc-900/50 p-4"
							>
								<p
									class="mb-3 text-sm font-semibold text-zinc-200"
								>
									Groq Insights
								</p>
								{#if insightsStore.selectedScope?.textAnalysis?.source === "groq-api" && insightsStore.selectedResult}
									{#if insightsStore.selectedResult.briefSummary}
										<blockquote
											class="rounded-lg border-l-2 border-accent-500 bg-accent-500/10 px-4 py-3 text-sm text-accent-100"
										>
											"{insightsStore.selectedResult.briefSummary}"
										</blockquote>
									{/if}
									<div class="mt-4 flex flex-wrap gap-2">
										{#if insightsStore.selectedResult.overallSentiment}
											<span
												class="rounded-full border border-zinc-700/60 bg-zinc-950/50 px-2.5 py-1 text-xs text-zinc-300"
												>{insightsStore.selectedResult.overallSentiment}</span
											>
										{/if}
										{#if insightsStore.selectedResult.primaryEmotion}
											<span
												class="rounded-full border border-accent-500/20 bg-accent-500/10 px-2.5 py-1 text-xs text-accent-300"
												>{insightsStore.selectedResult.primaryEmotion}</span
											>
										{/if}
									</div>
									{#if insightsStore.selectedResult.keyThemes?.length}
										<div class="mt-4 flex flex-wrap gap-2">
											{#each insightsStore.selectedResult.keyThemes as theme}
												<span
													class="rounded bg-zinc-800/80 px-2 py-1 text-xs text-zinc-300"
													>{theme}</span
												>
											{/each}
										</div>
									{/if}
									{#if insightsStore.selectedResult.patterns?.length}
										<ul
											class="mt-4 list-disc space-y-1 pl-5 text-sm text-zinc-350"
										>
											{#each insightsStore.selectedResult.patterns as pattern}
												<li>{pattern}</li>
											{/each}
										</ul>
									{/if}
									{#if insightsStore.selectedResult.ratingCorrelations?.length}
										<div class="mt-4 overflow-x-auto">
											<table
												class="w-full text-left text-xs"
											>
												<thead class="text-zinc-500">
													<tr
														><th class="py-2"
															>Factor</th
														><th class="py-2"
															>Impact</th
														><th class="py-2"
															>Avg Rating</th
														></tr
													>
												</thead>
												<tbody
													class="divide-y divide-zinc-800/70 text-zinc-300"
												>
													{#each insightsStore.selectedResult.ratingCorrelations as row}
														<tr
															><td class="py-2"
																>{row.factor}</td
															><td class="py-2"
																>{row.impact}</td
															><td class="py-2"
																>{row.averageRating}</td
															></tr
														>
													{/each}
												</tbody>
											</table>
										</div>
									{/if}
								{:else if insightsStore.selectedLocalAnalysis}
									<p
										class="rounded-lg border border-zinc-800/60 bg-zinc-950/40 px-4 py-3 text-sm text-zinc-500"
									>
										AI analysis unavailable for this period
										— showing keyword data only
									</p>
									<div class="mt-4 grid gap-4 md:grid-cols-2">
										<div>
											<p
												class="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500"
											>
												High-rated keywords
											</p>
											<div class="flex flex-wrap gap-2">
												{#each Object.entries(insightsStore.selectedLocalAnalysis.keywordFrequencyByRating?.highRated ?? {}) as [word, count]}
													<span
														class="rounded bg-accent-500/10 px-2 py-1 text-xs text-accent-300"
														>{word} {count}</span
													>
												{/each}
											</div>
										</div>
										<div>
											<p
												class="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500"
											>
												Low-rated keywords
											</p>
											<div class="flex flex-wrap gap-2">
												{#each Object.entries(insightsStore.selectedLocalAnalysis.keywordFrequencyByRating?.lowRated ?? {}) as [word, count]}
													<span
														class="rounded bg-zinc-800 px-2 py-1 text-xs text-zinc-300"
														>{word} {count}</span
													>
												{/each}
											</div>
										</div>
									</div>
									<div class="mt-4">
										<p class="mb-2 text-xs text-zinc-550">
											Lexical sentiment
										</p>
										<div
											class="h-2 rounded-full bg-zinc-800"
										>
											<div
												class="h-2 rounded-full bg-accent-500"
												style={`width: ${Math.min(100, Math.max(0, 50 + (insightsStore.selectedLocalAnalysis.sentimentVsRating?.lexicalSentimentScore ?? 0) * 5))}%`}
											></div>
										</div>
									</div>
								{/if}
							</div>

							{#if insightsStore.selectedScope?.habitCorrelations?.length}
								<div
									class="mt-5 rounded-xl border border-zinc-800/60 bg-zinc-900/50 p-4"
								>
									<p
										class="mb-3 text-sm font-semibold text-zinc-200"
									>
										Habit Correlations
									</p>
									<div class="grid gap-3 md:grid-cols-2">
										{#each insightsStore.selectedScope.habitCorrelations as correlation}
											<div
												class="rounded-xl border border-zinc-800/60 bg-zinc-950/30 p-4"
											>
												<div
													class="flex items-center justify-between gap-2"
												>
													<p
														class="font-semibold text-zinc-100"
													>
														{correlation.habitName}
													</p>
													<span
														class="text-[10px] font-mono text-zinc-500"
													>
														({correlation.completedDaysCount}
														vs {correlation.missedDaysCount}
														d)
													</span>
												</div>
												<div
													class="mt-3 space-y-2 text-xs text-zinc-400"
												>
													<div
														class="grid grid-cols-[8.5rem_minmax(0,1fr)_3rem] items-center gap-2"
													>
														<span
															>Completed days avg:</span
														>
														<div
															class="h-2 rounded-full bg-zinc-800"
														>
															<div
																class="h-2 rounded-full bg-accent-500"
																style={`width: ${insightsStore.ratingBarWidth(correlation.averageRatingOnCompletedDays)}`}
															></div>
														</div>
														<span
															class="text-zinc-300"
															>{correlation.averageRatingOnCompletedDays?.toFixed?.(
																1,
															) ?? "—"}</span
														>
													</div>
													<div
														class="grid grid-cols-[8.5rem_minmax(0,1fr)_3rem] items-center gap-2"
													>
														<span
															>Missed days avg:</span
														>
														<div
															class="h-2 rounded-full bg-zinc-800"
														>
															<div
																class="h-2 rounded-full bg-zinc-500"
																style={`width: ${insightsStore.ratingBarWidth(correlation.averageRatingOnMissedDays)}`}
															></div>
														</div>
														<span
															class="text-zinc-300"
															>{correlation.averageRatingOnMissedDays?.toFixed?.(
																1,
															) ?? "—"}</span
														>
													</div>
												</div>
												{#if correlation.insight}
													<p
														class="mt-3 text-sm text-zinc-350 italic"
													>
														"{correlation.insight}"
													</p>
												{/if}
											</div>
										{/each}
									</div>
								</div>
							{/if}

							{#if insightsStore.selectedScope?.habitSummary?.byHabit}
								<div
									class="mt-5 rounded-xl border border-zinc-800/60 bg-zinc-900/50 p-4"
								>
									<p
										class="mb-3 text-sm font-semibold text-zinc-200"
									>
										Habit Overview
									</p>
									<div class="space-y-4">
										{#each Object.entries(insightsStore.selectedScope.habitSummary.byHabit) as [habitId, habit]}
											<div>
												<div
													class="mb-2 flex items-center justify-between gap-3"
												>
													<p
														class="text-sm text-zinc-300"
													>
														{habit.name}
													</p>
													<p
														class="text-xs font-mono text-zinc-500"
													>
														{habit.count} / {insightsStore.daysInPeriod(
															insightsStore.selectedPeriod,
														)} days
													</p>
												</div>
												<div
													class="flex flex-wrap gap-1"
												>
													{#each Array(insightsStore.daysInPeriod(insightsStore.selectedPeriod)) as _, index}
														<span
															title={`${insightsStore.selectedPeriod}-${String(index + 1).padStart(2, "0")}`}
															class="h-2.5 w-2.5 rounded-full border {insightsStore.habitCompletedOnDate(
																habit.dates,
																index + 1,
															)
																? 'border-accent-500 bg-accent-500'
																: 'border-zinc-700 bg-transparent'}"
														></span>
													{/each}
												</div>
											</div>
										{/each}
									</div>
								</div>
							{/if}
						{/if}
					</div>
				</section>
			{/if}
		</div>
	</div>

	<MediaGalleryDialog
		bind:showMediaGallery
		mediaItems={mediaStore.mediaItems}
		mediaUploading={mediaStore.mediaUploading}
		mediaUploadError={mediaStore.mediaUploadError}
		handleGalleryUpload={(e: any) => mediaStore.handleGalleryUpload(e.target.files[0])}
		handleDeleteMedia={handleDeleteMediaWrapper}
		{copyToClipboard}
		insertMarkdownAtCursor={(url: string, alt: string, dims?: any) => {
			if (galleryInsertionCallback) galleryInsertionCallback(url, alt, dims);
		}}
		setEditorCoverImage={(url: string | null) => {
			if (galleryCoverCallback) galleryCoverCallback(url);
		}}
		mediaLoading={mediaStore.mediaLoading}
		deletingMediaIds={mediaStore.deletingMediaIds}
	/>
{/if}
