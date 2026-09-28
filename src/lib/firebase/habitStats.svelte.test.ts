import { beforeEach, describe, expect, it, vi } from 'vitest';

const firestore = vi.hoisted(() => ({
	getHabits: vi.fn(async () => [] as unknown[]),
	getAllHabitLogs: vi.fn(async () => [] as unknown[]),
	getAllJournalRatings: vi.fn(async () => ({}) as Record<string, number>),
	getHabitLogsInRange: vi.fn(async () => [] as unknown[]),
	getJournalRatingsInRange: vi.fn(async () => ({}) as Record<string, number>),
}));

vi.mock('$lib/firebase/firestore.svelte', () => firestore);

// Pin "today" so the range clamping is deterministic.
vi.mock('$lib/utils/date', () => ({
	todayDateKey: () => '2026-07-10',
}));

type HabitLog = { habitId: string; date: string; completedAt: Date | null };
type Habit = { id: string; name: string; emoji: string; createdAt: Date | null };

function habit(id: string, createdAt: Date | null = new Date(2026, 0, 1)): Habit {
	return { id, name: id, emoji: '•', createdAt };
}

function log(habitId: string, date: string): HabitLog {
	return { habitId, date, completedAt: null };
}

// createHabitStatsStore is a module singleton — reset modules and import
// dynamically so every test gets a pristine store.
async function freshStore() {
	vi.resetModules();
	const mod = await import('$lib/firebase/habitStats.svelte');
	return { store: mod.createHabitStatsStore(), mod };
}

beforeEach(() => {
	for (const fn of Object.values(firestore)) fn.mockReset();
	firestore.getHabits.mockResolvedValue([habit('h1')]);
	firestore.getAllHabitLogs.mockResolvedValue([]);
	firestore.getAllJournalRatings.mockResolvedValue({});
	firestore.getHabitLogsInRange.mockResolvedValue([]);
	firestore.getJournalRatingsInRange.mockResolvedValue({});
});

