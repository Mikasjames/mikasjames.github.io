<script lang="ts">
	import { onMount, onDestroy } from "svelte";
	import { goto } from "$app/navigation";
	import { subscribeToAuth, logout } from "$lib/firebase/auth";
	import {
		getJournalEntryByDate,
		getJournalEntriesByMonth,
		createJournalEntry,
		updateJournalEntry,
		type JournalEntry,
	} from "$lib/firebase/firestore.svelte";
	import { createHabitsStore } from "$lib/firebase/habits.svelte";
	import { renderMarkdown } from "$lib/utils/renderMarkdown";
	import { getHappinessLabel, todayDateKey } from "$lib/utils/date";
	import type { User } from "firebase/auth";

	let user = $state<User | null>(null);
	let authReady = $state(false);

	const habitsStore = createHabitsStore();

	let selectedDate = $state(todayDateKey());
	let happinessRating = $state(3);
	let content = $state("");
	let journalEntryId = $state<string | null>(null);
	let saving = $state(false);
	let saveMsg = $state("");
	let showNote = $state(false);
	let showPreview = $state(false);

	let calendarYear = $state<number>(new Date().getFullYear());
	let calendarMonth = $state<number>(new Date().getMonth() + 1);
	let monthEntries = $state<JournalEntry[]>([]);
	let calendarLoading = $state(false);

	const unsub = subscribeToAuth((u) => {
		user = u;
		authReady = true;
		if (!u) {
			goto("/admin/login/");
		}
	});
	onDestroy(unsub);

	async function loadDate(date: string) {
		if (!user) return;
		selectedDate = date;
		content = "";
		showNote = false;
		showPreview = false;
		saveMsg = "";

		try {
			const entry = await getJournalEntryByDate(user.uid, date);
			if (entry) {
				journalEntryId = entry.id;
				happinessRating = entry.happinessRating ?? 3;
				content = entry.content || "";
				if (content) showNote = true;
			} else {
				journalEntryId = null;
				happinessRating = 3;
			}
		} catch {
			journalEntryId = null;
			happinessRating = 3;
		}

		await habitsStore.loadHabitLogsForDate(user.uid, date);
	}

	async function loadCalendarMonth(year: number, month: number) {
		if (!user) return;
		calendarLoading = true;
		calendarYear = year;
		calendarMonth = month;
		try {
			monthEntries = await getJournalEntriesByMonth(user.uid, year, month);
		} catch (err) {
			console.error("Failed to load calendar entries:", err);
			monthEntries = [];
		} finally {
			calendarLoading = false;
		}
	}

	async function handleSave() {
		if (!user) return;
		saving = true;
		saveMsg = "";
		try {
			const payload = {
				title: content ? `Check-in — ${selectedDate}` : "",
				excerpt: "",
				content: content || "",
				coverImage: null,
				imageMeta: {} as Record<string, { width: number; height: number }>,
				happinessRating,
				ownerUid: user.uid,
				entryDate: selectedDate,
			};

			let entryId: string;
			if (journalEntryId) {
				await updateJournalEntry(journalEntryId, payload);
				entryId = journalEntryId;
			} else {
				entryId = await createJournalEntry(payload);
				journalEntryId = entryId;
			}

			await habitsStore.saveHabitLogsForDate(user.uid, selectedDate, entryId);

			await loadCalendarMonth(calendarYear, calendarMonth);
			saveMsg = "Saved!";
			setTimeout(() => { saveMsg = ""; }, 2000);
		} catch (err) {
			saveMsg = err instanceof Error ? err.message : "Failed to save.";
		} finally {
			saving = false;
		}
	}

	function prevMonth() {
		const d = new Date(calendarYear, calendarMonth - 2, 1);
		loadCalendarMonth(d.getFullYear(), d.getMonth() + 1);
	}

	function nextMonth() {
		const d = new Date(calendarYear, calendarMonth, 1);
		loadCalendarMonth(d.getFullYear(), d.getMonth() + 1);
	}

	$effect(() => {
		if (authReady && user) {
			habitsStore.loadHabits(user.uid);
			loadDate(todayDateKey());
			const now = new Date();
			loadCalendarMonth(now.getFullYear(), now.getMonth() + 1);
		}
	});

	$effect(() => {
		if (!showNote && content && !saveMsg) {
			content = "";
		}
	});

	function daysInMonth(year: number, month: number) {
		return new Date(year, month, 0).getDate();
	}

	function firstDayOfMonth(year: number, month: number) {
		return new Date(year, month - 1, 1).getDay();
	}

	function dateStr(year: number, month: number, day: number) {
		return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
	}

	function entryForDay(day: number) {
		const ds = dateStr(calendarYear, calendarMonth, day);
		return monthEntries.find((e) => e.entryDate === ds);
	}

	function dotColor(day: number) {
		const entry = entryForDay(day);
		if (!entry || entry.happinessRating == null) return "bg-zinc-800 border-zinc-700";
		const r = entry.happinessRating;
		if (r <= 1) return "bg-rose-500 border-rose-400";
		if (r === 2) return "bg-orange-500 border-orange-400";
		if (r === 3) return "bg-amber-500 border-amber-400";
		if (r === 4) return "bg-sky-500 border-sky-400";
		return "bg-emerald-500 border-emerald-400";
	}

	function isToday(date: string) {
		return date === todayDateKey();
	}

	const monthNames = [
		"January", "February", "March", "April", "May", "June",
		"July", "August", "September", "October", "November", "December",
	];

	function goToday() {
		const today = todayDateKey();
		loadDate(today);
		const now = new Date();
		if (now.getFullYear() !== calendarYear || now.getMonth() + 1 !== calendarMonth) {
			loadCalendarMonth(now.getFullYear(), now.getMonth() + 1);
		}
	}

	async function handleLogout() {
		await logout();
		goto("/admin/login/");
	}

	function parsedContent() {
		if (!content) return "";
		try { return renderMarkdown(content); } catch { return content; }
	}

	function formattedDate(dateStr: string) {
		const d = new Date(dateStr + "T00:00:00");
		return d.toLocaleDateString("en-US", {
			weekday: "long", year: "numeric", month: "long", day: "numeric",
		});
	}
