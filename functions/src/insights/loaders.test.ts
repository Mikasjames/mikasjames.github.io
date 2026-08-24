import { beforeEach, describe, expect, it, vi } from 'vitest';

type Doc = { id: string; data: () => Record<string, unknown> };

let docs: Doc[];
const whereCalls: unknown[][] = [];

vi.mock('../firebase.js', () => {
	function makeChain() {
		const chain: Record<string, unknown> = {
			where: (...args: unknown[]) => {
				whereCalls.push(args);
				return chain;
			},
			orderBy: () => chain,
			limit: () => chain,
			get: async () => ({ docs }),
		};
		return chain;
	}
	return {
		db: {
			collection: vi.fn(() => makeChain()),
		},
	};
});

import { db } from '../firebase.js';
import { loadHabitLogs, loadJournalEntries, loadYearEntries } from './loaders.js';

function doc(id: string, fields: Record<string, unknown>): Doc {
	return { id, data: () => fields };
}

beforeEach(() => {
	vi.clearAllMocks();
	whereCalls.length = 0;
	docs = [];
	vi.spyOn(console, 'warn').mockImplementation(() => {});
	vi.spyOn(console, 'log').mockImplementation(() => {});
});

describe('loadJournalEntries', () => {
	it('queries journal with owner and UTC half-open date range', async () => {
		await loadJournalEntries(new Date(Date.UTC(2026, 6, 1)), new Date(Date.UTC(2026, 7, 1)), 'u1');

		expect(db.collection).toHaveBeenCalledWith('journal');
		expect(whereCalls).toEqual([
			['ownerUid', '==', 'u1'],
			['entryDate', '>=', '2026-07-01'],
			['entryDate', '<', '2026-08-01'],
		]);
	});

	it('maps valid docs and defaults missing content to empty string', async () => {
		docs = [
			doc('a', { ownerUid: 'u1', entryDate: '2026-07-02', happinessRating: 4, content: 'text' }),
			doc('b', { ownerUid: 'u1', entryDate: '2026-07-03', happinessRating: 2, content: null }),
		];
		const entries = await loadJournalEntries(
			new Date(Date.UTC(2026, 6, 1)),
			new Date(Date.UTC(2026, 7, 1)),
			'u1',
		);

		expect(entries).toHaveLength(2);
		expect(entries[0]).toEqual({ id: 'a', uid: 'u1', entryDate: '2026-07-02', rating: 4, content: 'text' });
		expect(entries[1].content).toBe('');
	});

	it('warns and skips docs missing required fields or with non-number ratings', async () => {
		const warn = vi.mocked(console.warn as ReturnType<typeof vi.fn>);
		docs = [
			doc('bad-date', { ownerUid: 'u1', happinessRating: 3 }),
			doc('bad-rating', { ownerUid: 'u1', entryDate: '2026-07-05', happinessRating: '5' }),
			doc('no-uid', { entryDate: '2026-07-06', happinessRating: 3 }),
			doc('good', { ownerUid: 'u1', entryDate: '2026-07-07', happinessRating: 3 }),
		];

		const entries = await loadJournalEntries(
			new Date(Date.UTC(2026, 6, 1)),
			new Date(Date.UTC(2026, 7, 1)),
			'u1',
		);

		expect(entries.map((e) => e.id)).toEqual(['good']);
		expect(warn).toHaveBeenCalledTimes(3);
		expect(warn.mock.calls[0][0]).toContain('bad-date');
	});
});

describe('loadYearEntries', () => {
	it('bounds the query to the full calendar year', async () => {
		await loadYearEntries('u9', 2024);

		expect(db.collection).toHaveBeenCalledWith('journal');
		expect(whereCalls).toEqual([
			['ownerUid', '==', 'u9'],
			['entryDate', '>=', '2024-01-01'],
			['entryDate', '<', '2025-01-01'],
		]);
	});
});

describe('loadHabitLogs', () => {
	it('queries habitLogs by date range and projects only the needed fields', async () => {
		docs = [
			doc('l1', { habitId: 'h1', habitName: 'Prayer', date: '2026-07-02', extra: 'dropped' }),
			doc('l2', { habitId: 'h2', habitName: 'Gym', date: '2026-07-03' }),
		];

		const logs = await loadHabitLogs(
			new Date(Date.UTC(2026, 6, 1)),
			new Date(Date.UTC(2026, 7, 1)),
			'u1',
		);

		expect(db.collection).toHaveBeenCalledWith('habitLogs');
		expect(whereCalls).toEqual([
			['ownerUid', '==', 'u1'],
			['date', '>=', '2026-07-01'],
			['date', '<', '2026-08-01'],
		]);
		expect(logs).toEqual([
			{ habitId: 'h1', habitName: 'Prayer', date: '2026-07-02' },
			{ habitId: 'h2', habitName: 'Gym', date: '2026-07-03' },
		]);
	});

	it('warns and skips logs missing any required field', async () => {
		const warn = vi.mocked(console.warn as ReturnType<typeof vi.fn>);
		docs = [
			doc('no-name', { habitId: 'h1', date: '2026-07-02' }),
			doc('ok', { habitId: 'h1', habitName: 'Prayer', date: '2026-07-02' }),
		];

		const logs = await loadHabitLogs(
			new Date(Date.UTC(2026, 6, 1)),
			new Date(Date.UTC(2026, 7, 1)),
			'u1',
		);

		expect(logs).toHaveLength(1);
		expect(warn).toHaveBeenCalledTimes(1);
		expect(warn.mock.calls[0][0]).toContain('no-name');
	});
});
