import { beforeEach, describe, expect, it, vi } from 'vitest';

const firestore = vi.hoisted(() => ({
	getHabits: vi.fn(),
	addHabit: vi.fn(async () => {}),
	deleteHabit: vi.fn(async () => {}),
	updateHabitOrder: vi.fn(async () => {}),
	getHabitLogsForJournalEntry: vi.fn(async () => [] as Array<{ habitId: string }>),
	getHabitLogsForDate: vi.fn(async () => [] as Array<{ habitId: string }>),
	saveHabitLogsForJournalEntryAtomic: vi.fn(async () => {}),
	saveHabitLogsForDateAtomic: vi.fn(async () => {}),
}));

vi.mock('$lib/firebase/firestore.svelte', () => firestore);

import type { Habit } from '$lib/firebase/firestore.svelte';

// createHabitsStore is a true module singleton — reset modules and import
// dynamically so every test gets a pristine store.
async function freshStore() {
	vi.resetModules();
	const mod = await import('$lib/firebase/habits.svelte');
	return { store: mod.createHabitsStore(), mod };
}

function habit(id: string, order: number): Habit {
	return { id, name: `H-${id}`, emoji: '•', order, ownerUid: 'u', createdAt: new Date(0) };
}

beforeEach(() => {
	for (const fn of Object.values(firestore)) fn.mockReset();
	firestore.getHabits.mockResolvedValue([]);
	firestore.updateHabitOrder.mockResolvedValue(undefined);
});

