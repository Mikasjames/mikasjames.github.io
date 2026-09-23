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

	it('opens a single prompt for a habit draft after loading the stored selection', async () => {
		seedHabitDraft(todayDateKey(), ['h1']);

		const { container, findByText, queryByText } = render(HabitsPage);

		await findByText('Restore unsaved habits?');
		expect(container.querySelectorAll('[role="dialog"]')).toHaveLength(1);
		expect(queryByText('Restore unsaved changes?')).toBeNull();
		// The stored selection load always runs first.
		expect(getHabitLogsForDate).toHaveBeenCalledTimes(1);
	});

	it('does not prompt when the habit draft matches the stored selection', async () => {
		vi.mocked(getHabitLogsForDate).mockResolvedValue([{ habitId: 'h1' } as HabitLog]);
		seedHabitDraft(todayDateKey(), ['h1']);

		const { container, findByRole } = render(HabitsPage);

		// The stored selection was applied: load done, chips show h1 selected.
		const chip = await findByRole('button', { name: '💪 Exercise' });
		expect(chip.className).toContain('border-accent-500/50');
		await waitFor(() => expect(getHabitLogsForDate).toHaveBeenCalledTimes(1));
		await new Promise((resolve) => setTimeout(resolve, 20));
		// draft == stored ⇒ no prompt.
		expect(container.querySelectorAll('[role="dialog"]')).toHaveLength(0);
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

	it('keeps the draft on dismiss after the stored selection loaded', async () => {
		const date = todayDateKey();
		seedHabitDraft(date, ['h1']);
		// Keep the calendar cache cold so the DB path runs.
		vi.mocked(getJournalEntriesByMonth).mockReturnValue(never<JournalEntry[]>());

		const { findByText, queryAllByRole } = render(HabitsPage);

		await findByText('Restore unsaved habits?');
		await fireEvent.keyDown(window, { key: 'Escape' });

		await waitFor(() => {
			expect(queryAllByRole('dialog')).toHaveLength(0);
			// The load ran once, before the prompt; dismiss adds nothing.
			expect(getHabitLogsForDate).toHaveBeenCalledTimes(1);
			expect(localStorage.getItem(habitDraftKey(date))).not.toBeNull();
		});
	});

	it('shows the cached stored selection behind the prompt and keeps it on dismiss', async () => {
		const date = todayDateKey();
		const dayNumber = Number(date.slice(8, 10));
		const otherDay = dayNumber === 1 ? 2 : 1;
		const otherDate = `${date.slice(0, 8)}${String(otherDay).padStart(2, '0')}`;
		// The DB read never resolves: reaching a prompt for the other date
		// proves the warm-cache path was used instead.
		vi.mocked(getHabitLogsForDate).mockReturnValue(never<HabitLog[]>());
		vi.mocked(getHabitLogsForDates).mockResolvedValue({
			[date]: [{ habitId: 'h1' } as HabitLog],
			[otherDate]: [{ habitId: 'h1' } as HabitLog],
		});
		// Draft differs from the stored selection: user unchecked everything.
		seedHabitDraft(otherDate, []);

		const { findByText, getByText, findByRole, queryAllByRole } = render(HabitsPage);

		// Wait until the month cache is fully built before navigating: the
		// calendar grid only renders after cacheHabitLogsForMonth assigns
		// habitLogsByDate.
		await waitFor(() => {
			expect(getHabitLogsForDates).toHaveBeenCalled();
			expect(getByText('Sun')).toBeInTheDocument();
		});

		await fireEvent.click(getByText(String(otherDay)));

		await findByText('Restore unsaved habits?');
		// The stored (cached) selection is what's displayed behind the prompt.
		const chip = await findByRole('button', { name: '💪 Exercise' });
		expect(chip.className).toContain('border-accent-500/50');

		await fireEvent.keyDown(window, { key: 'Escape' });

		await waitFor(() => expect(queryAllByRole('dialog')).toHaveLength(0));
		expect(chip.className).toContain('border-accent-500/50');
		expect(localStorage.getItem(habitDraftKey(otherDate))).not.toBeNull();
		// Only today's initial (still pending) DB read was ever started.
		expect(getHabitLogsForDate).toHaveBeenCalledTimes(1);
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

	it('prompts for an empty habit draft when the stored selection is non-empty', async () => {
		vi.mocked(getHabitLogsForDate).mockResolvedValue([{ habitId: 'h1' } as HabitLog]);
		seedHabitDraft(todayDateKey(), []);

		const { findByText } = render(HabitsPage);

		await findByText('Restore unsaved habits?');
		// The stored load ran first — the prompt means draft != stored.
		expect(getHabitLogsForDate).toHaveBeenCalledTimes(1);
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

	it('does not prompt for a stale date when its habit load resolves after navigating away', async () => {
		const today = todayDateKey();
		seedNoteDraft(today, 'Old words');

		const resolvers: Array<(logs: HabitLog[]) => void> = [];
		vi.mocked(getHabitLogsForDate).mockImplementation(
			() => new Promise((resolve) => { resolvers.push(resolve); }),
		);

		const { container, findByText, getByText } = render(HabitsPage);

		// On first load the calendar cache isn't built yet, so loadDate(today)
		// suspends on the habit-log read.
		await waitFor(() => expect(getHabitLogsForDate).toHaveBeenCalledTimes(1));
		// The calendar grid only renders once the month cache has built.
		await findByText('Sun');

		const dayNumber = Number(today.slice(8, 10));
		const otherDay = dayNumber === 1 ? 2 : 1;
		await fireEvent.click(getByText(String(otherDay)));

		// The stale read now lands, after selectedDate has changed.
		resolvers.forEach((resolve) => resolve([]));
		await new Promise((resolve) => setTimeout(resolve, 20));

		expect(container.querySelectorAll('[role="dialog"]')).toHaveLength(0);
		expect(localStorage.getItem(noteDraftKey(today))).not.toBeNull();
	});

	it('removes the note draft when the text is deleted', async () => {
		vi.useFakeTimers();
		try {
			const { getByRole, getByPlaceholderText } = render(HabitsPage);
			flushSync();
			await vi.advanceTimersByTimeAsync(1);

			await fireEvent.click(getByRole('button', { name: '+ Write a Note' }));
			const textarea = getByPlaceholderText(/How was your day/);

			await fireEvent.input(textarea, { target: { value: 'hello' } });
			await vi.advanceTimersByTimeAsync(600);
			expect(localStorage.getItem(noteDraftKey(todayDateKey()))).not.toBeNull();

			await fireEvent.input(textarea, { target: { value: '' } });
			await vi.advanceTimersByTimeAsync(600);
			expect(localStorage.getItem(noteDraftKey(todayDateKey()))).toBeNull();
		} finally {
			vi.useRealTimers();
		}
	});

	it('removes the draft when the note is collapsed and cancels a pending save', async () => {
		vi.useFakeTimers();
		try {
			const { getByRole, getByPlaceholderText, getByText } = render(HabitsPage);
			flushSync();
			await vi.advanceTimersByTimeAsync(1);

			await fireEvent.click(getByRole('button', { name: '+ Write a Note' }));
			const textarea = getByPlaceholderText(/How was your day/);
			const date = todayDateKey();

			// Collapse with a settled draft: it must be removed.
			await fireEvent.input(textarea, { target: { value: 'hello' } });
			await vi.advanceTimersByTimeAsync(600);
			expect(localStorage.getItem(noteDraftKey(date))).not.toBeNull();
			await fireEvent.click(getByText('Journal Note'));
			expect(localStorage.getItem(noteDraftKey(date))).toBeNull();

			// Collapse inside the debounce window: the pending save must be
			// cancelled, not run after the collapse cleared the draft.
			await fireEvent.click(getByRole('button', { name: '+ Write a Note' }));
			const reopened = getByPlaceholderText(/How was your day/);
			await fireEvent.input(reopened, { target: { value: 'world' } });
			await fireEvent.click(getByText('Journal Note'));
			await vi.advanceTimersByTimeAsync(600);
			expect(localStorage.getItem(noteDraftKey(date))).toBeNull();
		} finally {
			vi.useRealTimers();
		}
	});

	it('keeps a pre-existing draft when mood changes with empty content', async () => {
		const date = todayDateKey();
		seedNoteDraft(date, 'Kept words');

		const { container } = render(HabitsPage);
		// The restore prompt may be open for the seeded draft; jsdom fires
		// events regardless of the backdrop.
		const range = await waitFor(() => {
			const el = container.querySelector('input[type="range"]');
			expect(el).not.toBeNull();
			return el as HTMLInputElement;
		});
		await fireEvent.input(range, { target: { value: '5' } });
		await fireEvent.change(range);

		const raw = localStorage.getItem(noteDraftKey(date));
		expect(raw).not.toBeNull();
		expect(JSON.parse(raw!).content).toBe('Kept words');
	});

	it('stores the latest mood when the slider moves within the debounce window', async () => {
		vi.useFakeTimers();
		try {
			const { getByRole, getByPlaceholderText, container } = render(HabitsPage);
			flushSync();
			await vi.advanceTimersByTimeAsync(1);

			await fireEvent.click(getByRole('button', { name: '+ Write a Note' }));
			const textarea = getByPlaceholderText(/How was your day/);
			await fireEvent.input(textarea, { target: { value: 'hello world' } });

			// Move the slider before the 500 ms debounce fires.
			const range = container.querySelector('input[type="range"]') as HTMLInputElement;
			await fireEvent.input(range, { target: { value: '5' } });
			await fireEvent.change(range);
			await vi.advanceTimersByTimeAsync(600);

			const raw = localStorage.getItem(noteDraftKey(todayDateKey()));
			expect(raw).not.toBeNull();
			const parsed = JSON.parse(raw!);
			expect(parsed.content).toBe('hello world');
			expect(parsed.happinessRating).toBe(5);
		} finally {
			vi.useRealTimers();
		}
	});
});
