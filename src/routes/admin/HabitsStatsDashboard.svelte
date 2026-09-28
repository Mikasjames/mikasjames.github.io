<script lang="ts">
	import HabitContributionGrid from "$lib/components/HabitContributionGrid.svelte";
	import { getHappinessLabel } from "$lib/utils/date";
	import {
		formatAverageHour,
		formatRangeLabel,
		formatStreak,
		percent,
		rateBarWidth,
		ratingBarWidth,
		weekdayShortLabel,
		type MoodDelta,
		type PeriodStats,
		type RangeKind,
	} from "$lib/utils/habitStats";
	import type { createHabitStatsStore } from "$lib/firebase/habitStats.svelte";

	type StatsStore = ReturnType<typeof createHabitStatsStore>;

	let { statsStore }: { statsStore: StatsStore } = $props();

	const stats: PeriodStats = $derived(statsStore.stats);

	const RANGES: Array<{ kind: RangeKind; label: string }> = [
		{ kind: "month", label: "This Month" },
		{ kind: "year", label: "This Year" },
		{ kind: "all", label: "All Time" },
	];

	function moodFor(habitId: string): MoodDelta | undefined {
		return stats.moodDeltas.find((entry) => entry.habitId === habitId);
	}

	function rateTone(rate: number): string {
		if (rate >= 0.8) return "text-emerald-400";
		if (rate >= 0.5) return "text-amber-400";
		return "text-zinc-400";
	}

	// Height as a percentage of the habits that were trackable that day, so
	// the tallest possible bar is 100% regardless of how many habits exist.
	// A nonzero share gets a 6% floor so single-habit days stay visible.
	function barHeight(done: number, total: number): string {
		if (total === 0) return "0%";
		const ratio = done / total;
		return `${Math.max(ratio > 0 ? 6 : 0, ratio * 100)}%`;
	}
</script>

