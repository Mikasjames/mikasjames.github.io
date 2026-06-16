<script lang="ts">
	import { onMount, onDestroy } from "svelte";
	import { goto } from "$app/navigation";
	import { subscribeToAuth, logout } from "$lib/firebase/auth";
	import {
		getJournalEntries,
		getHabitLogsForDates,
		type JournalEntry,
		type HabitLog,
	} from "$lib/firebase/firestore.svelte";
	import { renderMarkdown } from "$lib/utils/renderMarkdown";
	import type { User } from "firebase/auth";

	let user = $state<User | null>(null);
	let authReady = $state(false);
	let entries = $state<JournalEntry[]>([]);
	let loading = $state(true);
	let errorMsg = $state("");
	let searchQuery = $state("");
	let selectedEntryId = $state<string | null>(null);
	let habitLogsByDate = $state<Record<string, HabitLog[]>>({});

	const unsub = subscribeToAuth((u) => {
		user = u;
		authReady = true;
		if (!u) {
			goto("/admin/login/");
		}
	});
	onDestroy(unsub);

	async function loadJournal() {
		loading = true;
		errorMsg = "";
		try {
			entries = await getJournalEntries();
			if (user) {
				const dates = entries
					.map((entry) => entryDateKey(entry))
					.filter((date): date is string => Boolean(date));
				try {
					habitLogsByDate = await getHabitLogsForDates(user.uid, dates);
				} catch (habitErr) {
					console.warn("Habit logs unavailable:", habitErr);
					habitLogsByDate = {};
				}
			}
		} catch (err: unknown) {
			console.error("Error loading journal entries:", err);
			errorMsg = err instanceof Error ? err.message : "Failed to load journal entries. Check Firestore rules.";
		} finally {
			loading = false;
		}
	}

	onMount(async () => {
		// Wait for authentication state to be initialized
		await new Promise<void>((res) => {
			const check = setInterval(() => {
				if (authReady) {
					clearInterval(check);
					res();
				}
			}, 50);
		});
		if (user) {
			await loadJournal();
		}
	});

	const filteredEntries = $derived(
		entries.filter(entry => {
			const q = searchQuery.toLowerCase();
			return (
				entry.title.toLowerCase().includes(q) ||
				(entry.excerpt?.toLowerCase().includes(q) ?? false) ||
				entry.content.toLowerCase().includes(q)
			);
		})
	);

	const selectedEntry = $derived(
		entries.find(e => e.id === selectedEntryId) || null
	);

	function formatDate(d: Date | null) {
		if (!d) return "—";
		return d.toLocaleDateString("en-US", {
			weekday: "long",
			year: "numeric",
			month: "long",
			day: "numeric",
		});
	}

	function formatTime(d: Date | null) {
		if (!d) return "";
		return d.toLocaleTimeString("en-US", {
			hour: "2-digit",
			minute: "2-digit"
		});
	}

	function entryDateKey(entry: JournalEntry) {
		if (!entry.createdAt) return "";
		return entry.createdAt.toLocaleDateString("en-CA");
	}

	function entryHabitLogs(entry: JournalEntry) {
		return habitLogsByDate[entryDateKey(entry)] ?? [];
	}

	function entryPreview(entry: JournalEntry) {
		if (entry.excerpt) return entry.excerpt;
		return entry.content.replace(/[#*`~_]/g, "");
	}

	function happinessLabel(rating: number) {
		if (rating <= 1) return "Very low";
		if (rating === 2) return "Low";
		if (rating === 3) return "Steady";
		if (rating === 4) return "Good";
		return "Great";
	}

	async function handleLogout() {
		await logout();
		goto("/admin/login/");
	}
</script>

<svelte:head>
	<title>Personal Journal · Mikas James</title>
	<meta name="robots" content="noindex, nofollow" />
</svelte:head>

<div class="min-h-screen bg-[#09090b] pt-24 pb-16 px-4 md:px-8">
	<!-- Ambient Background Gradients -->
	<div
		class="fixed inset-0 bg-[linear-gradient(rgba(99,102,241,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(99,102,241,0.02)_1px,transparent_1px)] bg-[size:64px_64px] pointer-events-none"
	></div>
	<div
		class="fixed top-1/4 left-1/4 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-accent-500/5 rounded-full blur-[120px] pointer-events-none"
	></div>

	{#if !authReady || (user && loading && entries.length === 0)}
		<div class="min-h-[70vh] flex flex-col items-center justify-center gap-4">
			<div
				class="w-8 h-8 border-2 border-accent-500/20 border-t-accent-500 rounded-full animate-spin"
			></div>
			<p class="text-zinc-550 font-mono text-xs tracking-wider">SECURE LINK ESTABLISHED...</p>
		</div>
	{:else if user}
		<div class="relative mx-auto max-w-6xl">
			<!-- Header -->
			<div class="flex flex-col sm:flex-row sm:items-center justify-between border-b border-zinc-800/80 pb-6 mb-8 gap-4">
				<div>
					<div class="flex items-center gap-2 mb-1.5">
						<span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
						<p class="font-mono text-xs text-accent-400 tracking-widest uppercase">
							&gt;_ private journal
						</p>
					</div>
					<h1 class="text-3xl font-bold text-zinc-100 font-sans tracking-tight">Thoughts & Records</h1>
				</div>
				<div class="flex items-center gap-3">
					<a
						href="/admin/"
						class="px-4 py-2 rounded-lg border border-zinc-800 bg-zinc-900/40 text-zinc-300 hover:text-zinc-100 hover:border-zinc-700 text-sm font-medium transition-all duration-200"
					>
						Admin Dashboard
					</a>
					<button
						onclick={handleLogout}
						class="px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-750 text-zinc-300 text-sm font-medium transition-all duration-200"
					>
						Sign Out
					</button>
				</div>
			</div>

			{#if errorMsg}
				<div
					class="p-4 rounded-xl bg-red-950/20 border border-red-900/30 text-red-400 text-sm space-y-2 max-w-2xl mx-auto"
				>
					<p class="font-semibold flex items-center gap-2">
						<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
						</svg>
						Connection or Permission Error
					</p>
					<p class="text-zinc-400 leading-relaxed">{errorMsg}</p>
					<p class="text-[11px] text-zinc-550 pt-2 leading-relaxed border-t border-red-900/20">
						Please make sure Firestore Security Rules allow read access to the <code class="bg-zinc-900/80 px-1 py-0.5 rounded text-red-300">journal</code> collection for your user UID: <code class="bg-zinc-900/80 px-1 py-0.5 rounded text-zinc-300">{user.uid}</code>.
					</p>
				</div>
			{:else}
				<div class="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
					<!-- Sidebar: Search & Entry List -->
					<div class="lg:col-span-5 space-y-4">
						<div class="relative">
							<div class="absolute inset-y-0 left-3 flex items-center pointer-events-none text-zinc-600">
								<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
								</svg>
							</div>
							<input
								type="text"
								bind:value={searchQuery}
								placeholder="Search journal entries..."
								class="w-full pl-9 pr-4 py-2.5 rounded-xl bg-zinc-900/60 border border-zinc-800/80 text-zinc-100 text-sm placeholder-zinc-550 focus:outline-none focus:border-accent-500/60 focus:ring-1 focus:ring-accent-500/20 transition-all duration-200"
							/>
							{#if searchQuery}
								<button
									onclick={() => searchQuery = ""}
									class="absolute inset-y-0 right-3 flex items-center text-zinc-500 hover:text-zinc-300 text-xs font-mono"
								>
									CLEAR
								</button>
							{/if}
						</div>

						<div class="space-y-2 max-h-[70vh] overflow-y-auto pr-1">
							{#if filteredEntries.length === 0}
								<div class="text-center py-12 border border-dashed border-zinc-850 rounded-xl bg-zinc-900/10">
									<p class="text-zinc-500 text-sm font-medium">No entries found</p>
									<p class="text-zinc-650 text-xs mt-1">Try another search or write a new entry.</p>
								</div>
							{:else}
								{#each filteredEntries as entry (entry.id)}
									<button
										onclick={() => selectedEntryId = entry.id}
										class="w-full text-left p-4 rounded-xl border transition-all duration-200 {selectedEntryId === entry.id
											? 'bg-accent-600/10 border-accent-500/40 shadow-lg shadow-accent-600/5'
											: 'bg-surface-900/40 border-zinc-850/60 hover:bg-surface-900/80 hover:border-zinc-800'}"
									>
										<div class="flex gap-3">
											{#if entry.coverImage}
												<div class="w-14 h-14 shrink-0 overflow-hidden rounded-lg bg-zinc-950 border border-zinc-800/80">
													<img
														src={entry.coverImage}
														alt=""
														class="w-full h-full object-cover"
													/>
												</div>
											{/if}
											<div class="flex-1 min-w-0">
												<div class="flex justify-between items-start gap-3 mb-2">
													<h3 class="font-semibold text-zinc-200 text-sm truncate flex-1 group-hover:text-accent-300">
														{entry.title || "Untitled Entry"}
													</h3>
													{#if entry.createdAt}
														<span class="text-[10px] font-mono text-zinc-550 shrink-0 mt-0.5">
															{entry.createdAt.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
														</span>
													{/if}
												</div>
												<p class="text-xs text-zinc-400 line-clamp-2 leading-relaxed">
													{entryPreview(entry)}
												</p>
												<div class="flex items-center justify-between mt-3 pt-2.5 border-t border-zinc-850/40">
													<span class="text-[10px] text-zinc-600 font-mono">
														{formatTime(entry.createdAt)}
													</span>
													<div class="flex items-center gap-2">
														{#if entry.happinessRating}
															<span class="rounded-full border border-accent-500/20 bg-accent-500/10 px-2 py-0.5 text-[10px] font-semibold text-accent-300">
																{entry.happinessRating}/5
															</span>
														{/if}
														<span class="text-[10px] text-accent-400/80 hover:text-accent-300 font-medium">
															Read entry &rarr;
														</span>
													</div>
												</div>
												{#if entryHabitLogs(entry).length}
													<div class="mt-2 flex flex-wrap gap-1.5">
														{#each entryHabitLogs(entry) as log (log.id)}
															<span class="rounded-full border border-zinc-800 bg-zinc-950/50 px-2 py-0.5 text-[10px] text-zinc-500">
																{log.emoji} {log.habitName}
															</span>
														{/each}
													</div>
												{/if}
											</div>
										</div>
									</button>
								{/each}
							{/if}
						</div>
					</div>

					<!-- Content Area: Detail View -->
					<div class="lg:col-span-7">
						{#if selectedEntry}
							<article class="bg-surface-900/60 border border-zinc-850/70 rounded-2xl p-6 md:p-8 shadow-2xl">
								{#if selectedEntry.coverImage}
									<div class="w-full aspect-video mb-6 overflow-hidden rounded-xl bg-zinc-950 border border-zinc-800/80 shadow-lg">
										<img
											src={selectedEntry.coverImage}
											alt={selectedEntry.title || "Journal entry cover"}
											loading="eager"
											fetchpriority="high"
											class="w-full h-full object-cover"
										/>
									</div>
								{/if}

								<div class="border-b border-zinc-800/80 pb-5 mb-6">
									<div class="flex flex-wrap items-center gap-3 text-xs text-zinc-500 font-mono mb-3">
										{#if selectedEntry.createdAt}
											<time class="flex items-center gap-1">
												<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
													<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
												</svg>
												{formatDate(selectedEntry.createdAt)}
											</time>
											<span class="text-zinc-700">•</span>
											<span class="flex items-center gap-1">
												<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
													<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
												</svg>
												{formatTime(selectedEntry.createdAt)}
											</span>
										{/if}
									</div>
									{#if entryHabitLogs(selectedEntry).length}
										<div class="mb-3 flex flex-wrap gap-1.5">
											{#each entryHabitLogs(selectedEntry) as log (log.id)}
												<span class="rounded-full border border-zinc-800 bg-zinc-950/40 px-2.5 py-1 text-xs text-zinc-500">
													{log.emoji} {log.habitName}
												</span>
											{/each}
										</div>
									{/if}
									<h2 class="text-2xl font-bold text-zinc-100 tracking-tight">{selectedEntry.title || "Untitled Entry"}</h2>
									{#if selectedEntry.happinessRating}
										<div
											class="mt-4 flex flex-wrap items-center gap-3 rounded-xl border border-accent-500/20 bg-accent-500/10 px-4 py-3"
										>
											<div
												class="flex h-10 w-10 items-center justify-center rounded-lg bg-accent-500/20 text-lg font-bold text-accent-200"
											>
												{selectedEntry.happinessRating}
											</div>
											<div>
												<p
													class="text-xs font-semibold uppercase tracking-wide text-accent-300"
												>
													Overall Happiness
												</p>
												<p class="text-sm text-zinc-300">
													{happinessLabel(
														selectedEntry.happinessRating,
													)} for the day
												</p>
											</div>
										</div>
									{/if}
									{#if selectedEntry.excerpt}
										<p class="mt-3 text-zinc-450 text-base leading-relaxed">
											{selectedEntry.excerpt}
										</p>
									{/if}
								</div>

								<div class="prose-custom text-zinc-350 leading-relaxed text-[0.98rem] break-words text-left">
									<!-- eslint-disable-next-line svelte/no-at-html-tags -->
									{@html renderMarkdown(selectedEntry.content, selectedEntry.imageMeta)}
								</div>
							</article>
						{:else}
							<div class="flex flex-col items-center justify-center py-24 px-6 border border-zinc-850/60 rounded-2xl bg-surface-900/10 text-center">
								<div class="w-12 h-12 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-500 mb-4">
									<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/>
									</svg>
								</div>
								<h3 class="text-sm font-semibold text-zinc-300">No entry selected</h3>
								<p class="text-xs text-zinc-550 mt-1 max-w-xs">Select an entry from the sidebar to read, or go to the Admin Dashboard to write a new one.</p>
							</div>
						{/if}
					</div>
				</div>
			{/if}
		</div>
	{/if}
</div>
