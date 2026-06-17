<script lang="ts">
	import { goto } from "$app/navigation";
	import { subscribeToAuth, logout } from "$lib/firebase/auth";
	import {
		getPosts,
		deletePost,
		type BlogPost,
		getJournalEntries,
		deleteJournalEntry,
		type JournalEntry,
	} from "$lib/firebase/firestore.svelte";
	import type { User } from "firebase/auth";
	import { createInsightsStore } from "$lib/firebase/insights.svelte";
	import { createMediaStore } from "$lib/firebase/media.svelte";
	import { createHabitsStore } from "$lib/firebase/habits.svelte";
	import { formatDate } from "$lib/utils/date";
	import BlogPostForm from "./BlogPostForm.svelte";
	import JournalEntryForm from "./JournalEntryForm.svelte";
	import InsightsDashboard from "./InsightsDashboard.svelte";

	let user = $state<User | null>(null);
	let authReady = $state(false);

	const insightsStore = createInsightsStore();
	const mediaStore = createMediaStore();
	const habitsStore = createHabitsStore();

	let blogPostFormRef = $state<ReturnType<typeof BlogPostForm>>();
	let journalEntryFormRef = $state<ReturnType<typeof JournalEntryForm>>();

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
		}
	});

	let posts = $state<BlogPost[]>([]);
	let postsLoading = $state(false);

	let currentSection = $state<"blogs" | "journal" | "insights">("blogs");
	let journalEntries = $state<JournalEntry[]>([]);
	let journalEntriesLoading = $state(false);
	let journalEntriesLoadError = $state("");

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

	async function handleDeleteJournal(entry: JournalEntry) {
		if (!confirm(`Are you sure you want to delete this journal entry?`)) {
			return;
		}
		try {
			await deleteJournalEntry(entry.id);
			if (journalEntryFormRef?.isEditing(entry.id)) {
				journalEntryFormRef.resetJournalForm();
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

	async function handleDelete(post: BlogPost) {
		if (!confirm(`Are you sure you want to delete "${post.title}"?`)) {
			return;
		}
		try {
			await deletePost(post.id);
			if (blogPostFormRef?.isEditing(post.id)) {
				blogPostFormRef.resetForm();
			}
			await loadPosts();
		} catch (err: unknown) {
			alert(
				err instanceof Error ? err.message : "Failed to delete post.",
			);
		}
	}

	async function handleLogout() {
		await logout();
		goto("/admin/login/");
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
					bind:this={blogPostFormRef}
					{mediaStore}
					{loadPosts}
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
						<p class="text-xs text-zinc-550 mb-3">
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
						<p class="text-center py-10 text-zinc-650 text-sm">
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
												onclick={() =>
													blogPostFormRef?.startEdit(
														post,
													)}
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
					bind:this={journalEntryFormRef}
					{user}
					{mediaStore}
					{habitsStore}
					{loadJournalEntries}
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
						<p class="text-xs text-zinc-550 mb-3">
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
								class="text-[10px] text-zinc-550 leading-normal pt-1"
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
													journalEntryFormRef?.startEditJournal(
														entry,
													)}
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
				<InsightsDashboard {user} {insightsStore} />
			{/if}
		</div>
	</div>
{/if}
