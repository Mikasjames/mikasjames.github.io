import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./ai.js', () => ({
	callTextAnalysis: vi.fn(),
	getAiProvider: vi.fn(() => 'gemini'),
}));
vi.mock('../firebase.js', () => ({ db: {} }));

import { callTextAnalysis } from './ai.js';
import type { LocalTextAnalysisResult } from './types.js';
import type { JournalInsightEntry } from './types.js';
import { buildInsight } from './index.js';

const mockedCall = vi.mocked(callTextAnalysis);

beforeEach(() => {
	mockedCall.mockReset();
});

function entry(rating: number, day: number, content = 'some journal text'): JournalInsightEntry {
	return {
		id: `e${day}-${rating}`,
		uid: 'u',
		content,
		rating,
		entryDate: new Date(Date.UTC(2026, 6, day)).toISOString().slice(0, 10),
	};
}

function localResult(topicAverages: LocalTextAnalysisResult['topicAverages']): LocalTextAnalysisResult {
	return {
		source: 'local-fallback',
		topicAverages,
		sentimentVsRating: {
			positiveWordCount: 0,
			negativeWordCount: 0,
			lexicalSentimentScore: 0,
			averageRating: null,
		},
		keywordFrequencyByRating: { highRated: {}, lowRated: {} },
	};
}

function habit(id: string, name: string) {
	return { habitId: id, habitName: name };
}

describe('buildInsight — return shape', () => {
	it('computes counts, averages, slope, variance and streaks', async () => {
		mockedCall.mockResolvedValue(localResult({}));
		const result = await buildInsight(
			[
				entry(5, 1),
				entry(4, 2),
				entry(2, 3),
				entry(2, 4),
				entry(5, 5),
			],
			[],
		);

		expect(result.entryCount).toBe(5);
		expect(result.ratedDayCount).toBe(5);
		expect(result.averageRating).toBeCloseTo(3.6);
		expect(result.trendSlopePerDay).toBeCloseTo(-0.2);
		expect(result.variance).toBeGreaterThan(0);
		expect(result.streaks.longestHighDays).toBe(2);
		expect(result.streaks.longestLowDays).toBe(2);
		expect(result.dailyRatings).toHaveLength(5);
	});
});

describe('buildInsight — programmaticFactors', () => {
	it('excludes topics seen on fewer than two days', async () => {
		mockedCall.mockResolvedValue(
			localResult({
				rareTopic: { count: 1, averageRating: 5 },
			}),
		);
		const result = await buildInsight([entry(3, 1)], []);
		expect(result.textAnalysis.source === 'groq-api').toBe(false);
		expect(
			(result.textAnalysis as Record<string, unknown>).ratingCorrelations,
		).toEqual([]);
	});

	it('applies the ±0.15 threshold boundaries against the period average', async () => {
		mockedCall.mockResolvedValue(
			localResult({
				atPositiveBoundary: { count: 2, averageRating: 3.15 },
				pastPositiveBoundary: { count: 2, averageRating: 3.16 },
				atNegativeBoundary: { count: 2, averageRating: 2.85 },
				pastNegativeBoundary: { count: 2, averageRating: 2.84 },
			}),
		);
		const result = await buildInsight([entry(3, 1), entry(3, 2)], []);

		const factors = (
			result.textAnalysis as Record<string, unknown>
		).ratingCorrelations as Array<{ factor: string; impact: string }>;
		const impactOf = (factor: string) =>
			factors.find((f) => f.factor === factor)?.impact;

		expect(impactOf('at positive boundary')).toBe('neutral');
		expect(impactOf('past positive boundary')).toBe('positive');
		expect(impactOf('at negative boundary')).toBe('neutral');
		expect(impactOf('past negative boundary')).toBe('negative');
	});

	it('converts camelCase topic keys into spaced lowercase labels and sorts by rating desc', async () => {
		mockedCall.mockResolvedValue(
			localResult({
				clientWork: { count: 2, averageRating: 4 },
				health: { count: 2, averageRating: 2 },
			}),
		);
		const result = await buildInsight([entry(3, 1), entry(3, 2)], []);

		const factors = (result.textAnalysis as Record<string, unknown>)
			.ratingCorrelations as Array<{ factor: string; averageRating: number }>;
		expect(factors.map((f) => f.factor)).toEqual(['client work', 'health']);
	});
});

