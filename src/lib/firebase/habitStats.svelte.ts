import {
	getHabits,
	getAllHabitLogs,
	getAllJournalRatings,
	getHabitLogsInRange,
	getJournalRatingsInRange,
	type Habit,
	type HabitLog,
} from "./firestore.svelte";
import {
	computePeriodStats,
	currentMonthKey,
	shiftMonthKey,
	type HabitLogLite,
	type HabitMeta,
	type PeriodStats,
	type RangeKind,
} from "../utils/habitStats";
import { todayDateKey } from "../utils/date";

let singleton: ReturnType<typeof makeStore> | null = null;

export function createHabitStatsStore() {
	if (!singleton) singleton = makeStore();
	return singleton;
}

function makeStore() {
	let kind = $state<RangeKind>("month");
	let anchorMonth = $state(currentMonthKey(todayDateKey()));
	let anchorYear = $state(new Date().getFullYear());
	let habits = $state<HabitMeta[]>([]);
	let logs = $state<HabitLogLite[]>([]);
	let ratingsByDate = $state<Record<string, number>>({});
	let loading = $state(false);
	let error = $state("");
	let today = $state(todayDateKey());
	let uid = $state("");

	const stats = $derived<PeriodStats>(
		computePeriodStats({
			habits,
			logs,
			ratingsByDate,
			kind,
			anchorMonth,
			anchorYear,
			today,
		}),
	);

	/** Query bounds for the selected range, or null for unbounded "all time". */
	function bounds(): { start: string; end: string } | null {
		if (kind === "month") {
			const [year, month] = anchorMonth.split("-").map(Number);
			const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
			return {
				start: `${anchorMonth}-01`,
				end: `${anchorMonth}-${String(lastDay).padStart(2, "0")}`,
			};
		}
		if (kind === "year") {
			return { start: `${anchorYear}-01-01`, end: `${anchorYear}-12-31` };
		}
		return null;
	}

	async function load(userUid: string) {
		uid = userUid;
		today = todayDateKey();
		loading = true;
		error = "";
		try {
			const [loadedHabits, data] = await Promise.all([
				getHabits(userUid),
				loadLogsAndRatings(userUid),
			]);
			habits = toMeta(loadedHabits);
			logs = toLite(data.logs);
			ratingsByDate = data.ratings;
		} catch (err: unknown) {
			console.error("Failed to load habit stats:", err);
			error = err instanceof Error ? err.message : "Failed to load habit stats.";
			logs = [];
			ratingsByDate = {};
		} finally {
			loading = false;
		}
	}

	function loadLogsAndRatings(userUid: string): Promise<{
		logs: HabitLog[];
		ratings: Record<string, number>;
	}> {
		const range = bounds();
		if (!range) {
			return Promise.all([getAllHabitLogs(userUid), getAllJournalRatings(userUid)]).then(
				([logs, ratings]) => ({ logs, ratings }),
			);
		}
		// Clamp to today so a current-month view never reads — or scores — days
		// that have not happened yet.
		const end = range.end < today ? range.end : today;
		return Promise.all([
			getHabitLogsInRange(userUid, range.start, end),
			getJournalRatingsInRange(userUid, range.start, end),
		]).then(([logs, ratings]) => ({ logs, ratings }));
	}

	async function reload() {
		if (!uid) return;
		loading = true;
		error = "";
		try {
			const data = await loadLogsAndRatings(uid);
			logs = toLite(data.logs);
			ratingsByDate = data.ratings;
		} catch (err: unknown) {
			console.error("Failed to load habit stats:", err);
			error = err instanceof Error ? err.message : "Failed to load habit stats.";
			logs = [];
			ratingsByDate = {};
		} finally {
			loading = false;
		}
	}

	/**
	 * The current year, derived from the same `today` the month stepper uses.
	 * Reading a fresh Date() here instead would let the two steppers disagree
	 * about "now" and drift apart across a midnight boundary.
	 */
	function currentYear(): number {
		return Number(today.slice(0, 4));
	}

	/** Each returns the reload promise so callers can await the new data. */
	async function setKind(next: RangeKind) {
		if (kind === next) return;
		kind = next;
		await reload();
	}

	/** Month stepper, clamped so you cannot page past the current month. */
	async function stepMonth(delta: number) {
		const next = shiftMonthKey(anchorMonth, delta);
		if (next > currentMonthKey(today)) return;
		anchorMonth = next;
		await reload();
	}

	async function stepYear(delta: number) {
		const next = anchorYear + delta;
		if (next > currentYear()) return;
		anchorYear = next;
		await reload();
	}

	function canStepForward(): boolean {
		if (kind === "month") return shiftMonthKey(anchorMonth, 1) <= currentMonthKey(today);
		if (kind === "year") return anchorYear + 1 <= currentYear();
		return false;
	}

	return {
		get kind() { return kind; },
		get anchorMonth() { return anchorMonth; },
		get anchorYear() { return anchorYear; },
		get today() { return today; },
		get loading() { return loading; },
		get error() { return error; },
		get stats() { return stats; },
		load,
		reload,
		setKind,
		stepMonth,
		stepYear,
		canStepForward,
	};
}

function toMeta(habits: Habit[]): HabitMeta[] {
	return habits.map((habit) => ({
		id: habit.id,
		name: habit.name,
		emoji: habit.emoji,
		createdAt: habit.createdAt,
	}));
}

function toLite(logs: HabitLog[]): HabitLogLite[] {
	return logs.map((log) => ({
		habitId: log.habitId,
		date: log.date,
		completedAt: log.completedAt,
	}));
}
