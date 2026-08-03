<script lang="ts">
	import { onMount, onDestroy } from "svelte";
	import { goto } from "$app/navigation";
	import { subscribeToAuth, logout } from "$lib/firebase/auth";
	import {
		getJournalEntryByDate,
		getJournalEntriesByMonth,
		upsertJournalEntry,
		type JournalEntry,
	} from "$lib/firebase/firestore.svelte";
	import { createHabitsStore } from "$lib/firebase/habits.svelte";
	import { renderMarkdown } from "$lib/utils/renderMarkdown";
	import { getHappinessLabel, todayDateKey } from "$lib/utils/date";
	import type { User } from "firebase/auth";
	import GridBackground from "$lib/components/GridBackground.svelte";
	import Spinner from "$lib/components/Spinner.svelte";
	import AppButton from "$lib/components/AppButton.svelte";
	import UserActions from "$lib/components/UserActions.svelte";
	import HabitsManager from "$lib/components/HabitsManager.svelte";

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

			const entryId = await upsertJournalEntry(payload, journalEntryId);
			journalEntryId = entryId;

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
	<GridBackground opacity="2" />
	<div
		class="fixed top-24 left-1/2 h-px w-[min(72rem,calc(100vw-2rem))] -translate-x-1/2 bg-gradient-to-r from-transparent via-accent-500/25 to-transparent pointer-events-none"
	></div>

	{#if !authReady || (user && habitsStore.habitsLoading && !journalEntryId)}
		<div class="min-h-[70vh] flex flex-col items-center justify-center gap-4">
			<Spinner size="xl" color="accent" />
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
				<UserActions onTodayClick={goToday} onSignOut={handleLogout} />
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
					<HabitsManager {habitsStore} userId={user!.uid} />
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
								<AppButton variant="ghost" size="sm" onclick={() => (showPreview = !showPreview)}>
									{showPreview ? "Edit" : "Preview"}
								</AppButton>
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
				<AppButton variant="primary" size="lg" onclick={handleSave} disabled={saving} loading={saving}>
					{saving ? "Saving..." : "Save Check-in"}
				</AppButton>
					{#if saveMsg}
						<span class="text-sm {saveMsg === 'Saved!' ? 'text-emerald-400' : 'text-red-400'}">{saveMsg}</span>
					{/if}
				</div>
			</div>

		<div class="mt-10 rounded-xl border border-zinc-800/60 bg-zinc-900/50 p-5">
			<div class="mb-4 flex items-center justify-between">
				<AppButton variant="ghost" size="sm" onclick={prevMonth}>&larr;</AppButton>
				<p class="text-sm font-semibold text-zinc-200">
					{monthNames[calendarMonth - 1]} {calendarYear}
				</p>
				<AppButton variant="ghost" size="sm" onclick={nextMonth}>&rarr;</AppButton>
			</div>

			{#if calendarLoading}
				<div class="flex justify-center py-4">
					<Spinner size="md" color="accent" />
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
