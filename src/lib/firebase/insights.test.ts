import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('$lib/firebase/firestore.svelte', () => ({
	getLatestMonthlyInsight: vi.fn(),
	getMonthlyInsightByPeriod: vi.fn(),
}));

import {
	getLatestMonthlyInsight,
	getMonthlyInsightByPeriod,
} from '$lib/firebase/firestore.svelte';
import { createInsightsStore } from './insights.svelte';

const mockedGetLatest = vi.mocked(getLatestMonthlyInsight);
const mockedGetPeriod = vi.mocked(getMonthlyInsightByPeriod);

const DAY = 86_400_000;

beforeEach(() => {
	vi.clearAllMocks();
});

describe('createInsightsStore — initial state', () => {
	it('starts empty and idle', () => {
		const store = createInsightsStore();
		expect(store.insight).toBeNull();
		expect(store.loading).toBe(false);
		expect(store.error).toBe('');
		expect(store.tab).toBe('monthly');
		expect(store.selectedScope).toBeNull();
		expect(store.selectedResult).toBeNull();
	});
});

describe('createInsightsStore — period helpers', () => {
	const store = createInsightsStore();

	it.each([
		['2026-07', -1, '2026-06'],
		['2026-01', -1, '2025-12'],
		['2026-12', 1, '2027-01'],
		['2026-07', 0, '2026-07'],
		['2026-03', 11, '2027-02'],
	])('shiftPeriod(%s, %i) -> %s', (period, delta, expected) => {
		expect(store.shiftPeriod(period, delta)).toBe(expected);
	});

	it.each([
		['2026-07', 31],
		['2026-02', 28],
		['2024-02', 29],
		['2024-04', 30],
	])('daysInPeriod(%s) -> %i', (period, expected) => {
		expect(store.daysInPeriod(period)).toBe(expected);
	});

	it('falls back to 31 days for malformed periods', () => {
		expect(store.daysInPeriod('')).toBe(31);
	});

	it('formats valid periods as "Month YYYY" and passes malformed through', () => {
		expect(store.formatInsightPeriod('2026-07')).toBe('July 2026');
		expect(store.formatInsightPeriod('1999-01')).toBe('January 1999');
		expect(store.formatInsightPeriod('weird')).toBe('weird');
	});
});

describe('createInsightsStore — display math', () => {
	const store = createInsightsStore();

	it('converts ratings to clamped bar widths', () => {
		expect(store.ratingBarWidth(null)).toBe('0%');
		expect(store.ratingBarWidth(undefined)).toBe('0%');
		expect(store.ratingBarWidth(2.5)).toBe('50%');
		expect(store.ratingBarWidth(5)).toBe('100%');
		expect(store.ratingBarWidth(7)).toBe('100%');
		expect(store.ratingBarWidth(-1)).toBe('0%');
	});

	it('labels trends with a dead zone near zero', () => {
		expect(store.trendLabel(null)).toBe('→ steady');
		expect(store.trendLabel(undefined)).toBe('→ steady');
		expect(store.trendLabel(0)).toBe('→ steady');
		expect(store.trendLabel(0.005)).toBe('→ steady');
		expect(store.trendLabel(0.02)).toBe('↑ improving');
		expect(store.trendLabel(-0.5)).toBe('↓ declining');
	});

	it('builds an SVG path sorted by time, padded inside the viewBox', () => {
		const points = [
			{ date: '2026-07-02', time: DAY, rating: 1 },
			{ date: '2026-07-01', time: 0, rating: 5 },
		];
		expect(store.chartPoints(points)).toBe('M 24.0 24.0 L 616.0 196.0');
	});

	it('centers a single point horizontally', () => {
		const path = store.chartPoints([{ date: '2026-07-01', time: DAY * 3, rating: 3 }]);
		expect(path).toBe('M 320.0 110.0');
	});

	it('returns an empty path for no points', () => {
		expect(store.chartPoints([])).toBe('');
		expect(store.chartPoints(undefined as never)).toBe('');
	});
});

describe('createInsightsStore — loading behavior', () => {
	it('loadLatest stores the insight and selects its period', async () => {
		const store = createInsightsStore();
		mockedGetLatest.mockResolvedValue({ period: '2026-07' } as never);

		await store.loadLatest('user-1');

		expect(mockedGetLatest).toHaveBeenCalledWith('user-1');
		expect(store.insight).toEqual({ period: '2026-07' });
		expect(store.selectedPeriod).toBe('2026-07');
		expect(store.error).toBe('');
		expect(store.loading).toBe(false);
	});

	it('loadLatest surfaces error messages and clears loading', async () => {
		const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
		const store = createInsightsStore();
		mockedGetLatest.mockRejectedValue(new Error('offline'));

		await store.loadLatest('user-1');

		expect(store.error).toBe('offline');
		expect(store.loading).toBe(false);
		consoleSpy.mockRestore();
	});

	it('loadPeriod sets the requested period even when the fetch fails', async () => {
		const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
		const store = createInsightsStore();
		mockedGetPeriod.mockRejectedValue(new Error('boom'));

		await store.loadPeriod('user-1', '2025-03');

		expect(store.selectedPeriod).toBe('2025-03');
		expect(store.error).toBe('boom');
		consoleSpy.mockRestore();
	});

	it('habitCompletedOnDate checks against the selected period with zero padding', async () => {
		const store = createInsightsStore();
		mockedGetLatest.mockResolvedValue({ period: '2026-07' } as never);
		await store.loadLatest('user-1');

		expect(store.habitCompletedOnDate(['2026-07-05'], 5)).toBe(true);
		expect(store.habitCompletedOnDate(['2026-07-05'], 6)).toBe(false);
		expect(store.habitCompletedOnDate(['2026-07-01'], 1)).toBe(true);
		expect(store.habitCompletedOnDate([], 15)).toBe(false);
	});

	it('derives selectedScope/selectedResult/local analysis from tab + source', async () => {
		const remoteResult = { briefSummary: 'up month' };
		mockedGetLatest.mockResolvedValue({
			period: '2026-07',
			monthly: {
				textAnalysis: {
					source: 'gemini-api',
					result: remoteResult,
					fallback: { sentimentVsRating: { averageRating: 3 } },
				},
			},
		} as never);

		const store = createInsightsStore();
		await store.loadLatest('user-1');

		const scope = store.selectedScope as { textAnalysis: { source: string } } | null;
		expect(scope?.textAnalysis.source).toBe('gemini-api');
		expect(store.selectedResult).toEqual(remoteResult);
		expect(store.selectedLocalAnalysis).toEqual({
			sentimentVsRating: { averageRating: 3 },
		});

		store.tab = 'yearToDate';
		expect(store.selectedScope).toBeNull();
	});
});
