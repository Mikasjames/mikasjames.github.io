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

	const totalHabitLogs = $derived(
		Object.values(habitLogsByDate).reduce((total, logs) => total + logs.length, 0)
	);

	const averageHappiness = $derived.by(() => {
		const ratedEntries = entries.filter((entry) => entry.happinessRating);
		if (!ratedEntries.length) return null;
		const total = ratedEntries.reduce((sum, entry) => sum + (entry.happinessRating ?? 0), 0);
		return total / ratedEntries.length;
	});

	$effect(() => {
		if (loading) return;
		if (!filteredEntries.length) {
			selectedEntryId = null;
			return;
		}
		if (!selectedEntryId || !filteredEntries.some((entry) => entry.id === selectedEntryId)) {
			selectedEntryId = filteredEntries[0].id;
		}
	});

	function formatDate(d: Date | null) {
		if (!d) return "—";
		return d.toLocaleDateString("en-US", {
			weekday: "long",
			year: "numeric",
			month: "long",
			day: "numeric",
		});
	}

	function formatCompactDate(d: Date | null) {
		if (!d) return "Undated";
		return d.toLocaleDateString("en-US", {
			month: "short",
			day: "numeric",
			year: "numeric",
		});
	}

	function formatMonth(d: Date | null) {
		if (!d) return "Journal";
		return d.toLocaleDateString("en-US", {
			month: "long",
			year: "numeric",
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

	function entryWordCount(entry: JournalEntry | null) {
		if (!entry) return 0;
		return entry.content.trim().split(/\s+/).filter(Boolean).length;
	}

	function readingTime(entry: JournalEntry | null) {
		const minutes = Math.max(1, Math.ceil(entryWordCount(entry) / 220));
		return `${minutes} min read`;
	}

	function happinessLabel(rating: number) {
		if (rating <= 1) return "Very low";
		if (rating === 2) return "Low";
		if (rating === 3) return "Steady";
		if (rating === 4) return "Good";
		return "Great";
	}

	function happinessTone(rating: number) {
		if (rating <= 2) return "border-rose-500/25 bg-rose-500/10 text-rose-200";
		if (rating === 3) return "border-amber-500/25 bg-amber-500/10 text-amber-200";
		if (rating === 4) return "border-sky-500/25 bg-sky-500/10 text-sky-200";
		return "border-emerald-500/25 bg-emerald-500/10 text-emerald-200";
	}

	function ratingWidth(rating: number) {
		return `${Math.min(100, Math.max(0, rating * 20))}%`;
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

<div class="min-h-screen bg-[#09090b] pt-20 pb-12 px-4 md:px-8">
	<div
		class="fixed inset-0 bg-[linear-gradient(rgba(99,102,241,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(99,102,241,0.02)_1px,transparent_1px)] bg-[size:64px_64px] pointer-events-none"
	></div>
	<div
		class="fixed top-24 left-1/2 h-px w-[min(72rem,calc(100vw-2rem))] -translate-x-1/2 bg-gradient-to-r from-transparent via-accent-500/25 to-transparent pointer-events-none"
	></div>

	{#if !authReady || (user && loading && entries.length === 0)}
		<div class="min-h-[70vh] flex flex-col items-center justify-center gap-4">
			<div
				class="w-8 h-8 border-2 border-accent-500/20 border-t-accent-500 rounded-full animate-spin"
			></div>
			<p class="text-zinc-550 font-mono text-xs tracking-wider">SECURE LINK ESTABLISHED...</p>
		</div>
	{:else if user}
		<div class="relative mx-auto max-w-7xl">
			<div class="mb-6 flex flex-col gap-5 border-b border-zinc-800/80 pb-6 lg:flex-row lg:items-end lg:justify-between">
				<div>
					<div class="mb-2 flex items-center gap-2">
						<span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
						<p class="font-mono text-xs text-accent-400 tracking-widest uppercase">
							&gt;_ private journal
						</p>
					</div>
					<h1 class="text-3xl font-bold tracking-tight text-zinc-100 md:text-4xl">Thoughts & Records</h1>
					<p class="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-500">
						A private archive for daily notes, mood signals, and habit context.
					</p>
				</div>
				<div class="flex flex-wrap items-center gap-3">
					<a
						href="/admin/"
						class="rounded-lg border border-zinc-800 bg-zinc-900/70 px-4 py-2 text-sm font-medium text-zinc-300 transition-all duration-200 hover:border-zinc-700 hover:text-zinc-100"
					>
						Admin Dashboard
					</a>
					<button
						onclick={handleLogout}
						class="rounded-lg bg-zinc-800 px-4 py-2 text-sm font-medium text-zinc-300 transition-all duration-200 hover:bg-zinc-750"
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
				<div class="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
					<div class="rounded-xl border border-zinc-850/70 bg-zinc-950/35 px-4 py-3">
						<p class="text-[10px] font-mono uppercase tracking-widest text-zinc-600">Entries</p>
						<p class="mt-1 text-2xl font-semibold text-zinc-100">{entries.length}</p>
					</div>
					<div class="rounded-xl border border-zinc-850/70 bg-zinc-950/35 px-4 py-3">
						<p class="text-[10px] font-mono uppercase tracking-widest text-zinc-600">Matched</p>
						<p class="mt-1 text-2xl font-semibold text-zinc-100">{filteredEntries.length}</p>
					</div>
					<div class="rounded-xl border border-zinc-850/70 bg-zinc-950/35 px-4 py-3">
						<p class="text-[10px] font-mono uppercase tracking-widest text-zinc-600">Habits</p>
						<p class="mt-1 text-2xl font-semibold text-zinc-100">{totalHabitLogs}</p>
					</div>
					<div class="rounded-xl border border-zinc-850/70 bg-zinc-950/35 px-4 py-3">
						<p class="text-[10px] font-mono uppercase tracking-widest text-zinc-600">Avg Mood</p>
						<p class="mt-1 text-2xl font-semibold text-zinc-100">
							{averageHappiness ? averageHappiness.toFixed(1) : "—"}<span class="text-sm text-zinc-600">/5</span>
						</p>
					</div>
				</div>

				<div class="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:items-start">
					<div class="space-y-4 lg:sticky lg:top-24 lg:col-span-4">
						<div class="rounded-2xl border border-zinc-850/70 bg-surface-900/45 p-3 shadow-2xl shadow-black/20">
							<div class="relative">
								<div class="absolute inset-y-0 left-3 flex items-center pointer-events-none text-zinc-600">
									<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
									</svg>
								</div>
								<input
									type="text"
									bind:value={searchQuery}
									placeholder="Search title, excerpt, or body..."
									class="w-full rounded-xl border border-zinc-800/80 bg-zinc-950/70 py-2.5 pl-9 pr-16 text-sm text-zinc-100 placeholder-zinc-600 transition-all duration-200 focus:border-accent-500/60 focus:outline-none focus:ring-1 focus:ring-accent-500/20"
								/>
								{#if searchQuery}
									<button
										onclick={() => searchQuery = ""}
										class="absolute inset-y-0 right-3 flex items-center text-xs font-mono text-zinc-500 hover:text-zinc-300"
									>
										CLEAR
									</button>
								{/if}
							</div>
						</div>

						<div class="max-h-[calc(100vh-15rem)] space-y-2 overflow-y-auto pr-1">
							{#if filteredEntries.length === 0}
								<div class="rounded-xl border border-dashed border-zinc-850 bg-zinc-900/10 py-12 text-center">
									<p class="text-zinc-500 text-sm font-medium">No entries found</p>
									<p class="text-zinc-650 text-xs mt-1">Try another search or write a new entry.</p>
								</div>
							{:else}
								{#each filteredEntries as entry (entry.id)}
									<button
										onclick={() => selectedEntryId = entry.id}
										class="group w-full rounded-xl border p-3 text-left transition-all duration-200 {selectedEntryId === entry.id
											? 'border-accent-500/45 bg-accent-600/10 shadow-lg shadow-accent-600/5'
											: 'border-zinc-850/70 bg-surface-900/35 hover:border-zinc-750 hover:bg-surface-900/75'}"
									>
										<div class="flex gap-3">
											{#if entry.coverImage}
												<div class="h-16 w-16 shrink-0 overflow-hidden rounded-lg border border-zinc-800/80 bg-zinc-950">
													<img
														src={entry.coverImage}
														alt=""
														class="w-full h-full object-cover"
													/>
												</div>
											{/if}
											<div class="flex-1 min-w-0">
												<div class="mb-1.5 flex items-start justify-between gap-3">
													<h3 class="flex-1 truncate text-sm font-semibold text-zinc-200 group-hover:text-accent-300">
														{entry.title || "Untitled Entry"}
													</h3>
													{#if entry.createdAt}
														<span class="mt-0.5 shrink-0 text-[10px] font-mono text-zinc-550">
															{entry.createdAt.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
														</span>
													{/if}
												</div>
												<p class="text-xs text-zinc-400 line-clamp-2 leading-relaxed">
													{entryPreview(entry)}
												</p>
												<div class="mt-3 flex items-center justify-between border-t border-zinc-850/50 pt-2.5">
													<span class="text-[10px] text-zinc-600 font-mono">
														{formatTime(entry.createdAt) || `${entryWordCount(entry)} words`}
													</span>
													<div class="flex items-center gap-2">
														{#if entry.happinessRating}
															<span class="rounded-full border px-2 py-0.5 text-[10px] font-semibold {happinessTone(entry.happinessRating)}">
																{entry.happinessRating}/5
															</span>
														{/if}
														<span class="text-[10px] font-medium text-accent-400/80 group-hover:text-accent-300">Open</span>
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

					<div class="lg:col-span-8">
						{#if selectedEntry}
							<article class="overflow-hidden rounded-2xl border border-zinc-850/70 bg-surface-900/55 shadow-2xl shadow-black/25">
								{#if selectedEntry.coverImage}
									<div class="relative aspect-[16/7] w-full overflow-hidden border-b border-zinc-800/80 bg-zinc-950">
										<img
											src={selectedEntry.coverImage}
											alt={selectedEntry.title || "Journal entry cover"}
											loading="eager"
											fetchpriority="high"
											class="w-full h-full object-cover"
										/>
										<div class="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-surface-900 to-transparent"></div>
									</div>
								{/if}

								<div class="p-5 md:p-8">
								<div class="border-b border-zinc-800/80 pb-6 mb-7">
									<div class="mb-4 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
										<span class="rounded-full border border-zinc-800 bg-zinc-950/45 px-2.5 py-1 font-mono text-zinc-500">
											{formatMonth(selectedEntry.createdAt)}
										</span>
										{#if selectedEntry.createdAt}
											<time class="flex items-center gap-1 rounded-full border border-zinc-800 bg-zinc-950/45 px-2.5 py-1 font-mono">
												<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
													<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
												</svg>
												{formatCompactDate(selectedEntry.createdAt)}
											</time>
											<span class="flex items-center gap-1 rounded-full border border-zinc-800 bg-zinc-950/45 px-2.5 py-1 font-mono">
												<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
													<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
												</svg>
												{formatTime(selectedEntry.createdAt)}
											</span>
										{/if}
										<span class="rounded-full border border-zinc-800 bg-zinc-950/45 px-2.5 py-1 font-mono">
											{entryWordCount(selectedEntry)} words
										</span>
										<span class="rounded-full border border-zinc-800 bg-zinc-950/45 px-2.5 py-1 font-mono">
											{readingTime(selectedEntry)}
										</span>
									</div>

									<h2 class="max-w-3xl text-3xl font-bold tracking-tight text-zinc-100 md:text-4xl">{selectedEntry.title || "Untitled Entry"}</h2>
									<p class="mt-3 text-sm font-mono text-zinc-600">{formatDate(selectedEntry.createdAt)}</p>

									{#if selectedEntry.happinessRating}
										<div
											class="mt-5 rounded-xl border p-4 {happinessTone(selectedEntry.happinessRating)}"
										>
											<div class="flex items-center justify-between gap-4">
												<div>
													<p class="text-xs font-semibold uppercase tracking-wide opacity-80">Overall Happiness</p>
													<p class="mt-1 text-sm text-zinc-300">
														{happinessLabel(selectedEntry.happinessRating)} for the day
													</p>
												</div>
												<div class="text-3xl font-bold text-zinc-100">
													{selectedEntry.happinessRating}<span class="text-base text-zinc-500">/5</span>
												</div>
											</div>
											<div class="mt-4 h-2 overflow-hidden rounded-full bg-zinc-950/50">
												<div class="h-full rounded-full bg-current" style={`width: ${ratingWidth(selectedEntry.happinessRating)}`}></div>
											</div>
										</div>
									{/if}
									{#if selectedEntry.excerpt}
										<p class="mt-5 max-w-3xl border-l-2 border-zinc-700 pl-4 text-base leading-relaxed text-zinc-400">
											{selectedEntry.excerpt}
										</p>
									{/if}
									{#if entryHabitLogs(selectedEntry).length}
										<div class="mt-5 flex flex-wrap gap-2">
											{#each entryHabitLogs(selectedEntry) as log (log.id)}
												<span class="rounded-full border border-zinc-800 bg-zinc-950/45 px-3 py-1 text-xs text-zinc-400">
													{log.emoji} {log.habitName}
												</span>
											{/each}
										</div>
									{/if}
								</div>

								<div class="prose-custom max-w-3xl break-words text-left text-[0.98rem] leading-relaxed text-zinc-350">
									<!-- eslint-disable-next-line svelte/no-at-html-tags -->
									{@html renderMarkdown(selectedEntry.content, selectedEntry.imageMeta)}
								</div>
								</div>
							</article>
						{:else}
							<div class="flex flex-col items-center justify-center rounded-2xl border border-zinc-850/60 bg-surface-900/10 px-6 py-24 text-center">
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
