import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CallableRequest } from 'firebase-functions/v2/https';

const dbSpies = vi.hoisted(() => {
	const docCalls: string[] = [];
	const collectionCalls: string[] = [];
	const set = vi.fn<(payload: Record<string, unknown>, options?: unknown) => Promise<void>>(
		async () => {},
	);
	const get = vi.fn<() => Promise<{ data: () => Record<string, unknown> | undefined }>>(
		async () => ({ data: () => undefined }),
	);

	const makeNode = (): Record<string, unknown> => ({
		set,
		get,
		doc: (id: string) => {
			docCalls.push(id);
			return makeNode();
		},
		collection: (name: string) => {
			collectionCalls.push(name);
			return makeNode();
		},
	});

	return { db: makeNode(), set, get, docCalls, collectionCalls };
});

vi.mock('../firebase.js', () => ({ db: dbSpies.db }));

const loaderSpies = vi.hoisted(() => ({
	loadJournalEntries: vi.fn(),
	loadYearEntries: vi.fn(),
	loadHabitLogs: vi.fn(),
}));

vi.mock('./loaders.js', () => loaderSpies);

const aiSpies = vi.hoisted(() => ({
	callTextAnalysis: vi.fn(),
	getAiProvider: vi.fn(() => 'gemini'),
}));

vi.mock('./ai.js', () => aiSpies);

import { generateInsightsNow, processUserInsights } from './index.js';
import type { LocalTextAnalysisResult } from './types.js';

const OWNER_UID = 'owner-1';

function entry(day: number) {
	return {
		id: `e${day}`,
		uid: OWNER_UID,
		content: 'text',
		rating: 4,
		entryDate: `2025-03-${String(day).padStart(2, '0')}`,
	};
}

function localResult(): LocalTextAnalysisResult {
	return {
		source: 'local-fallback',
		topicAverages: {},
		sentimentVsRating: {
			positiveWordCount: 0,
			negativeWordCount: 0,
			lexicalSentimentScore: 0,
			averageRating: null,
		},
		keywordFrequencyByRating: { highRated: {}, lowRated: {} },
	};
}

function mockCallableRequest(authUid?: string, data: unknown = {}): CallableRequest<unknown> {
	return {
		auth: authUid ? { uid: authUid, token: {} as any } : undefined,
		data,
		rawRequest: {} as any,
	};
}

function findWrite(predicate: (payload: Record<string, unknown>) => boolean) {
	return dbSpies.set.mock.calls
		.map(([payload]) => payload as Record<string, unknown>)
		.find(predicate);
}

beforeEach(() => {
	vi.clearAllMocks();
	process.env.OWNER_UID = OWNER_UID;
	process.env.GROQ_API_KEY = 'test-key';
	process.env.GEMINI_API_KEY = 'test-key';

	loaderSpies.loadJournalEntries.mockResolvedValue([entry(1)]);
	loaderSpies.loadYearEntries.mockResolvedValue([entry(1), entry(2)]);
	loaderSpies.loadHabitLogs.mockResolvedValue([]);
	aiSpies.callTextAnalysis.mockResolvedValue(localResult());
	dbSpies.get.mockResolvedValue({ data: () => undefined });
	dbSpies.docCalls.length = 0;
	dbSpies.collectionCalls.length = 0;
});

describe('generateInsightsNow — selected period workflow', () => {
	it('queries the selected month and bounds year-to-date at its end', async () => {
		const result = await generateInsightsNow.run(
			mockCallableRequest(OWNER_UID, { period: '2025-03' }),
		);

		expect(result).toMatchObject({ ok: true, period: '2025-03' });

		expect(loaderSpies.loadJournalEntries).toHaveBeenCalledWith(
			new Date(Date.UTC(2025, 2, 1)),
			new Date(Date.UTC(2025, 3, 1)),
			OWNER_UID,
		);
		expect(loaderSpies.loadYearEntries).toHaveBeenCalledWith(
			OWNER_UID,
			2025,
			new Date(Date.UTC(2025, 3, 1)),
		);
		expect(loaderSpies.loadHabitLogs).toHaveBeenCalledWith(
			new Date(Date.UTC(2025, 2, 1)),
			new Date(Date.UTC(2025, 3, 1)),
			OWNER_UID,
		);
		expect(loaderSpies.loadHabitLogs).toHaveBeenCalledWith(
			new Date(Date.UTC(2025, 0, 1)),
			new Date(Date.UTC(2025, 3, 1)),
			OWNER_UID,
		);

		expect(dbSpies.docCalls).toContain('2025-03');
		expect(dbSpies.docCalls).toContain('2025');

		const monthlyWrite = findWrite((payload) => payload.period === '2025-03');
		expect(monthlyWrite).toMatchObject({
			period: '2025-03',
			monthly: { entryCount: 1 },
			yearToDate: { entryCount: 2 },
		});

		const yearlyWrite = findWrite((payload) => payload.year === 2025);
		expect(yearlyWrite).toMatchObject({
			year: 2025,
			asOfPeriod: '2025-03',
			yearly: { entryCount: 2 },
		});
	});

	it('does not replace a newer yearly snapshot when backfilling', async () => {
		dbSpies.get.mockResolvedValue({ data: () => ({ asOfPeriod: '2025-05' }) });

		await processUserInsights(OWNER_UID, '2025-03');

		expect(findWrite((payload) => payload.period === '2025-03')).toBeDefined();
		expect(findWrite((payload) => payload.year === 2025)).toBeUndefined();
	});
});