describe('habit stats store', () => {
	it('defaults to the current month and queries only that month', async () => {
		const { store } = await freshStore();
		await store.load('u');

		expect(store.kind).toBe('month');
		expect(store.anchorMonth).toBe('2026-07');
		// July ends on the 31st, but only today has happened.
		expect(firestore.getHabitLogsInRange).toHaveBeenCalledWith('u', '2026-07-01', '2026-07-10');
		expect(firestore.getJournalRatingsInRange).toHaveBeenCalledWith('u', '2026-07-01', '2026-07-10');
		expect(firestore.getAllHabitLogs).not.toHaveBeenCalled();
	});

	it('exposes computed stats after loading', async () => {
		const { store } = await freshStore();
		firestore.getHabitLogsInRange.mockResolvedValue([
			log('h1', '2026-07-09'),
			log('h1', '2026-07-10'),
		]);
		firestore.getJournalRatingsInRange.mockResolvedValue({ '2026-07-10': 4 });

		await store.load('u');

		expect(store.loading).toBe(false);
		expect(store.error).toBe('');
		expect(store.stats.totals.habitCount).toBe(1);
		expect(store.stats.habits[0].checkIns).toBe(2);
		expect(store.stats.habits[0].currentStreak).toBe(2);
		expect(store.stats.moodDeltas[0].doneAvg).toBe(4);
	});

	it('switches to the unbounded queries for all time', async () => {
		const { store } = await freshStore();
		firestore.getAllHabitLogs.mockResolvedValue([log('h1', '2026-05-01')]);
		await store.load('u');
		firestore.getAllHabitLogs.mockClear();
		firestore.getHabitLogsInRange.mockClear();

		await store.setKind('all');

		expect(store.kind).toBe('all');
		expect(firestore.getAllHabitLogs).toHaveBeenCalledWith('u');
		expect(firestore.getAllJournalRatings).toHaveBeenCalledWith('u');
		expect(firestore.getHabitLogsInRange).not.toHaveBeenCalled();
		// The habit was created on 1 Jan, so all-time starts there — not at its
		// first completion on 1 May. Tracking began before the first check-in.
		expect(store.stats.range.start).toBe('2026-01-01');
	});

	it('switches to year bounds and back', async () => {
		const { store } = await freshStore();
		await store.load('u');

		await store.setKind('year');
		expect(firestore.getHabitLogsInRange).toHaveBeenLastCalledWith('u', '2026-01-01', '2026-07-10');

		await store.setKind('month');
		expect(firestore.getHabitLogsInRange).toHaveBeenLastCalledWith('u', '2026-07-01', '2026-07-10');
	});

	it('ignores a redundant range change', async () => {
		const { store } = await freshStore();
		await store.load('u');
		firestore.getHabitLogsInRange.mockClear();

		await store.setKind('month');

		expect(firestore.getHabitLogsInRange).not.toHaveBeenCalled();
	});

	it('steps back through months and re-queries', async () => {
		const { store } = await freshStore();
		await store.load('u');

		await store.stepMonth(-1);
		expect(store.anchorMonth).toBe('2026-06');
		expect(firestore.getHabitLogsInRange).toHaveBeenLastCalledWith('u', '2026-06-01', '2026-06-30');

		await store.stepMonth(1);
		expect(store.anchorMonth).toBe('2026-07');
	});

	it('refuses to page past the current month', async () => {
		const { store } = await freshStore();
		await store.load('u');
		firestore.getHabitLogsInRange.mockClear();

		await store.stepMonth(1);

		expect(store.anchorMonth).toBe('2026-07');
		expect(firestore.getHabitLogsInRange).not.toHaveBeenCalled();
		expect(store.canStepForward()).toBe(false);
	});

	it('refuses to page past the current year', async () => {
		const { store } = await freshStore();
		await store.load('u');
		await store.setKind('year');

		await store.stepYear(1);

		expect(store.anchorYear).toBe(2026);
		expect(store.canStepForward()).toBe(false);
	});

	it('steps back through years', async () => {
		const { store } = await freshStore();
		await store.load('u');
		await store.setKind('year');

		await store.stepYear(-1);

		expect(store.anchorYear).toBe(2025);
		expect(firestore.getHabitLogsInRange).toHaveBeenLastCalledWith('u', '2025-01-01', '2025-12-31');
	});

	it('never steps forward in all-time mode', async () => {
		const { store } = await freshStore();
		await store.load('u');
		await store.setKind('all');

		expect(store.canStepForward()).toBe(false);
	});

	it('clamps both steppers against the same pinned "today"', async () => {
		// todayDateKey is mocked to 2026-07-10, so the current year is 2026.
		// Both steppers must read that value rather than a fresh Date().
		const { store } = await freshStore();
		await store.load('u');

		// The month stepper is anchored to 2026-07, the current month.
		expect(store.canStepForward()).toBe(false);

		await store.setKind('year');
		firestore.getHabitLogsInRange.mockClear();

		await store.stepYear(1);
		expect(store.anchorYear).toBe(2026);
		expect(firestore.getHabitLogsInRange).not.toHaveBeenCalled();

		await store.stepMonth(1);
		expect(store.anchorMonth).toBe('2026-07');
		expect(firestore.getHabitLogsInRange).not.toHaveBeenCalled();
	});

	it('agrees between stepYear and canStepForward on the boundary year', async () => {
		const { store } = await freshStore();
		await store.load('u');
		// 2025 is the year before the pinned 2026, so one step is legal.
		await store.setKind('year');
		await store.stepYear(-1);
		expect(store.anchorYear).toBe(2025);

		// 2025 can advance to 2026, which is the current year.
		expect(store.canStepForward()).toBe(true);
		await store.stepYear(1);
		expect(store.anchorYear).toBe(2026);
		expect(store.canStepForward()).toBe(false);
	});

	it('surfaces failures and clears stale data', async () => {
		const { store } = await freshStore();
		firestore.getHabitLogsInRange.mockResolvedValue([log('h1', '2026-07-10')]);
		await store.load('u');
		expect(store.stats.habits[0].checkIns).toBe(1);

		const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
		firestore.getHabitLogsInRange.mockRejectedValueOnce(new Error('offline'));
		await store.reload();

		expect(store.error).toBe('offline');
		expect(store.loading).toBe(false);
		expect(store.stats.habits[0].checkIns).toBe(0);
		consoleSpy.mockRestore();
	});

	it('excludes logs for habits that no longer exist', async () => {
		const { store } = await freshStore();
		firestore.getHabitLogsInRange.mockResolvedValue([
			log('h1', '2026-07-10'),
			log('deleted', '2026-07-10'),
		]);

		await store.load('u');

		expect(store.stats.habits).toHaveLength(1);
		expect(store.stats.habits[0].habitId).toBe('h1');
	});
});
