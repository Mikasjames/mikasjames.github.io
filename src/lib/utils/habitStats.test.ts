import { describe, expect, it } from 'vitest';
import {
	addDays,
	computePeriodStats,
	currentMonthKey,
	currentStreakOf,
	formatAverageHour,
	inclusiveDays,
	longestStreakOf,
	percent,
	rateBarWidth,
	ratingBarWidth,
	resolveRange,
	shiftMonthKey,
	weekdayOf,
	type HabitLogLite,
	type HabitMeta,
} from './habitStats';

// Date keys are local YYYY-MM-DD. Constructing with the local Date constructor
// keeps toLocaleDateString('en-CA') stable regardless of the runner's timezone.
function localDate(year: number, month: number, day: number, hours = 0): Date {
	return new Date(year, month - 1, day, hours, 0, 0, 0);
}

function habit(id: string, createdAt: Date | null = null): HabitMeta {
	return { id, name: id, emoji: '•', createdAt };
}

function log(habitId: string, date: string, completedAt: Date | null = null): HabitLogLite {
	return { habitId, date, completedAt };
}

const dayNumber = (key: string) => Math.floor(Date.parse(`${key}T00:00:00Z`) / 86_400_000);

describe('calendar helpers', () => {
	it('addDays crosses month and year boundaries', () => {
		expect(addDays('2026-07-31', 1)).toBe('2026-08-01');
		expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
		expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
		expect(addDays('2028-03-01', -1)).toBe('2028-02-29');
	});

	it('addDays is unaffected by daylight-saving transitions', () => {
		// Late March is when most DST shifts land; the day must not slip.
		expect(addDays('2026-03-28', 1)).toBe('2026-03-29');
		expect(addDays('2026-03-29', 1)).toBe('2026-03-30');
	});

	it('inclusiveDays counts both endpoints and never goes negative', () => {
		expect(inclusiveDays('2026-07-01', '2026-07-31')).toBe(31);
		expect(inclusiveDays('2026-07-01', '2026-07-01')).toBe(1);
		expect(inclusiveDays('2026-07-10', '2026-07-01')).toBe(0);
	});

	it('weekdayOf returns 0 for Sunday through 6 for Saturday', () => {
		expect(weekdayOf('2026-07-05')).toBe(0);
		expect(weekdayOf('2026-07-06')).toBe(1);
		expect(weekdayOf('2026-07-11')).toBe(6);
	});

	it('shiftMonthKey walks across year boundaries and clamps at January', () => {
		expect(shiftMonthKey('2026-07', 1)).toBe('2026-08');
		expect(shiftMonthKey('2026-12', 1)).toBe('2027-01');
		expect(shiftMonthKey('2026-01', -1)).toBe('2025-12');
	});

	it('currentMonthKey truncates a date key', () => {
		expect(currentMonthKey('2026-07-19')).toBe('2026-07');
	});
});

describe('longestStreakOf', () => {
	it('is zero for no days', () => {
		expect(longestStreakOf([])).toBe(0);
	});

	it('counts a single day', () => {
		expect(longestStreakOf([10])).toBe(1);
	});

	it('counts a consecutive run', () => {
		expect(longestStreakOf([1, 2, 3, 4, 5])).toBe(5);
	});

	it('breaks on a gap and keeps the longest run', () => {
		expect(longestStreakOf([1, 2, 3, 7, 8, 9, 20])).toBe(3);
	});

	it('ignores duplicates and unsorted input', () => {
		expect(longestStreakOf([5, 3, 4, 3, 4, 5, 6])).toBe(4);
	});
});

describe('currentStreakOf', () => {
	it('counts back from a completed final day', () => {
		const done = new Set([8, 9, 10]);
		expect(currentStreakOf(done, 10, false)).toBe(3);
	});

	it('does not punish an unfinished today', () => {
		// Today is the 10th and not logged yet, but the 8th and 9th were.
		const done = new Set([8, 9]);
		expect(currentStreakOf(done, 10, true)).toBe(2);
	});

	it('returns zero for a missed today with no live run', () => {
		const done = new Set([5, 6]);
		expect(currentStreakOf(done, 10, true)).toBe(0);
	});

	it('is unforgiving when the final day is in the past', () => {
		// The 10th is over and was missed, so the run really is broken.
		const done = new Set([8, 9]);
		expect(currentStreakOf(done, 10, false)).toBe(0);
	});

	it('stops at the first gap', () => {
		const done = new Set([4, 5, 6, 8, 9, 10]);
		expect(currentStreakOf(done, 10, false)).toBe(3);
	});
});

