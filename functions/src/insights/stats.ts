import type { JournalInsightEntry, RatingPoint } from './types.js';

export type MonthRange = {
	year: number;
	month: number;
	start: Date;
	end: Date;
	key: string;
};

export function monthRangeFromPeriod(period: string): MonthRange {
	const match = /^(\d{4})-(\d{2})$/.exec(period);
	if (!match) {
		throw new Error(`Invalid period "${period}". Expected YYYY-MM.`);
	}

	const year = Number(match[1]);
	const month = Number(match[2]) - 1;
	if (year < 1000) {
		throw new Error(`Invalid period "${period}". Year must be four digits between 1000 and 9999.`);
	}
	if (month < 0 || month > 11) {
		throw new Error(`Invalid period "${period}". Month must be between 01 and 12.`);
	}

	const start = new Date(Date.UTC(year, month, 1));
	const end = new Date(Date.UTC(year, month + 1, 1));
	return {
		year,
		month,
		start,
		end,
		key: `${year}-${String(month + 1).padStart(2, '0')}`,
	};
}

export function maxInsightPeriod(reference = new Date()): string {
	const nextMonth = new Date(Date.UTC(reference.getUTCFullYear(), reference.getUTCMonth() + 1, 1));
	return `${nextMonth.getUTCFullYear()}-${String(nextMonth.getUTCMonth() + 1).padStart(2, '0')}`;
}

export function previousMonthRange(reference = new Date()): MonthRange {
	const year =
		reference.getUTCMonth() === 0 ? reference.getUTCFullYear() - 1 : reference.getUTCFullYear();
	const month = reference.getUTCMonth() === 0 ? 11 : reference.getUTCMonth() - 1;
	const start = new Date(Date.UTC(year, month, 1));
	const end = new Date(Date.UTC(year, month + 1, 1));
	return {
		year,
		month,
		start,
		end,
		key: `${year}-${String(month + 1).padStart(2, '0')}`,
	};
}

export function average(values: number[]): number | null {
	if (values.length === 0) return null;
	return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function variance(values: number[]): number | null {
	if (values.length === 0) return null;
	const avg = average(values);
	if (avg === null) return null;
	return values.reduce((sum, value) => sum + (value - avg) ** 2, 0) / values.length;
}

export function trendSlope(points: RatingPoint[]): number | null {
	if (points.length < 2) return null;
	const xs = points.map((point) => point.time / 86_400_000);
	const ys = points.map((point) => point.rating);
	const xAvg = average(xs);
	const yAvg = average(ys);
	if (xAvg === null || yAvg === null) return null;

	let numerator = 0;
	let denominator = 0;
	for (let i = 0; i < points.length; i += 1) {
		numerator += (xs[i] - xAvg) * (ys[i] - yAvg);
		denominator += (xs[i] - xAvg) ** 2;
	}
	return denominator === 0 ? null : numerator / denominator;
}

export function dailyRatingPoints(entries: JournalInsightEntry[]): RatingPoint[] {
	const daily = new Map<string, { time: number; ratings: number[] }>();
	for (const entry of entries) {
		const date = entry.entryDate;
		const current = daily.get(date) ?? {
			time: Date.parse(`${date}T00:00:00.000Z`),
			ratings: [],
		};
		current.ratings.push(entry.rating);
		daily.set(date, current);
	}

	return [...daily.entries()]
		.map(([date, value]) => ({
			date,
			time: value.time,
			rating: average(value.ratings) ?? 0,
		}))
		.sort((a, b) => a.time - b.time);
}

export function longestStreak(
	points: RatingPoint[],
	predicate: (rating: number) => boolean,
): number {
	let longest = 0;
	let current = 0;
	let lastTime: number | null = null;
	const ALLOWED_GAP_MS = 90_000_000;

	for (const point of points) {
		const isConsecutive = lastTime === null || point.time - lastTime <= ALLOWED_GAP_MS;

		if (predicate(point.rating)) {
			if (isConsecutive) {
				current += 1;
			} else {
				current = 1;
			}
			longest = Math.max(longest, current);
		} else {
			current = 0;
		}
		lastTime = point.time;
	}
	return longest;
}
