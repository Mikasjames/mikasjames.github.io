import { fireEvent, render, waitFor } from '@testing-library/svelte';
import { flushSync } from 'svelte';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import HabitsPage from '../../../src/routes/habits/+page.svelte';
import { subscribeToAuth } from '$lib/firebase/auth';
import {
	getJournalEntryByDate,
	getJournalEntriesByMonth,
	getHabitLogsForDates,
	getHabitLogsForDate,
	getHabits,
	upsertJournalEntry,
	saveHabitLogsForDateAtomic,
	type HabitLog,
	type Habit,
	type JournalEntry,
} from '$lib/firebase/firestore.svelte';
import { createHabitsStore } from '$lib/firebase/habits.svelte';
import { todayDateKey } from '$lib/utils/date';
import { MOCK_USER } from '../../fixtures/user';

vi.mock('$lib/firebase/auth', () => ({
	subscribeToAuth: vi.fn(),
	logout: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('$lib/firebase/firestore.svelte', () => ({
	getJournalEntryByDate: vi.fn().mockResolvedValue(null),
	getJournalEntriesByMonth: vi.fn().mockResolvedValue([]),
	getHabitLogsForDates: vi.fn().mockResolvedValue({}),
	upsertJournalEntry: vi.fn().mockResolvedValue('entry-1'),
	getHabits: vi.fn().mockResolvedValue([]),
	addHabit: vi.fn().mockResolvedValue(undefined),
	deleteHabit: vi.fn().mockResolvedValue(undefined),
	updateHabitOrder: vi.fn().mockResolvedValue(undefined),
	getHabitLogsForJournalEntry: vi.fn().mockResolvedValue([]),
	getHabitLogsForDate: vi.fn().mockResolvedValue([]),
	saveHabitLogsForDateAtomic: vi.fn().mockResolvedValue(undefined),
	saveHabitLogsForJournalEntryAtomic: vi.fn().mockResolvedValue(undefined),
}));

const uid = MOCK_USER.uid;

function habitDraftKey(date: string) {
	return `mj_habit_draft_${uid}_${date}`;
}

function noteDraftKey(date: string) {
	return `mj_note_draft_${uid}_${date}`;
}

function seedHabitDraft(date: string, ids: string[]) {
	localStorage.setItem(
		habitDraftKey(date),
		JSON.stringify({ selectedHabitIds: ids, timestamp: Date.now() }),
	);
}

function seedNoteDraft(date: string, content: string) {
	localStorage.setItem(
		noteDraftKey(date),
		JSON.stringify({ content, happinessRating: 4, showNote: true, timestamp: Date.now() }),
	);
}

function makeHabit(id: string, name: string): Habit {
	return { id, name, emoji: '💪', ownerUid: uid, createdAt: null, order: 0 };
}

function makeEntry(overrides: Partial<JournalEntry> & { id: string; entryDate: string }): JournalEntry {
	return {
		title: 'Entry',
		excerpt: '',
		content: '',
		coverImage: null,
		imageMeta: {},
		happinessRating: 3,
		ownerUid: uid,
		createdAt: null,
		updatedAt: null,
		...overrides,
	};
}

/** A promise that never settles — used to keep the calendar cache from building. */
function never<T>() {
	return new Promise<T>(() => {});
}

describe('Habits page draft persistence', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		localStorage.clear();
		vi.mocked(subscribeToAuth).mockImplementation((cb) => {
			cb(MOCK_USER);
			return () => {};
		});
		vi.mocked(getJournalEntryByDate).mockResolvedValue(null);
		vi.mocked(getJournalEntriesByMonth).mockResolvedValue([]);
		vi.mocked(getHabitLogsForDates).mockResolvedValue({});
		vi.mocked(getHabitLogsForDate).mockResolvedValue([]);
		vi.mocked(getHabits).mockResolvedValue([
			makeHabit('h1', 'Exercise'),
			makeHabit('h2', 'Read'),
		]);
		vi.mocked(upsertJournalEntry).mockResolvedValue('entry-1');
		vi.mocked(saveHabitLogsForDateAtomic).mockResolvedValue(undefined);

		// The habits store is a module singleton — reset its selection so
		// drafts-only tests (which skip the load) start from a known state.
		const store = createHabitsStore();
		store.selectedHabitIds = new Set();
		store.showHabitManager = false;
	});

	it('opens a single prompt for a habit draft and skips the DB habit load', async () => {
		seedHabitDraft(todayDateKey(), ['h1']);

		const { container, findByText, queryByText } = render(HabitsPage);

		await findByText('Restore unsaved habits?');
		expect(container.querySelectorAll('[role="dialog"]')).toHaveLength(1);
		expect(queryByText('Restore unsaved changes?')).toBeNull();
		expect(getHabitLogsForDate).not.toHaveBeenCalled();
	});

	it('restores the habit draft into the selection', async () => {
		seedHabitDraft(todayDateKey(), ['h1']);

		const { findByText, findByRole, getByText } = render(HabitsPage);

		const chip = await findByRole('button', { name: '💪 Exercise' });
		expect(chip.className).not.toContain('border-accent-500/50');

		await findByText('Restore unsaved habits?');
		await fireEvent.click(getByText('Restore'));

		await waitFor(() => expect(chip.className).toContain('border-accent-500/50'));
	});

	it('keeps the draft on dismiss and completes the skipped load from the DB', async () => {
		const date = todayDateKey();
		seedHabitDraft(date, ['h1']);
		// Keep the calendar cache from ever building so dismiss falls back to the DB.
		vi.mocked(getJournalEntriesByMonth).mockReturnValue(never<JournalEntry[]>());

		const { findByText, queryAllByRole } = render(HabitsPage);

		await findByText('Restore unsaved habits?');
		await fireEvent.keyDown(window, { key: 'Escape' });

		await waitFor(() => {
			expect(queryAllByRole('dialog')).toHaveLength(0);
			expect(getHabitLogsForDate).toHaveBeenCalledWith(uid, date);
			expect(localStorage.getItem(habitDraftKey(date))).not.toBeNull();
		});
	});

	it('applies the cached selection on dismiss when the calendar cache is warm', async () => {
		const date = todayDateKey();
		seedHabitDraft(date, ['h1']);
		vi.mocked(getHabitLogsForDates).mockResolvedValue({
			[date]: [{ habitId: 'h1' } as HabitLog],
		});

		const { findByText, findByRole, getByText, queryAllByRole } = render(HabitsPage);

		await findByText('Restore unsaved habits?');
		// Wait until the month cache is fully built: the calendar grid only
		// renders again after cacheHabitLogsForMonth has assigned habitLogsByDate.
		await waitFor(() => {
			expect(getHabitLogsForDates).toHaveBeenCalled();
			expect(getByText('Sun')).toBeInTheDocument();
		});

		const chip = await findByRole('button', { name: '💪 Exercise' });
		expect(chip.className).not.toContain('border-accent-500/50');

		await fireEvent.keyDown(window, { key: 'Escape' });

		await waitFor(() => expect(chip.className).toContain('border-accent-500/50'));
		expect(queryAllByRole('dialog')).toHaveLength(0);
		expect(getHabitLogsForDate).not.toHaveBeenCalled();
	});

	it('shows one combined dialog for both drafts and restores both', async () => {
		const date = todayDateKey();
		seedHabitDraft(date, ['h1']);
		seedNoteDraft(date, 'Unsaved words');

		const { container, findByText, getByText, getByRole, getByPlaceholderText } = render(HabitsPage);

		await findByText('Restore unsaved changes?');
		expect(container.querySelectorAll('[role="dialog"]')).toHaveLength(1);
		expect(container).toHaveTextContent('habit selections and a journal note');

		await fireEvent.click(getByText('Restore'));

		await waitFor(() => {
			expect(getByRole('button', { name: '💪 Exercise' }).className).toContain(
				'border-accent-500/50',
			);
			expect(getByPlaceholderText(/How was your day/)).toHaveValue('Unsaved words');
		});
	});

	it('discard clears both drafts and loads the stored selection', async () => {
		const date = todayDateKey();
		seedHabitDraft(date, ['h1']);
		seedNoteDraft(date, 'Unsaved words');
		// Cache never builds → discard compensates via the DB.
		vi.mocked(getJournalEntriesByMonth).mockReturnValue(never<JournalEntry[]>());
		vi.mocked(getHabitLogsForDate).mockResolvedValue([{ habitId: 'h2' } as HabitLog]);

		const { findByText, getByText, getByRole } = render(HabitsPage);

		await findByText('Restore unsaved changes?');
		await fireEvent.click(getByText('Discard'));

		await waitFor(() => {
			expect(localStorage.getItem(habitDraftKey(date))).toBeNull();
			expect(localStorage.getItem(noteDraftKey(date))).toBeNull();
			expect(getHabitLogsForDate).toHaveBeenCalledWith(uid, date);
		});
		await waitFor(() =>
			expect(getByRole('button', { name: '💪 Read' }).className).toContain('border-accent-500/50'),
		);
	});

	it('prompts for an empty habit draft (all habits unchecked)', async () => {
		seedHabitDraft(todayDateKey(), []);

		const { findByText } = render(HabitsPage);

		await findByText('Restore unsaved habits?');
		expect(getHabitLogsForDate).not.toHaveBeenCalled();
	});

	it('does not prompt when the note draft matches the stored entry', async () => {
		const date = todayDateKey();
		vi.mocked(getJournalEntryByDate).mockResolvedValue(
			makeEntry({ id: 'entry-9', content: 'Stored words', entryDate: date }),
		);
		seedNoteDraft(date, 'Stored words');
		vi.mocked(getJournalEntriesByMonth).mockReturnValue(never<JournalEntry[]>());

		const { container, findByPlaceholderText } = render(HabitsPage);

		// The habit load ran (no habit draft) ⇒ the note-draft check has passed too.
		await waitFor(() => expect(getHabitLogsForDate).toHaveBeenCalled());
		await findByPlaceholderText(/How was your day/);
		await new Promise((r) => setTimeout(r, 0));
		expect(container.querySelectorAll('[role="dialog"]')).toHaveLength(0);
	});

	it('does not persist a note draft for mood-only changes', async () => {
		const date = todayDateKey();

		const { container } = render(HabitsPage);

		const range = await waitFor(() => {
			const el = container.querySelector('input[type="range"]');
			expect(el).not.toBeNull();
			return el as HTMLInputElement;
		});
		await fireEvent.input(range, { target: { value: '5' } });
		await fireEvent.change(range);

		expect(localStorage.getItem(noteDraftKey(date))).toBeNull();
	});

	it('captures the original date in the debounced note draft when navigating quickly', async () => {
		vi.useFakeTimers();
		try {
			const date = todayDateKey();
			const dayNumber = Number(date.slice(8, 10));
			const otherDay = dayNumber === 1 ? 2 : 1;
			const otherDate = `${date.slice(0, 8)}${String(otherDay).padStart(2, '0')}`;

			const { getByText, getByRole, getByPlaceholderText } = render(HabitsPage);
			flushSync();
			await vi.advanceTimersByTimeAsync(1);

			await fireEvent.click(getByRole('button', { name: '+ Write a Note' }));
			const textarea = getByPlaceholderText(/How was your day/);
			await fireEvent.input(textarea, { target: { value: 'hello world' } });

			// Navigate to another date before the 500 ms debounce fires.
			await fireEvent.click(getByText(String(otherDay)));
			await vi.advanceTimersByTimeAsync(600);

			const saved = localStorage.getItem(noteDraftKey(date));
			expect(saved).not.toBeNull();
			expect(JSON.parse(saved!).content).toBe('hello world');
			expect(localStorage.getItem(noteDraftKey(otherDate))).toBeNull();
		} finally {
			vi.useRealTimers();
		}
	});

	it('persists a habit toggle as a draft for the selected date', async () => {
		const date = todayDateKey();

		const { findByRole } = render(HabitsPage);

		const chip = await findByRole('button', { name: '💪 Exercise' });
		await fireEvent.click(chip);

		const raw = localStorage.getItem(habitDraftKey(date));
		expect(raw).not.toBeNull();
		expect(JSON.parse(raw!).selectedHabitIds).toEqual(['h1']);
	});

	it('clears both drafts after a successful save', async () => {
		const date = todayDateKey();
		seedHabitDraft(date, ['h1']);
		seedNoteDraft(date, 'Unsaved words');

		const { findByText, getByText } = render(HabitsPage);

		await findByText('Restore unsaved changes?');
		await fireEvent.click(getByText('Restore'));
		await fireEvent.click(getByText('Save Check-in'));

		await findByText('Saved!');
		expect(localStorage.getItem(habitDraftKey(date))).toBeNull();
		expect(localStorage.getItem(noteDraftKey(date))).toBeNull();
	});
});