</script>

<svelte:head>
	<title>Daily Check-in · Mikas James</title>
	<meta name="robots" content="noindex, nofollow" />
</svelte:head>

<div class="min-h-screen bg-[#09090b] pt-20 pb-12 px-4 md:px-8">
	<div
		class="fixed inset-0 bg-[linear-gradient(rgba(99,102,241,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(99,102,241,0.02)_1px,transparent_1px)] bg-[size:64px_64px] pointer-events-none"
	></div>
	<div
		class="fixed top-24 left-1/2 h-px w-[min(72rem,calc(100vw-2rem))] -translate-x-1/2 bg-gradient-to-r from-transparent via-accent-500/25 to-transparent pointer-events-none"
	></div>

	{#if !authReady || (user && habitsStore.habitsLoading && !journalEntryId)}
		<div class="min-h-[70vh] flex flex-col items-center justify-center gap-4">
			<div class="w-8 h-8 border-2 border-accent-500/20 border-t-accent-500 rounded-full animate-spin"></div>
			<p class="text-zinc-550 font-mono text-xs tracking-wider">LOADING...</p>
		</div>
	{:else if user}
		<div class="relative mx-auto max-w-3xl">
			<div class="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
				<div>
					<div class="mb-2 flex items-center gap-2">
						<span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
						<p class="font-mono text-xs text-accent-400 tracking-widest uppercase">&gt;_ daily check-in</p>
					</div>
					<h1 class="text-2xl font-bold tracking-tight text-zinc-100">
						{formattedDate(selectedDate)}
					</h1>
				</div>
				<div class="flex items-center gap-2">
					<button
						onclick={goToday}
						class="rounded-lg border border-zinc-700/60 px-3 py-2 text-xs font-semibold text-zinc-300 transition hover:border-accent-500/50 hover:text-accent-300"
					>
						Today
					</button>
					<button
						onclick={handleLogout}
						class="rounded-lg bg-zinc-800 px-3 py-2 text-xs font-semibold text-zinc-300 transition hover:bg-zinc-700"
					>
						Sign Out
					</button>
				</div>
			</div>

			<div class="space-y-5">
				<div class="rounded-xl border border-zinc-800/60 bg-zinc-900/50 p-5">
					<p class="mb-3 text-xs font-semibold uppercase tracking-wide text-zinc-400">
						Mood
					</p>
					<div class="flex items-center gap-4">
						<span class="text-lg font-bold text-zinc-100 min-w-[3rem] text-center tabular-nums">
							{happinessRating}
						</span>
						<input
							type="range"
							min="1"
							max="5"
							step="1"
							bind:value={happinessRating}
							class="h-2 flex-1 cursor-pointer appearance-none rounded-full bg-gradient-to-r from-red-500 via-amber-400 to-emerald-400 accent-accent-500"
						/>
						<span class="text-xs font-semibold text-zinc-300 min-w-[4.5rem] text-right">
							{getHappinessLabel(happinessRating)}
						</span>
					</div>
				</div>

				<div class="rounded-xl border border-zinc-800/60 bg-zinc-900/50 p-5">
					<div class="mb-3 flex items-center justify-between">
						<p class="text-xs font-semibold uppercase tracking-wide text-zinc-400">
							Habits
						</p>
						<button
							type="button"
							onclick={() => (habitsStore.showHabitManager = !habitsStore.showHabitManager)}
							class="text-xs font-semibold text-accent-400 transition-colors hover:text-accent-300"
						>
							{habitsStore.showHabitManager ? "Done" : "Manage"}
						</button>
					</div>

					{#if habitsStore.habitsLoading}
						<div class="flex flex-wrap gap-2">
							<div class="h-9 w-24 animate-pulse rounded-lg bg-zinc-800/70"></div>
							<div class="h-9 w-28 animate-pulse rounded-lg bg-zinc-800/70"></div>
							<div class="h-9 w-20 animate-pulse rounded-lg bg-zinc-800/70"></div>
						</div>
					{:else if habitsStore.habits.length === 0}
						<p class="text-sm text-zinc-550">
							No habits yet.{" "}
							<button
								type="button"
								onclick={() => (habitsStore.showHabitManager = true)}
								class="text-accent-400 hover:text-accent-300 underline"
							>Add one</button>.
						</p>
					{:else}
						<div class="flex flex-wrap gap-2">
							{#each habitsStore.habits as habit (habit.id)}
								<button
									type="button"
									onclick={() => habitsStore.toggleHabit(habit.id)}
									class="rounded-lg border px-3 py-2 text-sm font-medium transition-all {habitsStore.selectedHabitIds.has(habit.id)
										? 'border-accent-500/50 bg-accent-600/20 text-accent-200 shadow-lg shadow-accent-600/10'
										: 'border-zinc-700/60 bg-zinc-900 text-zinc-300 hover:border-zinc-600 hover:text-zinc-100'}"
								>
									{habit.emoji} {habit.name}
								</button>
							{/each}
						</div>
					{/if}

					{#if habitsStore.showHabitManager}
						<div class="mt-4 space-y-3 border-t border-zinc-800/60 pt-4">
							{#each habitsStore.habits as habit, index (habit.id)}
								<div class="flex flex-wrap items-center gap-2 rounded-lg border border-zinc-800/50 bg-zinc-950/30 px-3 py-2">
									<span class="min-w-0 flex-1 truncate text-sm text-zinc-300">
										{habit.emoji} {habit.name}
									</span>
									<button
										type="button"
										onclick={() => habitsStore.moveHabit(index, -1, user!.uid)}
										disabled={index === 0}
										class="rounded border border-zinc-700/60 px-2 py-1 text-xs text-zinc-400 transition hover:border-accent-500/50 hover:text-accent-300 disabled:cursor-not-allowed disabled:opacity-40"
									>Up</button>
									<button
										type="button"
										onclick={() => habitsStore.moveHabit(index, 1, user!.uid)}
										disabled={index === habitsStore.habits.length - 1}
										class="rounded border border-zinc-700/60 px-2 py-1 text-xs text-zinc-400 transition hover:border-accent-500/50 hover:text-accent-300 disabled:cursor-not-allowed disabled:opacity-40"
									>Down</button>
									<button
										type="button"
										onclick={() => habitsStore.handleDeleteHabit(habit, user!.uid)}
										class="rounded border border-red-500/20 px-2 py-1 text-xs text-red-400 transition hover:border-red-500/40 hover:text-red-300"
									>Delete</button>
								</div>
							{/each}
							<div class="grid gap-2 sm:grid-cols-[5rem_minmax(0,1fr)_auto]">
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
									onclick={() => habitsStore.handleAddHabit(user!.uid)}
									disabled={habitsStore.habitForm.submitting}
									class="rounded-lg bg-accent-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-accent-500 disabled:cursor-not-allowed disabled:opacity-50"
								>Save</button>
							</div>
							{#if habitsStore.habitForm.error}
								<p class="text-xs text-red-400">{habitsStore.habitForm.error}</p>
							{/if}
						</div>
					{/if}
				</div>

				<div class="rounded-xl border border-zinc-800/60 bg-zinc-900/50 p-5">
					<button
						type="button"
						onclick={() => { showNote = !showNote; if (!showNote) content = ""; }}
						class="flex w-full items-center justify-between text-xs font-semibold uppercase tracking-wide text-zinc-400 transition hover:text-zinc-200"
					>
						<span>{showNote ? "Journal Note" : "+ Write a Note"}</span>
						<svg
							class="h-4 w-4 transition-transform {showNote ? 'rotate-180' : ''}"
							fill="none" stroke="currentColor" viewBox="0 0 24 24"
						>
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
						</svg>
					</button>
					{#if showNote}
						<div class="mt-3 space-y-3">
							<div class="flex items-center gap-2">
								<button
									type="button"
									onclick={() => (showPreview = !showPreview)}
									class="rounded border border-zinc-700/60 px-2 py-1 text-xs text-zinc-400 transition hover:border-accent-500/50 hover:text-accent-300"
								>
									{showPreview ? "Edit" : "Preview"}
								</button>
								<span class="text-[10px] text-zinc-600">Supports markdown</span>
							</div>
							{#if showPreview}
								<div class="min-h-[120px] rounded-lg border border-zinc-700/60 bg-zinc-950/30 p-3 text-sm text-zinc-300 prose prose-invert prose-sm max-w-none">
									{@html parsedContent() || "<p class='text-zinc-600 italic'>Nothing written yet...</p>"}
								</div>
							{:else}
								<textarea
									bind:value={content}
									placeholder="How was your day? Write whatever comes to mind..."
									class="min-h-[120px] w-full rounded-lg border border-zinc-700/60 bg-zinc-950/30 p-3 text-sm text-zinc-100 placeholder-zinc-600 focus:border-accent-500 focus:outline-none focus:ring-1 focus:ring-accent-500/30 resize-y"
								></textarea>
							{/if}
						</div>
					{/if}
				</div>

				<div class="flex items-center gap-4">
					<button
						onclick={handleSave}
						disabled={saving}
						class="rounded-lg bg-accent-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-accent-500 disabled:cursor-not-allowed disabled:opacity-50 flex items-center gap-2"
					>
						{#if saving}
							<div class="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
						{/if}
						{saving ? "Saving..." : "Save Check-in"}
					</button>
					{#if saveMsg}
						<span class="text-sm {saveMsg === 'Saved!' ? 'text-emerald-400' : 'text-red-400'}">{saveMsg}</span>
					{/if}
				</div>
			</div>

			<div class="mt-10 rounded-xl border border-zinc-800/60 bg-zinc-900/50 p-5">
				<div class="mb-4 flex items-center justify-between">
					<button
						onclick={prevMonth}
						class="rounded border border-zinc-700/60 px-2 py-1 text-xs text-zinc-400 transition hover:border-accent-500/50 hover:text-accent-300"
					>
						&larr;
					</button>
					<p class="text-sm font-semibold text-zinc-200">
						{monthNames[calendarMonth - 1]} {calendarYear}
					</p>
					<button
						onclick={nextMonth}
						class="rounded border border-zinc-700/60 px-2 py-1 text-xs text-zinc-400 transition hover:border-accent-500/50 hover:text-accent-300"
					>
						&rarr;
					</button>
				</div>

				{#if calendarLoading}
					<div class="flex justify-center py-4">
						<div class="h-5 w-5 border-2 border-accent-500/20 border-t-accent-500 rounded-full animate-spin"></div>
					</div>
				{:else}
					{@const pad = firstDayOfMonth(calendarYear, calendarMonth)}
					{@const totalDays = daysInMonth(calendarYear, calendarMonth)}
					<div class="grid grid-cols-7 gap-1 text-center">
						{#each ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as day}
							<span class="text-[10px] font-mono uppercase tracking-wider text-zinc-600 py-1">{day}</span>
						{/each}
						{#each Array(pad) as _}
							<div></div>
						{/each}
						{#each Array(totalDays) as _, i}
							{@const day = i + 1}
							{@const ds = dateStr(calendarYear, calendarMonth, day)}
							<button
								type="button"
								onclick={() => loadDate(ds)}
								class="flex flex-col items-center gap-1 rounded-lg p-2 transition hover:bg-zinc-800/50 {ds === selectedDate ? 'ring-1 ring-accent-500/50 bg-accent-500/10' : ''}"
							>
								<span class="text-xs font-mono {isToday(ds) ? 'text-accent-400 font-bold' : 'text-zinc-400'}">
									{day}
								</span>
								<span class="h-2 w-2 rounded-full border {dotColor(day)}"></span>
							</button>
						{/each}
					</div>
					<div class="mt-3 flex items-center justify-center gap-4 text-[10px] text-zinc-600">
						<span class="flex items-center gap-1">
							<span class="h-2 w-2 rounded-full border bg-zinc-800 border-zinc-700"></span> No entry
						</span>
						<span class="flex items-center gap-1">
							<span class="h-2 w-2 rounded-full border bg-rose-500 border-rose-400"></span> Low
						</span>
						<span class="flex items-center gap-1">
							<span class="h-2 w-2 rounded-full border bg-amber-500 border-amber-400"></span> Steady
						</span>
						<span class="flex items-center gap-1">
							<span class="h-2 w-2 rounded-full border bg-emerald-500 border-emerald-400"></span> High
						</span>
					</div>
				{/if}
			</div>
		</div>
	{/if}
</div>