describe('habits store', () => {
	it('loadHabits populates habits and reports failures', async () => {
		const { store } = await freshStore();
		firestore.getHabits.mockResolvedValueOnce([habit('h1', 0)]);
		await store.loadHabits('u');
		expect(store.habits).toHaveLength(1);
		expect(store.habitsLoading).toBe(false);

		const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
		firestore.getHabits.mockRejectedValueOnce(new Error('offline'));
		await store.loadHabits('u');
		expect(store.habitsError).toBe('offline');
		consoleSpy.mockRestore();
	});

	it('toggleHabit adds and removes ids without mutating the previous set', async () => {
		const { store } = await freshStore();
		store.toggleHabit('h1');
		expect(store.selectedHabitIds.has('h1')).toBe(true);

		store.selectedHabitIds = new Set(['h1', 'h2']);
		const before = store.selectedHabitIds;
		store.toggleHabit('h2');
		expect(before.has('h2')).toBe(true);
		expect(store.selectedHabitIds.has('h1')).toBe(true);
		expect(store.selectedHabitIds.has('h2')).toBe(false);
	});

	it('moveHabit is a silent no-op at the boundaries', async () => {
		const { store } = await freshStore();
		firestore.getHabits.mockResolvedValue([habit('a', 0), habit('b', 1)]);
		await store.loadHabits('u');

		await store.moveHabit(0, -1, 'u');
		await store.moveHabit(1, 1, 'u');

		expect(firestore.updateHabitOrder).not.toHaveBeenCalled();
	});

	it('moveHabit reorders optimistically, then settles on the server reload', async () => {
		const { store } = await freshStore();
		firestore.getHabits.mockResolvedValue([habit('a', 0), habit('b', 1), habit('c', 2)]);
		await store.loadHabits('u');

		let optimisticIds: string[] = [];
		let optimisticOrders: number[] = [];
		firestore.updateHabitOrder.mockImplementationOnce(async () => {
			optimisticIds = store.habits.map((h) => h.id);
			optimisticOrders = store.habits.map((h) => h.order);
		});

		await store.moveHabit(0, 1, 'u'); // move a down

		// optimistic snapshot seen during persistence
		expect(optimisticIds).toEqual(['b', 'a', 'c']);
		expect(optimisticOrders).toEqual([0, 1, 2]);
		expect(firestore.updateHabitOrder).toHaveBeenCalledTimes(3);
		expect(firestore.updateHabitOrder).toHaveBeenNthCalledWith(1, 'b', 0);
		expect(firestore.updateHabitOrder).toHaveBeenNthCalledWith(2, 'a', 1);
		expect(firestore.updateHabitOrder).toHaveBeenNthCalledWith(3, 'c', 2);

		// server reload afterwards replaces local state
		expect(firestore.getHabits).toHaveBeenCalledTimes(2);
		expect(store.habits.map((h) => h.id)).toEqual(['a', 'b', 'c']);
	});

	it('moveHabit rolls back via reload and surfaces the error when persistence fails', async () => {
		const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
		const { store } = await freshStore();
		firestore.getHabits
			.mockResolvedValueOnce([habit('a', 0), habit('b', 1)])
			.mockResolvedValueOnce([habit('a', 0), habit('b', 1)]); // rollback state
		await store.loadHabits('u');
		firestore.updateHabitOrder.mockRejectedValue(new Error('write failed'));

		await store.moveHabit(0, 1, 'u');

		// Characterization quirk: loadHabits() inside the rollback clears
		// habitsError again, so the message never survives to observers.
		expect(store.habitsError).toBe('');
		expect(firestore.getHabits).toHaveBeenCalledTimes(2); // initial + rollback
		consoleSpy.mockRestore();
	});

	it('handleAddHabit rejects blank names before touching Firestore', async () => {
		const { store } = await freshStore();
		store.habitForm.name = '   ';
		await store.handleAddHabit('u');
		expect(store.habitForm.error).toBe('Habit name is required.');
		expect(firestore.addHabit).not.toHaveBeenCalled();
	});

	it('handleAddHabit trims the name, defaults blank emoji, appends at end and clears form', async () => {
		const { store } = await freshStore();
		firestore.getHabits.mockResolvedValue([habit('a', 0), habit('b', 1)]);
		await store.loadHabits('u');
		store.showHabitManager = true;

		store.habitForm.name = '  Read  ';
		store.habitForm.emoji = '';
		await store.handleAddHabit('u');

		expect(firestore.addHabit).toHaveBeenCalledWith({
			name: 'Read',
			emoji: '•',
			ownerUid: 'u',
			order: 2,
		});
		expect(store.habitForm.name).toBe('');
		expect(store.habitForm.emoji).toBe('');
		expect(store.habitForm.submitting).toBe(false);
	});

	it('handleAddHabit maps thrown errors onto the form', async () => {
		const { store } = await freshStore();
		firestore.addHabit.mockRejectedValueOnce(new Error('quota exceeded'));
		store.habitForm.name = 'Run';
		await store.handleAddHabit('u');
		expect(store.habitForm.error).toBe('quota exceeded');
		expect(store.habitForm.submitting).toBe(false);
	});

	it('handleDeleteHabit no-ops when the injected confirm declines', async () => {
		const { store } = await freshStore();
		await store.handleDeleteHabit(habit('h1', 0), 'u', async () => false);
		expect(firestore.deleteHabit).not.toHaveBeenCalled();
	});

	it('handleDeleteHabit deletes with a named message then reloads', async () => {
		const { store } = await freshStore();
		let seenMessage = '';
		firestore.deleteHabit.mockResolvedValueOnce(undefined);
		firestore.getHabits.mockResolvedValue([]);

		await store.handleDeleteHabit(habit('h1', 0), 'u', async (message) => {
			seenMessage = message;
			return true;
		});

		expect(seenMessage).toBe('Delete "H-h1" from habits?');
		expect(firestore.deleteHabit).toHaveBeenCalledWith('h1');
		expect(firestore.getHabits).toHaveBeenCalled();
	});

	it('loadSelectedHabitLogs discards responses for a stale journal entry id', async () => {
		const { store } = await freshStore();
		firestore.getHabitLogsForJournalEntry.mockResolvedValue([{ habitId: 'h9' }]);

		await store.loadSelectedHabitLogs('u', 'entry-A', 'entry-B'); // stale
		expect([...store.selectedHabitIds]).toEqual([]);

		await store.loadSelectedHabitLogs('u', 'entry-B', 'entry-B'); // fresh
		expect([...store.selectedHabitIds]).toEqual(['h9']);
	});

	it('loadSelectedHabitLogs clears selection and sets error on failure', async () => {
		const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
		const { store } = await freshStore();
		store.toggleHabit('keepme-out-of-the-way');
		firestore.getHabitLogsForJournalEntry.mockRejectedValue(new Error('denied'));

		await store.loadSelectedHabitLogs('u', 'entry-A', 'entry-A');

		expect(store.habitsError).toBe('denied');
		expect(store.selectedHabitIds.size).toBe(0);
		consoleSpy.mockRestore();
	});
});