describe('resolveRange', () => {
	it('clamps a month range to today so future days are not scored', () => {
		const range = resolveRange({ kind: 'month', anchorMonth: '2026-07', today: '2026-07-10' });
		expect(range).toEqual({ start: '2026-07-01', end: '2026-07-10', days: 10 });
	});

	it('uses the full month for a past period', () => {
		const range = resolveRange({ kind: 'month', anchorMonth: '2026-01', today: '2026-07-10' });
		expect(range).toEqual({ start: '2026-01-01', end: '2026-01-31', days: 31 });
	});

	it('handles February in a leap year', () => {
		const range = resolveRange({ kind: 'month', anchorMonth: '2028-02', today: '2028-03-01' });
		expect(range.days).toBe(29);
	});

	it('clamps a year range to today', () => {
		const range = resolveRange({ kind: 'year', anchorYear: 2026, today: '2026-03-15' });
		expect(range).toEqual({ start: '2026-01-01', end: '2026-03-15', days: 74 });
	});

	it('bounds all-time by the earliest log', () => {
		const range = resolveRange({
			kind: 'all',
			today: '2026-07-10',
			logs: [log('h1', '2026-05-02'), log('h1', '2026-07-01')],
		});
		expect(range).toEqual({ start: '2026-05-02', end: '2026-07-10', days: 70 });
	});

	it('bounds all-time by habit creation when there are no logs', () => {
		const range = resolveRange({
			kind: 'all',
			today: '2026-07-10',
			habits: [habit('h1', localDate(2026, 6, 1))],
		});
		expect(range.start).toBe('2026-06-01');
	});

	it('collapses to a single day when there is no data at all', () => {
		const range = resolveRange({ kind: 'all', today: '2026-07-10' });
		expect(range).toEqual({ start: '2026-07-10', end: '2026-07-10', days: 1 });
	});
});