<section class="space-y-5">
	<div
		class="rounded-xl border border-zinc-800/60 bg-surface-900/80 p-4 shadow-2xl shadow-black/40 backdrop-blur-md sm:rounded-2xl sm:p-5 md:p-8"
	>
		<div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
			<div class="flex items-center justify-center gap-3 sm:justify-start">
				{#if statsStore.kind !== "all"}
					<button
						type="button"
						aria-label="Previous period"
						onclick={() =>
							statsStore.kind === "month"
								? statsStore.stepMonth(-1)
								: statsStore.stepYear(-1)}
						class="rounded-lg border border-zinc-700/60 bg-zinc-900 px-3 py-2 text-sm text-zinc-300 transition hover:border-accent-500/50 hover:text-accent-300"
					>
						←
					</button>
				{/if}
				<p class="min-w-40 text-center text-sm font-semibold text-zinc-100">
					{formatRangeLabel(stats.range, statsStore.kind)}
				</p>
				{#if statsStore.kind !== "all"}
					<button
						type="button"
						aria-label="Next period"
						disabled={!statsStore.canStepForward()}
						onclick={() =>
							statsStore.kind === "month"
								? statsStore.stepMonth(1)
								: statsStore.stepYear(1)}
						class="rounded-lg border border-zinc-700/60 bg-zinc-900 px-3 py-2 text-sm text-zinc-300 transition hover:border-accent-500/50 hover:text-accent-300 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:border-zinc-700/60 disabled:hover:text-zinc-300"
					>
						→
					</button>
				{/if}
			</div>
			<div class="grid grid-cols-3 rounded-lg border border-zinc-800/70 bg-zinc-950/40 p-1">
				{#each RANGES as range}
					<button
						type="button"
						onclick={() => statsStore.setKind(range.kind)}
						class="rounded-md px-2 py-1.5 text-xs font-semibold transition sm:px-3 {statsStore.kind ===
						range.kind
							? 'bg-accent-600 text-white'
							: 'text-zinc-400 hover:text-zinc-200'}"
					>
						{range.label}
					</button>
				{/each}
			</div>
		</div>

		<p class="mt-4 text-xs text-zinc-600">
			Computed live from your check-ins. No AI analysis involved, and the current month is
			included.
		</p>

		{#if statsStore.loading}
			<div class="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
				{#each Array(4) as _}
					<div class="h-24 animate-pulse rounded-xl border border-zinc-800/60 bg-zinc-900/60"></div>
				{/each}
			</div>
		{:else if statsStore.error}
			<div class="mt-6 rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
				{statsStore.error}
			</div>
		{:else if stats.totals.habitCount === 0}
			<div class="mt-6 rounded-lg border border-zinc-800/60 bg-zinc-900/40 px-4 py-8 text-center text-sm text-zinc-500">
				No habits to report on yet. Add one from the
				<a href="/habits/" class="text-accent-400 hover:text-accent-300 underline">check-in page</a>.
			</div>
		{:else}
			<div class="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
				<div class="rounded-xl border border-zinc-800/60 bg-zinc-900/50 p-4">
					<p class="text-[10px] font-mono uppercase tracking-wider text-zinc-500">Check-ins</p>
					<p class="mt-1 text-2xl font-bold tabular-nums text-zinc-100">
						{stats.totals.checkIns}
					</p>
					<p class="mt-0.5 text-xs text-zinc-500">
						{stats.totals.avgPerActiveDay ?? "—"} per active day
					</p>
				</div>
				<div class="rounded-xl border border-zinc-800/60 bg-zinc-900/50 p-4">
					<p class="text-[10px] font-mono uppercase tracking-wider text-zinc-500">Active days</p>
					<p class="mt-1 text-2xl font-bold tabular-nums text-zinc-100">
						{stats.totals.activeDays}
						<span class="text-sm font-normal text-zinc-500">/ {stats.range.days}</span>
					</p>
					<p class="mt-0.5 text-xs text-zinc-500">days with at least one habit</p>
				</div>
				<div class="rounded-xl border border-zinc-800/60 bg-zinc-900/50 p-4">
					<p class="text-[10px] font-mono uppercase tracking-wider text-zinc-500">Perfect days</p>
					<p class="mt-1 text-2xl font-bold tabular-nums text-zinc-100">
						{stats.totals.perfectDays}
					</p>
					<p class="mt-0.5 text-xs text-zinc-500">every habit completed</p>
				</div>
				<div class="rounded-xl border border-zinc-800/60 bg-zinc-900/50 p-4">
					<p class="text-[10px] font-mono uppercase tracking-wider text-zinc-500">Best streak</p>
					<p class="mt-1 text-2xl font-bold tabular-nums text-zinc-100">
						{stats.totals.bestCurrentStreak}
					</p>
					<p class="mt-0.5 text-xs text-zinc-500">
						longest ever {formatStreak(stats.totals.longestStreakEver)}
					</p>
				</div>
			</div>
		{/if}
	</div>

	{#if !statsStore.loading && !statsStore.error && stats.habits.length > 0}
		<div class="space-y-4">
			{#each stats.habits as habit (habit.habitId)}
				{@const mood = moodFor(habit.habitId)}
				<div
					class="rounded-xl border border-zinc-800/60 bg-surface-900/80 p-4 shadow-2xl shadow-black/40 backdrop-blur-md sm:rounded-2xl sm:p-5"
				>
					<div class="flex flex-wrap items-start justify-between gap-3">
						<div class="min-w-0">
							<p class="font-semibold text-zinc-100">{habit.emoji} {habit.name}</p>
							<p class="mt-0.5 text-xs text-zinc-500">
								{habit.checkIns} / {habit.eligibleDays} days
								{#if habit.activeFrom > stats.range.start}
									· tracked from {habit.activeFrom}
								{/if}
							</p>
						</div>
						<div class="flex items-baseline gap-1">
							<span class="text-2xl font-bold tabular-nums {rateTone(habit.completionRate)}">
								{percent(habit.completionRate)}
							</span>
						</div>
					</div>

					<div class="mt-3 h-2 rounded-full bg-zinc-800">
						<div
							class="h-2 rounded-full bg-accent-500"
							style={`width: ${rateBarWidth(habit.completionRate)}`}
						></div>
					</div>

					<div class="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
						<div class="rounded-lg border border-zinc-800/50 bg-zinc-950/30 p-3">
							<p class="text-[10px] font-mono uppercase tracking-wider text-zinc-500">Current streak</p>
							<p class="mt-1 text-lg font-bold tabular-nums text-zinc-100">
								{habit.currentStreak}
								<span class="text-xs font-normal text-zinc-500">d</span>
							</p>
						</div>
						<div class="rounded-lg border border-zinc-800/50 bg-zinc-950/30 p-3">
							<p class="text-[10px] font-mono uppercase tracking-wider text-zinc-500">Longest streak</p>
							<p class="mt-1 text-lg font-bold tabular-nums text-zinc-100">
								{habit.longestStreak}
								<span class="text-xs font-normal text-zinc-500">d</span>
							</p>
						</div>
						<div class="rounded-lg border border-zinc-800/50 bg-zinc-950/30 p-3">
							<p class="text-[10px] font-mono uppercase tracking-wider text-zinc-500">Last done</p>
							<p class="mt-1 text-lg font-bold tabular-nums text-zinc-100">
								{habit.daysSinceLast === null
									? "—"
									: habit.daysSinceLast === 0
										? "today"
										: `${habit.daysSinceLast}d`}
							</p>
						</div>
						<div class="rounded-lg border border-zinc-800/50 bg-zinc-950/30 p-3">
							<p class="text-[10px] font-mono uppercase tracking-wider text-zinc-500">Avg time</p>
							<p class="mt-1 text-lg font-bold tabular-nums text-zinc-100">
								{formatAverageHour(habit.avgCompletedHour)}
							</p>
						</div>
					</div>

					<div class="mt-5">
						<p class="mb-2 text-[10px] font-mono uppercase tracking-wider text-zinc-500">
							Consistency
						</p>
						<HabitContributionGrid
							doneDates={habit.doneDates}
							start={stats.range.start}
							end={stats.range.end}
							weekdayLabels
						/>
					</div>

					{#if habit.monthlyRates.length > 1}
						<div class="mt-5">
							<p class="mb-2 text-[10px] font-mono uppercase tracking-wider text-zinc-500">
								Monthly completion rate
							</p>
							<div class="flex items-end gap-1.5">
								{#each habit.monthlyRates as month (month.month)}
									<div class="flex min-w-0 flex-1 flex-col items-center gap-1">
										<div class="flex h-12 w-full items-end rounded-sm bg-zinc-800/60">
											<div
												class="w-full rounded-sm bg-accent-500/80"
												style={`height: ${Math.max(month.rate > 0 ? 6 : 0, month.rate * 100)}%`}
											></div>
										</div>
										<span class="truncate text-[9px] text-zinc-600">{month.month.slice(5)}</span>
									</div>
								{/each}
							</div>
						</div>
					{/if}

					<div class="mt-5 grid gap-5 sm:grid-cols-2">
						<div>
							<p class="mb-2 text-[10px] font-mono uppercase tracking-wider text-zinc-500">
								By weekday
							</p>
							<div class="flex items-end gap-1.5">
								{#each habit.byWeekday as count, index}
									{@const total = habit.byWeekdayTotal[index]}
									<div class="flex flex-1 flex-col items-center gap-1">
										<div class="flex h-14 w-full items-end rounded-sm bg-zinc-800/60">
											<div
												class="w-full rounded-sm bg-accent-500/80"
												style={`height: ${total === 0 ? 0 : Math.max(count > 0 ? 6 : 0, (count / total) * 100)}%`}
											></div>
										</div>
										<span class="text-[9px] text-zinc-600">{weekdayShortLabel(index)}</span>
									</div>
								{/each}
							</div>
							{#if habit.bestWeekday}
								<p class="mt-2 text-xs text-zinc-500">
									Most consistent on
									<span class="text-zinc-300">{weekdayShortLabel(habit.bestWeekday.index)}</span>
									({percent(habit.bestWeekday.rate)})
								</p>
							{/if}
						</div>

						<div>
							<p class="mb-2 text-[10px] font-mono uppercase tracking-wider text-zinc-500">
								Mood: done vs. missed
							</p>
							{#if mood && mood.delta !== null}
								<div class="space-y-2 text-xs text-zinc-400">
									<div class="grid grid-cols-[7.5rem_minmax(0,1fr)_3rem] items-center gap-2">
										<span>Done days:</span>
										<div class="h-2 rounded-full bg-zinc-800">
											<div
												class="h-2 rounded-full bg-accent-500"
												style={`width: ${ratingBarWidth(mood.doneAvg)}`}
											></div>
										</div>
										<span class="tabular-nums text-zinc-300">{mood.doneAvg ?? "—"}</span>
									</div>
									<div class="grid grid-cols-[7.5rem_minmax(0,1fr)_3rem] items-center gap-2">
										<span>Missed days:</span>
										<div class="h-2 rounded-full bg-zinc-800">
											<div
												class="h-2 rounded-full bg-zinc-500"
												style={`width: ${ratingBarWidth(mood.missedAvg)}`}
											></div>
										</div>
										<span class="tabular-nums text-zinc-300">{mood.missedAvg ?? "—"}</span>
									</div>
								</div>
								<p class="mt-2 text-xs text-zinc-500">
									{mood.delta > 0 ? "+" : ""}{mood.delta} average
									{mood.doneDays}d done / {mood.missedDays}d missed
									{#if mood.doneAvg !== null}
										· {getHappinessLabel(Math.round(mood.doneAvg)).toLowerCase()} vs {getHappinessLabel(
											Math.round(mood.missedAvg ?? 0),
										).toLowerCase()}
									{/if}
								</p>
							{:else}
								<p class="text-xs text-zinc-600">
									Not enough rated days in this period to compare.
								</p>
							{/if}
						</div>
					</div>
				</div>
			{/each}
		</div>

		{#if stats.dailyScores.length > 0}
			<div class="rounded-xl border border-zinc-800/60 bg-surface-900/80 p-4 shadow-2xl shadow-black/40 backdrop-blur-md sm:rounded-2xl sm:p-5">
				<div class="flex flex-wrap items-baseline justify-between gap-2">
					<p class="text-sm font-semibold text-zinc-200">Daily completion</p>
					<p class="text-xs text-zinc-500">
						bar height is habits completed ÷ habits tracked that day
					</p>
				</div>
				<div class="mt-4 flex h-28 items-end gap-px overflow-x-auto">
					{#each stats.dailyScores as day (day.date)}
						<div
							title={`${day.date} · ${day.done}/${day.total} habits${day.rating === null ? "" : ` · mood ${day.rating}`}`}
							class="flex h-full w-1.5 shrink-0 items-end"
						>
							<div
								class="w-full rounded-t-sm {day.done === day.total && day.total > 0
									? 'bg-emerald-500/80'
									: 'bg-accent-500/70'}"
								style={`height: ${barHeight(day.done, day.total)}`}
							></div>
						</div>
					{/each}
				</div>
				<div class="mt-2 flex items-center justify-between text-[10px] text-zinc-600">
					<span>{stats.range.start}</span>
					<span>{stats.range.end}</span>
				</div>
			</div>
		{/if}

		<p class="text-center text-[11px] text-zinc-600">
			"Average time" is when you saved the check-in, which is the closest available proxy for
			when you did the habit. Editing a past day updates it.
		</p>
	{/if}
</section>