describe('buildInsight — remote analysis merge', () => {
	function remoteFixture() {
		return {
			source: 'gemini-api' as const,
			model: 'gemini-test',
			result: {
				ratingCorrelations: [{ factor: 'ai-guessed', impact: 'positive', averageRating: 4 }],
				habitCorrelations: [
					{ habit: 'prayer', insight: 'AI insight for prayer' },
					{ habit: 'Reading', insight: 'AI insight for reading' },
				],
			},
			fallback: localResult({}),
		};
	}

	it('replaces AI-guessed ratingCorrelations with computed factors', async () => {
		mockedCall.mockResolvedValue(
			Object.assign(remoteFixture(), {
				fallback: localResult({ clientWork: { count: 2, averageRating: 4.5 } }),
			}),
		);
		const result = await buildInsight([entry(5, 1), entry(3, 2)], [habit('h1', 'Prayer')]);

		const textAnalysis = result.textAnalysis as Extract<
			typeof result.textAnalysis,
			{ source: 'groq-api' | 'gemini-api' }
		>;
		const factors = (textAnalysis.result as { ratingCorrelations: unknown[] })
			.ratingCorrelations;
		expect(factors).toEqual([
			{ factor: 'client work', impact: 'positive', averageRating: 4.5 },
		]);
	});

	it('merges AI insights into correlations case-insensitively, defaulting otherwise', async () => {
		mockedCall.mockResolvedValue(remoteFixture());
		const result = await buildInsight(
			[entry(5, 1), entry(3, 2)],
			[habit('h1', 'Prayer'), habit('h2', 'Meditation'), habit('h3', 'reading')],
		);

		const byHabit = Object.fromEntries(
			result.habitCorrelations.map((c) => [c.habitName, c.insight]),
		);
		expect(byHabit.Prayer).toBe('AI insight for prayer');
		expect(byHabit.Meditation).toBe('No qualitative analysis generated.');
		expect(byHabit.reading).toBe('AI insight for reading');
	});

	it('keeps default insights when AI returns no habitCorrelations array', async () => {
		const fixture = remoteFixture();
		delete (fixture.result as Record<string, unknown>).habitCorrelations;
		mockedCall.mockResolvedValue(fixture);

		const result = await buildInsight([entry(5, 1), entry(3, 2)], [habit('h1', 'Prayer')]);
		expect(result.habitCorrelations[0].insight).toBe(
			'No qualitative analysis generated.',
		);
	});
});

describe('buildInsight — local fallback path', () => {
	it('attaches ratingCorrelations directly to a local-fallback analysis', async () => {
		mockedCall.mockResolvedValue(localResult({ health: { count: 2, averageRating: 4.5 } }));
		const result = await buildInsight([entry(5, 1), entry(3, 2)], []);

		expect(result.textAnalysis.source).toBe('local-fallback');
		expect((result.textAnalysis as Record<string, unknown>).ratingCorrelations).toEqual([
			{ factor: 'health', impact: 'positive', averageRating: 4.5 },
		]);
	});

	it('skips AI entirely and uses ALL entries when no content exists', async () => {
		const result = await buildInsight(
			[entry(5, 1, '   '), entry(3, 2, '')],
			[],
		);

		expect(mockedCall).not.toHaveBeenCalled();
		expect(result.textAnalysis.source).toBe('local-fallback');
		// Characterization quirk: the fallback receives ALL entries, blanks included
		expect(result.entryCount).toBe(2);
	});

	it('passes only content-bearing entries to the AI', async () => {
		mockedCall.mockResolvedValue(localResult({}));
		await buildInsight(
			[entry(5, 1, 'real thoughts'), entry(3, 2, '   '), entry(4, 3, 'more thoughts')],
			[],
		);

		expect(mockedCall).toHaveBeenCalledTimes(1);
		const [passed] = mockedCall.mock.calls[0];
		expect(passed).toHaveLength(2);
		expect(passed.every((e) => e.content.trim().length > 0)).toBe(true);
	});
});

describe('buildInsight — habit summary passthrough', () => {
	it('includes the aggregated habit summary', async () => {
		mockedCall.mockResolvedValue(localResult({}));
		const logs = [
			{ habitId: 'h1', habitName: 'Prayer', date: '2026-07-01' },
			{ habitId: 'h1', habitName: 'Prayer', date: '2026-07-02' },
		];
		const result = await buildInsight([entry(5, 1), entry(4, 2)], logs);

		expect(result.habitSummary.totalCheckIns).toBe(2);
		expect(result.habitSummary.byHabit.h1.count).toBe(2);
		expect(result.habitCorrelations[0].habitName).toBe('Prayer');
	});
});