describe('computePeriodStats', () => {
	const today = '2026-07-10';

	it('returns an empty report with no habits and no logs', () => {
		const stats = computePeriodStats({
			habits: [],
			logs: [],
			ratingsByDate: {},
			kind: 'month',
			anchorMonth: '2026-07',
			today,
		});
		expect(stats.habits).toEqual([]);
		expect(stats.moodDeltas).toEqual([]);
		expect(stats.dailyScores).toEqual([]);
		expect(stats.totals.checkIns).toBe(0);
		expect(stats.totals.avgPerActiveDay).toBeNull();
	});

	it('scores a full month when the whole month is in the past', () => {
		const logs = [
			log('h1', '2026-06-01'),
			log('h1', '2026-06-02'),
			log('h1', '2026-06-03'),
		];
		const stats = computePeriodStats({
			habits: [habit('h1', localDate(2026, 1, 1))],
			logs,
			ratingsByDate: {},
			kind: 'month',
			anchorMonth: '2026-06',
			today,
		});
		const h = stats.habits[0];
		expect(h.checkIns).toBe(3);
		expect(h.eligibleDays).toBe(30);
		expect(h.completionRate).toBeCloseTo(3 / 30, 10);
	});

	it('counts a daily habit as a perfect 100% over a completed month', () => {
		const logs = Array.from({ length: 30 }, (_, i) =>
			log('h1', `2026-06-${String(i + 1).padStart(2, '0')}`),
		);
		const stats = computePeriodStats({
			habits: [habit('h1', localDate(2026, 1, 1))],
			logs,
			ratingsByDate: {},
			kind: 'month',
			anchorMonth: '2026-06',
			today,
		});
		expect(stats.habits[0].completionRate).toBe(1);
		// The range ends on 30 June, which is a completed day, so the streak at
		// the period end is the full 30 — it is not the live streak today.
		expect(stats.habits[0].currentStreak).toBe(30);
		expect(stats.habits[0].longestStreak).toBe(30);
		expect(stats.totals.perfectDays).toBe(30);
	});

	it('clamps eligible days to a habit created mid-period', () => {
		// Created on the 8th, done every day from the 8th to the 10th.
		const logs = ['2026-07-08', '2026-07-09', '2026-07-10'].map((d) => log('h1', d));
		const stats = computePeriodStats({
			habits: [habit('h1', localDate(2026, 7, 8))],
			logs,
			ratingsByDate: {},
			kind: 'month',
			anchorMonth: '2026-07',
			today,
		});
		const h = stats.habits[0];
		expect(h.activeFrom).toBe('2026-07-08');
		expect(h.eligibleDays).toBe(3);
		expect(h.completionRate).toBe(1);
	});

	it('falls back to the first log date when createdAt is unknown', () => {
		const logs = ['2026-07-08', '2026-07-09'].map((d) => log('h1', d));
		const stats = computePeriodStats({
			habits: [habit('h1', null)],
			logs,
			ratingsByDate: {},
			kind: 'month',
			anchorMonth: '2026-07',
			today,
		});
		const h = stats.habits[0];
		expect(h.activeFrom).toBe('2026-07-08');
		expect(h.eligibleDays).toBe(3);
	});

	it('does not count a habit with no logs and no name', () => {
		const stats = computePeriodStats({
			habits: [{ id: 'ghost', name: '', emoji: '', createdAt: null }],
			logs: [],
			ratingsByDate: {},
			kind: 'month',
			anchorMonth: '2026-07',
			today,
		});
		expect(stats.habits).toEqual([]);
	});

	it('excludes logs whose habit has been deleted', () => {
		// deleteHabit does not cascade, so orphaned logs must not resurface.
		const stats = computePeriodStats({
			habits: [habit('h1')],
			logs: [log('h1', '2026-07-01'), log('deleted-habit', '2026-07-02')],
			ratingsByDate: {},
			kind: 'month',
			anchorMonth: '2026-07',
			today,
		});
		expect(stats.habits).toHaveLength(1);
		expect(stats.habits[0].habitId).toBe('h1');
		expect(stats.totals.checkIns).toBe(1);
	});

	it('ignores logs outside the range', () => {
		const stats = computePeriodStats({
			habits: [habit('h1')],
			logs: [log('h1', '2026-06-15'), log('h1', '2026-07-05'), log('h1', '2026-08-01')],
			ratingsByDate: {},
			kind: 'month',
			anchorMonth: '2026-07',
			today,
		});
		expect(stats.habits[0].doneDates).toEqual(['2026-07-05']);
	});

	it('reports a live streak across the period end', () => {
		const stats = computePeriodStats({
			habits: [habit('h1')],
			logs: ['2026-07-06', '2026-07-07', '2026-07-08', '2026-07-09'].map((d) => log('h1', d)),
			ratingsByDate: {},
			kind: 'month',
			anchorMonth: '2026-07',
			today,
		});
		const h = stats.habits[0];
		// Today (the 10th) is not logged yet, but the run is still alive.
		expect(h.currentStreak).toBe(4);
		expect(h.daysSinceLast).toBe(1);
	});

	it('tracks first and last completion and days since', () => {
		const stats = computePeriodStats({
			habits: [habit('h1')],
			logs: [log('h1', '2026-07-02'), log('h1', '2026-07-10')],
			ratingsByDate: {},
			kind: 'month',
			anchorMonth: '2026-07',
			today,
		});
		const h = stats.habits[0];
		expect(h.firstDone).toBe('2026-07-02');
		expect(h.lastDone).toBe('2026-07-10');
		expect(h.daysSinceLast).toBe(0);
	});

	it('leaves streak fields empty for a habit never completed', () => {
		const stats = computePeriodStats({
			habits: [habit('h1')],
			logs: [],
			ratingsByDate: {},
			kind: 'month',
			anchorMonth: '2026-07',
			today,
		});
		const h = stats.habits[0];
		expect(h.firstDone).toBeNull();
		expect(h.lastDone).toBeNull();
		expect(h.daysSinceLast).toBeNull();
		expect(h.currentStreak).toBe(0);
		expect(h.avgCompletedHour).toBeNull();
	});

	it('averages the hour habits were completed', () => {
		const stats = computePeriodStats({
			habits: [habit('h1')],
			logs: [
				log('h1', '2026-07-08', localDate(2026, 7, 8, 7)),
				log('h1', '2026-07-09', localDate(2026, 7, 9, 8)),
			],
			ratingsByDate: {},
			kind: 'month',
			anchorMonth: '2026-07',
			today,
		});
		expect(stats.habits[0].avgCompletedHour).toBe(7.5);
	});

	it('splits mood ratings into completed versus missed days', () => {
		const stats = computePeriodStats({
			habits: [habit('h1', localDate(2026, 1, 1))],
			logs: [log('h1', '2026-07-09'), log('h1', '2026-07-10')],
			ratingsByDate: {
				'2026-07-08': 1,
				'2026-07-09': 5,
				'2026-07-10': 4,
			},
			kind: 'month',
			anchorMonth: '2026-07',
			today,
		});
		const mood = stats.moodDeltas[0];
		expect(mood.doneAvg).toBe(4.5);
		expect(mood.missedAvg).toBe(1);
		expect(mood.delta).toBe(3.5);
		expect(mood.doneDays).toBe(2);
		expect(mood.missedDays).toBe(1);
	});

	it('excludes pre-creation days from the missed average', () => {
		// Terrible mood on the 1st, before the habit existed on the 8th. Counting
		// it as a "miss" would poison the comparison.
		const stats = computePeriodStats({
			habits: [habit('h1', localDate(2026, 7, 8))],
			logs: [log('h1', '2026-07-08'), log('h1', '2026-07-09')],
			ratingsByDate: { '2026-07-01': 1, '2026-07-08': 4, '2026-07-09': 4 },
			kind: 'month',
			anchorMonth: '2026-07',
			today,
		});
		const mood = stats.moodDeltas[0];
		expect(mood.doneAvg).toBe(4);
		expect(mood.missedDays).toBe(0);
		expect(mood.missedAvg).toBeNull();
		expect(mood.delta).toBeNull();
	});

	it('reports no mood delta when nothing is rated', () => {
		const stats = computePeriodStats({
			habits: [habit('h1')],
			logs: [log('h1', '2026-07-10')],
			ratingsByDate: {},
			kind: 'month',
			anchorMonth: '2026-07',
			today,
		});
		expect(stats.moodDeltas[0].doneAvg).toBeNull();
		expect(stats.moodDeltas[0].delta).toBeNull();
	});

	it('counts perfect days across multiple habits', () => {
		const stats = computePeriodStats({
			habits: [habit('h1', localDate(2026, 1, 1)), habit('h2', localDate(2026, 1, 1))],
			logs: [
				log('h1', '2026-07-09'),
				log('h1', '2026-07-10'),
				log('h2', '2026-07-10'),
			],
			ratingsByDate: {},
			kind: 'month',
			anchorMonth: '2026-07',
			today,
		});
		expect(stats.totals.checkIns).toBe(3);
		expect(stats.totals.activeDays).toBe(2);
		// Only the 10th had both habits completed.
		expect(stats.totals.perfectDays).toBe(1);
		expect(stats.totals.trackedDays).toBe(10);
		expect(stats.totals.avgPerActiveDay).toBe(1.5);
		expect(stats.totals.habitCount).toBe(2);
	});

	it('scores each day against the habits actually eligible that day', () => {
		const stats = computePeriodStats({
			habits: [habit('h1'), habit('h2', localDate(2026, 7, 8))],
			logs: [log('h1', '2026-07-07')],
			ratingsByDate: { '2026-07-07': 3 },
			kind: 'month',
			anchorMonth: '2026-07',
			today,
		});
		const seventh = stats.dailyScores.find((d) => d.date === '2026-07-07');
		const tenth = stats.dailyScores.find((d) => d.date === '2026-07-10');
		expect(seventh).toMatchObject({ done: 1, total: 1, rating: 3 });
		expect(tenth).toMatchObject({ done: 0, total: 2, rating: null });
		// The 7th only had one habit to track, so it was a perfect day.
		expect(stats.totals.perfectDays).toBe(1);
	});

	it('buckets completions by weekday', () => {
		// 2026-07-05 is a Sunday, 2026-07-06 a Monday, 2026-07-07 a Tuesday.
		const stats = computePeriodStats({
			habits: [habit('h1')],
			logs: [log('h1', '2026-07-05'), log('h1', '2026-07-06'), log('h1', '2026-07-07')],
			ratingsByDate: {},
			kind: 'month',
			anchorMonth: '2026-07',
			today,
		});
		const h = stats.habits[0];
		expect(h.byWeekday[0]).toBe(1);
		expect(h.byWeekday[1]).toBe(1);
		expect(h.byWeekday[2]).toBe(1);
		expect(h.byWeekday[3]).toBe(0);
		// createdAt is null, so the habit only counts from its first log on the
		// 5th through the 10th: six eligible days, not the whole month.
		expect(h.byWeekdayTotal.reduce((a, b) => a + b, 0)).toBe(6);
		expect(h.byWeekdayTotal[0]).toBe(1);
		expect(h.byWeekdayTotal[1]).toBe(1);
		expect(h.bestWeekday).not.toBeNull();
	});

	it('reports the best weekday by rate, not raw count', () => {
		// Mondays get 2 of 2, Sundays get 1 of 2, so Monday must win on rate.
		const stats = computePeriodStats({
			habits: [habit('h1')],
			logs: [log('h1', '2026-07-06'), log('h1', '2026-07-13'), log('h1', '2026-07-05')],
			ratingsByDate: {},
			kind: 'month',
			anchorMonth: '2026-07',
			today,
		});
		// The 13th is outside the range (today is the 10th), so Monday is 1 of 1.
		expect(stats.habits[0].byWeekday[0]).toBe(1);
		expect(stats.habits[0].bestWeekday?.index).toBe(0);
	});

	it('breaks a year range into monthly rates', () => {
		const stats = computePeriodStats({
			habits: [habit('h1')],
			logs: [
				log('h1', '2026-01-05'),
				log('h1', '2026-01-06'),
				log('h1', '2026-02-05'),
			],
			ratingsByDate: {},
			kind: 'year',
			anchorYear: 2026,
			today: '2026-03-31',
		});
		const months = stats.habits[0].monthlyRates;
		expect(months.map((m) => m.month)).toEqual(['2026-01', '2026-02', '2026-03']);
		// January is only tracked from the 5th, the habit's first log.
		expect(months[0]).toMatchObject({ count: 2, days: 27 });
		expect(months[1]).toMatchObject({ count: 1, days: 28 });
		expect(months[2]).toMatchObject({ count: 0, days: 31 });
	});

	it('gives pre-creation months no days instead of a one-day denominator', () => {
		// Created 8 July, but the range is all of 2026. June ends before the
		// habit existed and must not be scored at all.
		const stats = computePeriodStats({
			habits: [habit('h1', localDate(2026, 7, 8))],
			logs: [log('h1', '2026-07-09')],
			ratingsByDate: {},
			kind: 'year',
			anchorYear: 2026,
			today: '2026-09-30',
		});
		const months = stats.habits[0].monthlyRates;
		expect(months.map((m) => m.month)).toEqual([
			'2026-01',
			'2026-02',
			'2026-03',
			'2026-04',
			'2026-05',
			'2026-06',
			'2026-07',
			'2026-08',
			'2026-09',
		]);
		for (const month of months.slice(0, 6)) {
			expect(month).toMatchObject({ days: 0, count: 0, rate: 0 });
		}
		// July is scored from the 8th onward only.
		expect(months[6]).toMatchObject({ days: 24, count: 1 });
		expect(months[6].rate).toBeCloseTo(1 / 24, 10);
	});

	it('keeps a log dated before activeFrom from inflating its month', () => {
		// A habit created on the 10th but with a stray 5th-of-the-month log.
		// July scores only the 10th onward, so that log must not be counted.
		const stats = computePeriodStats({
			habits: [habit('h1', localDate(2026, 7, 10))],
			logs: [log('h1', '2026-07-05'), log('h1', '2026-07-20')],
			ratingsByDate: {},
			kind: 'month',
			anchorMonth: '2026-07',
			today: '2026-07-31',
		});
		const july = stats.habits[0].monthlyRates[0];
		expect(july).toMatchObject({ days: 22, count: 1 });
		expect(july.rate).toBeCloseTo(1 / 22, 10);
	});

	it('tracks a full month when the habit predates the range', () => {
		const stats = computePeriodStats({
			habits: [habit('h1', localDate(2025, 6, 1))],
			logs: [log('h1', '2026-01-05'), log('h1', '2026-01-06')],
			ratingsByDate: {},
			kind: 'year',
			anchorYear: 2026,
			today: '2026-03-31',
		});
		const months = stats.habits[0].monthlyRates;
		expect(months[0]).toMatchObject({ count: 2, days: 31 });
		expect(months[1]).toMatchObject({ count: 0, days: 28 });
	});

	it('caps the completion rate when logs predate the habit record', () => {
		// Two logs but only one eligible day: the rate must not exceed 100%.
		const stats = computePeriodStats({
			habits: [habit('h1', localDate(2026, 7, 10))],
			logs: [log('h1', '2026-07-10'), log('h1', '2026-07-09')],
			ratingsByDate: {},
			kind: 'month',
			anchorMonth: '2026-07',
			today,
		});
		expect(stats.habits[0].eligibleDays).toBe(1);
		expect(stats.habits[0].completionRate).toBe(1);
	});

	it('carries streaks across an all-time range', () => {
		const stats = computePeriodStats({
			habits: [habit('h1')],
			logs: [
				log('h1', '2026-05-01'),
				log('h1', '2026-05-02'),
				log('h1', '2026-05-03'),
				log('h1', '2026-07-09'),
			],
			ratingsByDate: {},
			kind: 'all',
			today,
		});
		expect(stats.range.start).toBe('2026-05-01');
		const h = stats.habits[0];
		expect(h.longestStreak).toBe(3);
		expect(h.currentStreak).toBe(1);
	});

	it('handles a habit with no completedAt on any log', () => {
		const stats = computePeriodStats({
			habits: [habit('h1')],
			logs: [log('h1', '2026-07-10', null)],
			ratingsByDate: {},
			kind: 'month',
			anchorMonth: '2026-07',
			today,
		});
		expect(stats.habits[0].avgCompletedHour).toBeNull();
		expect(stats.habits[0].checkIns).toBe(1);
	});

	it('skips malformed logs without throwing', () => {
		const stats = computePeriodStats({
			habits: [habit('h1')],
			logs: [log('h1', '2026-07-05'), log('', '2026-07-06'), log('h1', '')],
			ratingsByDate: {},
			kind: 'month',
			anchorMonth: '2026-07',
			today,
		});
		expect(stats.habits[0].checkIns).toBe(1);
	});

	it('keeps the same day numbering as the raw keys', () => {
		const stats = computePeriodStats({
			habits: [habit('h1')],
			logs: [log('h1', '2026-07-10')],
			ratingsByDate: {},
			kind: 'month',
			anchorMonth: '2026-07',
			today,
		});
		expect(dayNumber(stats.range.start)).toBe(dayNumber('2026-07-01'));
	});
});

describe('display helpers', () => {
	it('percent formats rates', () => {
		expect(percent(0.5)).toBe('50%');
		expect(percent(1 / 3, 1)).toBe('33.3%');
	});

	it('rateBarWidth clamps to the 0-100 range', () => {
		expect(rateBarWidth(0.5)).toBe('50%');
		expect(rateBarWidth(2)).toBe('100%');
		expect(rateBarWidth(-1)).toBe('0%');
		expect(rateBarWidth(null)).toBe('0%');
	});

	it('ratingBarWidth maps the 1-5 scale onto the bar', () => {
		expect(ratingBarWidth(5)).toBe('100%');
		expect(ratingBarWidth(2.5)).toBe('50%');
		expect(ratingBarWidth(null)).toBe('0%');
	});

	it('formatAverageHour renders 12-hour time', () => {
		expect(formatAverageHour(0)).toBe('12 AM');
		expect(formatAverageHour(9)).toBe('9 AM');
		expect(formatAverageHour(12)).toBe('12 PM');
		expect(formatAverageHour(13.5)).toBe('1:30 PM');
		expect(formatAverageHour(23.25)).toBe('11:15 PM');
		expect(formatAverageHour(null)).toBe('—');
	});
});
