/**
 * Pure habit statistics. No I/O, no reactivity — everything here is a plain
 * function of the data handed to it, which keeps the maths unit-testable and
 * lets the same rules apply to any date range the UI asks for.
 *
 * The server pipeline in functions/src/insights/habits.ts computes a narrower
 * set of numbers for the AI prompt. This module is deliberately independent of
 * it: the numbers shown here are available the moment a check-in is saved,
 * with no scheduled job or LLM call involved.
 */

const DAY_MS = 86_400_000;

/** The habit fields stats actually need. */
export type HabitMeta = {
	id: string;
	name: string;
	emoji: string;
	createdAt: Date | null;
};

/** The habit log fields stats actually need. */
export type HabitLogLite = {
	habitId: string;
	date: string;
	completedAt: Date | null;
};

export type RangeKind = "month" | "year" | "all";

export type ResolvedRange = {
	start: string;
	end: string;
	days: number;
};

export type MonthRate = {
	month: string;
	count: number;
	days: number;
	rate: number;
};

export type HabitPeriodStats = {
	habitId: string;
	name: string;
	emoji: string;
	/** Completions inside the resolved range. */
	checkIns: number;
	/** Days the habit could have been completed for, clamped to its lifetime. */
	eligibleDays: number;
	/** checkIns / eligibleDays, capped at 1. */
	completionRate: number;
	currentStreak: number;
	longestStreak: number;
	firstDone: string | null;
	lastDone: string | null;
	daysSinceLast: number | null;
	/** Completion counts per weekday, index 0 = Sunday. */
	byWeekday: number[];
	/** Days each weekday had a chance to count, index 0 = Sunday. */
	byWeekdayTotal: number[];
	bestWeekday: { index: number; rate: number } | null;
	/** Mean local hour of `completedAt`, or null when no log carries one. */
	avgCompletedHour: number | null;
	monthlyRates: MonthRate[];
	doneDates: string[];
	/** First day counted towards `eligibleDays` (range start or habit creation). */
	activeFrom: string;
};

export type DailyScore = {
	date: string;
	done: number;
	total: number;
	rating: number | null;
};

export type MoodDelta = {
	habitId: string;
	name: string;
	emoji: string;
	doneAvg: number | null;
	missedAvg: number | null;
	delta: number | null;
	doneDays: number;
	missedDays: number;
};

export type PeriodTotals = {
	checkIns: number;
	/** Days in the range with at least one habit completed. */
	activeDays: number;
	/** Days where every habit eligible that day was completed. */
	perfectDays: number;
	/** Days in the range where at least one habit was eligible. */
	trackedDays: number;
	habitCount: number;
	avgPerActiveDay: number | null;
	bestCurrentStreak: number;
	longestStreakEver: number;
};

export type PeriodStats = {
	range: ResolvedRange;
	habits: HabitPeriodStats[];
	totals: PeriodTotals;
	dailyScores: DailyScore[];
	moodDeltas: MoodDelta[];
};

const WEEKDAY_LABELS = [
	"Sunday",
	"Monday",
	"Tuesday",
	"Wednesday",
	"Thursday",
	"Friday",
	"Saturday",
];

export function weekdayLabel(index: number): string {
	return WEEKDAY_LABELS[index] ?? "";
}

export function weekdayShortLabel(index: number): string {
	return (WEEKDAY_LABELS[index] ?? "").slice(0, 3);
}

// ---------------------------------------------------------------------------
// Calendar helpers
//
// Date keys are local YYYY-MM-DD strings (see todayDateKey in utils/date.ts).
// All arithmetic goes through UTC day numbers so daylight-saving transitions
// can never shift a day, while getUTCDay still yields the true weekday.
// ---------------------------------------------------------------------------

function dayNumber(dateKey: string): number {
	return Math.floor(Date.parse(`${dateKey}T00:00:00Z`) / DAY_MS);
}

function keyFromDayNumber(day: number): string {
	return new Date(day * DAY_MS).toISOString().slice(0, 10);
}

export function addDays(dateKey: string, days: number): string {
	return keyFromDayNumber(dayNumber(dateKey) + days);
}

export function weekdayOf(dateKey: string): number {
	return new Date(`${dateKey}T00:00:00Z`).getUTCDay();
}

