<script lang="ts">
	import type { User } from "firebase/auth";
	import type { createInsightsStore } from "$lib/firebase/insights.svelte";

	interface HabitSummary {
		name: string;
		count: number;
		dates: string[];
	}

	type InsightsStore = ReturnType<typeof createInsightsStore>;

	let { user, insightsStore } = $props<{
		user: User;
		insightsStore: InsightsStore;
	}>();
</script>

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
							user.uid,
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
							user.uid,
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
			<div class="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
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
			<div class="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
				<div
					class="rounded-xl border border-zinc-800/60 bg-zinc-900/60 p-4"
				>
					<p class="text-2xl font-bold text-zinc-100">
						{typeof insightsStore.selectedScope?.averageRating ===
						"number"
							? `${(Math.ceil(insightsStore.selectedScope.averageRating * 100) / 100).toFixed(2)} / 5`
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
						{insightsStore.selectedScope?.streaks?.longestLowDays ??
							0}
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
				<p class="mb-3 text-sm font-semibold text-zinc-200">
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
								cx={insightsStore.selectedScope.dailyRatings
									.length === 1
									? 320
									: 24 +
										((point.time -
											insightsStore.selectedScope
												.dailyRatings[0].time) /
											(insightsStore.selectedScope
												.dailyRatings[
												insightsStore.selectedScope
													.dailyRatings.length - 1
											].time -
												insightsStore.selectedScope
													.dailyRatings[0].time)) *
											592}
								cy={24 + ((5 - point.rating) / 4) * 172}
								r="3"
								fill="currentColor"
								class="text-accent-300"
							/>
						{/each}
					</svg>
				{:else}
					<p class="py-8 text-center text-sm text-zinc-550">
						No daily ratings for this scope.
					</p>
				{/if}
			</div>

			<div
				class="mt-5 rounded-xl border border-zinc-800/60 bg-zinc-900/50 p-4"
			>
				<p class="mb-3 text-sm font-semibold text-zinc-200">
					{insightsStore.selectedScope?.textAnalysis?.source ===
					"gemini-api"
						? "Gemini"
						: "Groq"} Insights
				</p>
				{#if (insightsStore.selectedScope?.textAnalysis?.source === "groq-api" || insightsStore.selectedScope?.textAnalysis?.source === "gemini-api") && insightsStore.selectedResult}
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
								>{insightsStore.selectedResult
									.overallSentiment}</span
							>
						{/if}
						{#if insightsStore.selectedResult.primaryEmotion}
							<span
								class="rounded-full border border-accent-500/20 bg-accent-500/10 px-2.5 py-1 text-xs text-accent-300"
								>{insightsStore.selectedResult
									.primaryEmotion}</span
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
							<table class="w-full text-left text-xs">
								<thead class="text-zinc-500">
									<tr
										><th class="py-2">Factor</th><th
											class="py-2">Impact</th
										><th class="py-2">Avg Rating</th></tr
									>
								</thead>
								<tbody
									class="divide-y divide-zinc-800/70 text-zinc-300"
								>
									{#each insightsStore.selectedResult.ratingCorrelations as row}
										<tr
											><td class="py-2">{row.factor}</td
											><td class="py-2">{row.impact}</td
											><td class="py-2"
												>{typeof row.averageRating ===
												"number"
													? (
															Math.ceil(
																row.averageRating *
																	100,
															) / 100
														).toFixed(2)
													: "—"}</td
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
						AI analysis unavailable for this period — showing
						keyword data only
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
						<div class="h-2 rounded-full bg-zinc-800">
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
					<p class="mb-3 text-sm font-semibold text-zinc-200">
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
									<p class="font-semibold text-zinc-100">
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
										<span>Completed days avg:</span>
										<div
											class="h-2 rounded-full bg-zinc-800"
										>
											<div
												class="h-2 rounded-full bg-accent-500"
												style={`width: ${insightsStore.ratingBarWidth(correlation.averageRatingOnCompletedDays)}`}
											></div>
										</div>
										<span class="text-zinc-300"
											>{typeof correlation.averageRatingOnCompletedDays ===
											"number"
												? (
														Math.ceil(
															correlation.averageRatingOnCompletedDays *
																100,
														) / 100
													).toFixed(2)
												: "—"}</span
										>
									</div>
									<div
										class="grid grid-cols-[8.5rem_minmax(0,1fr)_3rem] items-center gap-2"
									>
										<span>Missed days avg:</span>
										<div
											class="h-2 rounded-full bg-zinc-800"
										>
											<div
												class="h-2 rounded-full bg-zinc-500"
												style={`width: ${insightsStore.ratingBarWidth(correlation.averageRatingOnMissedDays)}`}
											></div>
										</div>
										<span class="text-zinc-300"
											>{typeof correlation.averageRatingOnMissedDays ===
											"number"
												? (
														Math.ceil(
															correlation.averageRatingOnMissedDays *
																100,
														) / 100
													).toFixed(2)
												: "—"}</span
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
					<p class="mb-3 text-sm font-semibold text-zinc-200">
						Habit Overview
					</p>
					<div class="space-y-4">
						{#each Object.entries(insightsStore.selectedScope.habitSummary.byHabit) as [habitId, habitData]}
							{@const habit = habitData as HabitSummary}
							<div>
								<div
									class="mb-2 flex items-center justify-between gap-3"
								>
									<p class="text-sm text-zinc-300">
										{habit.name}
									</p>
									<p class="text-xs font-mono text-zinc-500">
										{habit.count} / {insightsStore.daysInPeriod(
											insightsStore.selectedPeriod,
										)} days
									</p>
								</div>
								<div class="flex flex-wrap gap-1">
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