function daysInMonth(year: number, month: number): number {
	return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function lastDayOfMonthKey(monthKey: string): string {
	const [year, month] = monthKey.split("-").map(Number);
	return `${monthKey}-${String(daysInMonth(year, month)).padStart(2, "0")}`;
}

/** Inclusive day count between two keys. */
export function inclusiveDays(start: string, end: string): number {
	return Math.max(0, dayNumber(end) - dayNumber(start) + 1);
}

function monthKeysBetween(start: string, end: string): string[] {
	const keys: string[] = [];
	let [year, month] = start.split("-").map(Number);
	const [endYear, endMonth] = end.split("-").map(Number);
	while (year < endYear || (year === endYear && month <= endMonth)) {
		keys.push(`${year}-${String(month).padStart(2, "0")}`);
		month += 1;
		if (month > 12) {
			month = 1;
			year += 1;
		}
	}
	return keys;
}

/** Local YYYY-MM-DD for a Date, matching the local date keys habits use. */
function localDateKey(date: Date): string {
	return date.toLocaleDateString("en-CA");
}

function clamp(value: string, min: string, max: string): string {
	if (value < min) return min;
	if (value > max) return max;
	return value;
}

// ---------------------------------------------------------------------------
// Range resolution
// ---------------------------------------------------------------------------

/**
 * Turn a range selector into concrete inclusive bounds. Future days are never
 * included, so the current month only ever penalises you up to today.
 * `all` is bounded by the earliest data available.
 */
export function resolveRange(input: {
	kind: RangeKind;
	anchorMonth?: string;
	anchorYear?: number;
	today: string;
	habits?: HabitMeta[];
	logs?: HabitLogLite[];
}): ResolvedRange {
	const { kind, today } = input;
	const end = today;

	if (kind === "month" && input.anchorMonth) {
		const start = `${input.anchorMonth}-01`;
		const bounded = clamp(lastDayOfMonthKey(input.anchorMonth), start, end);
		return { start, end: bounded, days: inclusiveDays(start, bounded) };
	}

	if (kind === "year" && input.anchorYear) {
		const year = input.anchorYear;
		const start = `${year}-01-01`;
		const last = `${year}-12-31`;
		const bounded = clamp(last, start, end);
		return { start, end: bounded, days: inclusiveDays(start, bounded) };
	}

	const candidates: string[] = [];
	for (const habit of input.habits ?? []) {
		if (habit.createdAt) candidates.push(localDateKey(habit.createdAt));
	}
	for (const log of input.logs ?? []) {
		if (log.date) candidates.push(log.date);
	}
	const earliest = candidates.length ? candidates.reduce((a, b) => (a < b ? a : b)) : end;
	// All time is anchored to when tracking actually began — the earliest of
	// any habit's creation and any log — rather than a fixed epoch, so a brand
	// new account does not report decades of empty days. Never start after
	// today, even if a clock skew put a log in the future.
	const start = earliest < end ? earliest : end;
	return { start, end, days: inclusiveDays(start, end) };
}

// ---------------------------------------------------------------------------
// Streaks
// ---------------------------------------------------------------------------

/**
 * Longest run of consecutive days in an ascending, de-duplicated day list.
 */
export function longestStreakOf(dayNumbers: number[]): number {
	if (dayNumbers.length === 0) return 0;
	const sorted = [...new Set(dayNumbers)].sort((a, b) => a - b);
	let longest = 1;
	let current = 1;
	for (let i = 1; i < sorted.length; i += 1) {
		current = sorted[i] === sorted[i - 1] + 1 ? current + 1 : 1;
		if (current > longest) longest = current;
	}
	return longest;
}

/**
 * Streak ending at the last day of the window.
 *
 * When that day is today it is not over yet, so an unlogged today must not kill
 * a live streak — the run is then measured from yesterday. For any past window
 * the final day is over, so a miss there correctly returns 0.
 */
export function currentStreakOf(
	doneDays: ReadonlySet<number>,
	endDay: number,
	endIsToday: boolean,
): number {
	let cursor = endDay;
	if (endIsToday && !doneDays.has(cursor)) cursor = endDay - 1;
	let streak = 0;
	while (doneDays.has(cursor)) {
		streak += 1;
		cursor -= 1;
	}
	return streak;
}

// ---------------------------------------------------------------------------
// Period statistics
// ---------------------------------------------------------------------------

function average(values: number[]): number | null {
	if (values.length === 0) return null;
	return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function round(value: number, places = 1): number {
	const factor = 10 ** places;
	return Math.round(value * factor) / factor;
}

export function computePeriodStats(input: {
	habits: HabitMeta[];
	logs: HabitLogLite[];
	ratingsByDate: Record<string, number>;
	kind: RangeKind;
	anchorMonth?: string;
	anchorYear?: number;
	today: string;
}): PeriodStats {
	const { habits, logs, ratingsByDate, today } = input;
	const range = resolveRange({ ...input, habits, logs });
	const startDay = dayNumber(range.start);
	const endDay = dayNumber(range.end);
	const endIsToday = range.end === today;

	// Group logs by habit, and only keep the ones inside the window.
	const byHabit = new Map<string, HabitLogLite[]>();
	for (const log of logs) {
		if (!log.habitId || !log.date) continue;
		const day = dayNumber(log.date);
		if (day < startDay || day > endDay) continue;
		const list = byHabit.get(log.habitId);
		if (list) list.push(log);
		else byHabit.set(log.habitId, [log]);
	}

	// Only habits that still exist are reported. deleteHabit does not cascade,
	// so orphaned logs would otherwise show up as ghost habits.
	const knownHabits = habits.filter(
		(habit) => habit.id && (habit.name || byHabit.has(habit.id)),
	);

	const stats: HabitPeriodStats[] = knownHabits.map((habit) => {
		const habitLogs = (byHabit.get(habit.id) ?? []).slice().sort((a, b) =>
			a.date < b.date ? -1 : a.date > b.date ? 1 : 0,
		);
		const doneDates = habitLogs.map((log) => log.date);
		const doneDays = new Set(doneDates.map(dayNumber));

		// The habit only counts from the later of the range start and its own
		// creation, so adding a habit mid-month cannot backdate a failure.
		// Every per-habit denominator derives from this date: eligibleDays, the
		// weekday opportunity counts, the scored window of each month, and which
		// days count as "missed" for the mood comparison.
		let activeFrom = range.start;
		if (habit.createdAt) {
			activeFrom = clamp(localDateKey(habit.createdAt), range.start, range.end);
		} else if (doneDates.length > 0 && doneDates[0] > range.start) {
			activeFrom = doneDates[0];
		}
		const activeFromDay = dayNumber(activeFrom);

		const eligibleDays = inclusiveDays(activeFrom, range.end);
		const checkIns = doneDates.length;
		const completionRate =
			eligibleDays > 0 ? Math.min(1, checkIns / eligibleDays) : 0;

		const byWeekday = [0, 0, 0, 0, 0, 0, 0];
		for (const date of doneDates) {
			byWeekday[weekdayOf(date)] += 1;
		}
		const byWeekdayTotal = [0, 0, 0, 0, 0, 0, 0];
		for (let day = activeFromDay; day <= endDay; day += 1) {
			byWeekdayTotal[weekdayOf(keyFromDayNumber(day))] += 1;
		}
		let bestWeekday: { index: number; rate: number } | null = null;
		for (let i = 0; i < 7; i += 1) {
			if (byWeekdayTotal[i] === 0) continue;
			const rate = byWeekday[i] / byWeekdayTotal[i];
			if (!bestWeekday || rate > bestWeekday.rate) {
				bestWeekday = { index: i, rate };
			}
		}

		const hours = habitLogs
			.map((log) => log.completedAt)
			.filter((value): value is Date => value instanceof Date && !Number.isNaN(value.getTime()))
			.map((value) => value.getHours());
		const avgCompletedHour = average(hours);

		// Each month is scored over the days the habit actually existed for.
		// A month that ends before activeFrom is emitted with days: 0 rather
		// than having its start clamped up to activeFrom, which would hand a
		// pre-creation month a bogus one-day denominator and a bar.
		const monthlyRates: MonthRate[] = monthKeysBetween(range.start, range.end).map(
			(month) => {
				const monthStart = `${month}-01`;
				const monthEnd = lastDayOfMonthKey(month);
				if (monthEnd < activeFrom) {
					return { month, count: 0, days: 0, rate: 0 };
				}
				const start = monthStart < activeFrom ? activeFrom : monthStart;
				const end = monthEnd < range.end ? monthEnd : range.end;
				const days = inclusiveDays(start, end);
				// Counted within the scored window, so a log dated before
				// activeFrom cannot inflate the rate against a shorter span.
				const count = doneDates.filter(
					(date) => date >= start && date <= end,
				).length;
				return { month, count, days, rate: days > 0 ? Math.min(1, count / days) : 0 };
			},
		);

		return {
			habitId: habit.id,
			name: habit.name,
			emoji: habit.emoji,
			checkIns,
			eligibleDays,
			completionRate,
			currentStreak: currentStreakOf(doneDays, endDay, endIsToday),
			longestStreak: longestStreakOf([...doneDays]),
			firstDone: doneDates[0] ?? null,
			lastDone: doneDates[doneDates.length - 1] ?? null,
			daysSinceLast:
				doneDates.length > 0 ? endDay - dayNumber(doneDates[doneDates.length - 1]) : null,
			byWeekday,
			byWeekdayTotal,
			bestWeekday,
			avgCompletedHour: avgCompletedHour === null ? null : round(avgCompletedHour),
			monthlyRates,
			doneDates,
			activeFrom,
		};
	});

	// Per-day completion against the habits actually eligible that day.
	const eligibleFrom = new Map<string, number>();
	for (const habit of stats) eligibleFrom.set(habit.habitId, dayNumber(habit.activeFrom));

	const dailyScores: DailyScore[] = [];
	const activeDays = new Set<number>();
	let perfectDays = 0;
	let totalCheckIns = 0;

	for (let day = startDay; day <= endDay; day += 1) {
		const date = keyFromDayNumber(day);
		let done = 0;
		let total = 0;
		for (const habit of stats) {
			const from = eligibleFrom.get(habit.habitId) ?? startDay;
			if (day < from) continue;
			total += 1;
			if (habit.doneDates.includes(date)) done += 1;
		}
		if (total === 0) continue;
		if (done > 0) activeDays.add(day);
		if (done === total) perfectDays += 1;
		totalCheckIns += done;
		dailyScores.push({ date, done, total, rating: ratingsByDate[date] ?? null });
	}

	// Mood on completed vs. missed days, skipping days the habit did not yet
	// exist for so pre-creation days never count as misses.
	const moodDeltas: MoodDelta[] = stats.map((habit) => {
		const from = eligibleFrom.get(habit.habitId) ?? startDay;
		const doneRatings: number[] = [];
		const missedRatings: number[] = [];
		for (const day of dailyScores) {
			const rating = day.rating;
			if (rating === null) continue;
			if (dayNumber(day.date) < from) continue;
			if (habit.doneDates.includes(day.date)) doneRatings.push(rating);
			else missedRatings.push(rating);
		}
		const doneAvg = average(doneRatings);
		const missedAvg = average(missedRatings);
		return {
			habitId: habit.habitId,
			name: habit.name,
			emoji: habit.emoji,
			doneAvg: doneAvg === null ? null : round(doneAvg, 2),
			missedAvg: missedAvg === null ? null : round(missedAvg, 2),
			delta:
				doneAvg === null || missedAvg === null ? null : round(doneAvg - missedAvg, 2),
			doneDays: doneRatings.length,
			missedDays: missedRatings.length,
		};
	});

	const trackedDays = dailyScores.length;

	return {
		range,
		habits: stats,
		totals: {
			checkIns: totalCheckIns,
			activeDays: activeDays.size,
			perfectDays,
			trackedDays,
			habitCount: stats.length,
			avgPerActiveDay: activeDays.size > 0 ? round(totalCheckIns / activeDays.size, 2) : null,
			bestCurrentStreak: stats.reduce((max, habit) => Math.max(max, habit.currentStreak), 0),
			longestStreakEver: stats.reduce((max, habit) => Math.max(max, habit.longestStreak), 0),
		},
		dailyScores,
		moodDeltas,
	};
}

// ---------------------------------------------------------------------------
// Display helpers
// ---------------------------------------------------------------------------

/** Percentage string for a 0..1 rate. */
export function percent(rate: number, places = 0): string {
	return `${(rate * 100).toFixed(places)}%`;
}

/** CSS width for a 0..1 rate bar. */
export function rateBarWidth(rate: number | null): string {
	if (typeof rate !== "number" || Number.isNaN(rate)) return "0%";
	return `${Math.max(0, Math.min(100, rate * 100))}%`;
}

/** CSS width for a 1..5 rating bar, matching the insights dashboard scale. */
export function ratingBarWidth(value: number | null): string {
	if (typeof value !== "number" || Number.isNaN(value)) return "0%";
	return `${Math.max(0, Math.min(100, (value / 5) * 100))}%`;
}

export function formatAverageHour(hour: number | null): string {
	if (hour === null) return "—";
	const whole = Math.floor(hour);
	const minutes = Math.round((hour - whole) * 60);
	const suffix = whole < 12 ? "AM" : "PM";
	const display = whole % 12 === 0 ? 12 : whole % 12;
	if (minutes === 0) return `${display} ${suffix}`;
	return `${display}:${String(minutes).padStart(2, "0")} ${suffix}`;
}

export function formatStreak(days: number): string {
	return days === 1 ? "1 day" : `${days} days`;
}

/** Anchor key for the month range selector. */
export function currentMonthKey(today: string): string {
	return today.slice(0, 7);
}

export function shiftMonthKey(monthKey: string, delta: number): string {
	const [year, month] = monthKey.split("-").map(Number);
	const next = new Date(Date.UTC(year, month - 1 + delta, 1));
	return `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function formatRangeLabel(range: ResolvedRange, kind: RangeKind): string {
	if (kind === "all") {
		const [year, month] = range.start.split("-");
		return `All time · from ${monthName(month)} ${year}`;
	}
	const [year, month] = range.start.split("-");
	return `${monthName(month)} ${year}`;
}

function monthName(month: string): string {
	const index = Number(month) - 1;
	return (
		[
			"January",
			"February",
			"March",
			"April",
			"May",
			"June",
			"July",
			"August",
			"September",
			"October",
			"November",
			"December",
		][index] ?? month
	);
}
