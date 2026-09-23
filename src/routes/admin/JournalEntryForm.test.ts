import { fireEvent, render, waitFor } from '@testing-library/svelte';
import { flushSync } from 'svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import JournalEntryForm from './JournalEntryForm.svelte';
import {
	getJournalEntryByDate,
	getJournalEntriesByMonth,
	getHabitLogsForDates,
	getHabitLogsForJournalEntry,
	getHabitLogsForDate,
	getHabits,
	upsertJournalEntry,
	saveHabitLogsForDateAtomic,
	saveHabitLogsForJournalEntryAtomic,
	type Habit,
	type HabitLog,
	type JournalEntry,
} from '$lib/firebase/firestore.svelte';
import { createHabitsStore } from '$lib/firebase/habits.svelte';
import { todayDateKey } from '$lib/utils/date';
import { MOCK_USER } from '../../../tests/fixtures/user';

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

vi.mock('$lib/stores/toast.svelte', () => ({
	toast: vi.fn(),
}));

const uid = MOCK_USER.uid;
const today = todayDateKey();
// Calendar arithmetic so DST shifts can never collapse this onto `today`.
const pastDate = (() => {
	const d = new Date();
	d.setHours(12, 0, 0, 0);
	d.setDate(d.getDate() - 1);
	return d.toLocaleDateString('en-CA');
})();

const habitsStore = createHabitsStore();
const loadJournalEntries = vi.fn().mockResolvedValue(undefined);

function createMockMediaStore() {
	return {
		mediaItems: [],
		mediaUploading: false,
		mediaUploadError: '',
		mediaLoadError: '',
		recentMediaItems: [],
		mediaLoaded: false,
		mediaLoading: false,
		deletingMediaIds: new Set<string>(),
		mediaHasMore: false,
		openMediaGallery: vi.fn(),
		handleGalleryUpload: vi.fn().mockResolvedValue(undefined),
		handleDeleteMedia: vi.fn(),
		loadRecentMedia: vi.fn(),
		loadMoreMediaItems: vi.fn(),
		loadMediaItems: vi.fn(),
	} as unknown as ReturnType<typeof import('$lib/firebase/media.svelte').createMediaStore>;
}

function renderForm() {
	return render(JournalEntryForm, {
		props: {
			user: MOCK_USER,
			mediaStore: createMockMediaStore(),
			habitsStore,
			loadJournalEntries,
		},
	});
}

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
		content: 'Entry body',
		coverImage: null,
		imageMeta: {},
		happinessRating: 3,
		ownerUid: uid,
		createdAt: null,
		updatedAt: null,
		...overrides,
	};
}

describe('JournalEntryForm draft persistence', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		localStorage.clear();
		vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
		vi.mocked(getJournalEntryByDate).mockResolvedValue(null);
		vi.mocked(getJournalEntriesByMonth).mockResolvedValue([]);
		vi.mocked(getHabitLogsForDates).mockResolvedValue({});
		vi.mocked(getHabitLogsForJournalEntry).mockResolvedValue([]);
		vi.mocked(getHabitLogsForDate).mockResolvedValue([]);
		vi.mocked(getHabits).mockResolvedValue([
			makeHabit('h1', 'Exercise'),
			makeHabit('h2', 'Read'),
		]);
		vi.mocked(upsertJournalEntry).mockResolvedValue('entry-1');
		vi.mocked(saveHabitLogsForDateAtomic).mockResolvedValue(undefined);
		vi.mocked(saveHabitLogsForJournalEntryAtomic).mockResolvedValue(undefined);

		// The habits store is a module singleton — reset it between tests.
		habitsStore.selectedHabitIds = new Set();
		habitsStore.showHabitManager = false;
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it('keeps the habit draft on dismiss without a second load', async () => {
		const entry = makeEntry({ id: 'entry-1', entryDate: pastDate });
		seedHabitDraft(pastDate, ['h1']);

		const { component, findByText, queryAllByRole } = renderForm();
		await component.startEditJournal(entry);
		flushSync();

		await findByText('Restore unsaved habits?');
		// The stored selection was loaded first, then the differing draft prompted.
		expect(getHabitLogsForJournalEntry).toHaveBeenCalledTimes(1);

		await fireEvent.keyDown(window, { key: 'Escape' });

		await waitFor(() => {
			expect(queryAllByRole('dialog')).toHaveLength(0);
			// Dismiss keeps the draft and adds no compensating load.
			expect(getHabitLogsForJournalEntry).toHaveBeenCalledTimes(1);
			expect(localStorage.getItem(habitDraftKey(pastDate))).not.toBeNull();
		});
	});

	it('does not prompt when the habit draft matches the stored logs', async () => {
		const entry = makeEntry({ id: 'entry-1', entryDate: pastDate });
		seedHabitDraft(pastDate, ['h1']);
		vi.mocked(getHabitLogsForJournalEntry).mockResolvedValue([
			{ habitId: 'h1' } as HabitLog,
		]);

		const { component, container } = renderForm();
		await component.startEditJournal(entry);
		flushSync();

		expect(getHabitLogsForJournalEntry).toHaveBeenCalledTimes(1);
		expect(container.querySelectorAll('[role="dialog"]')).toHaveLength(0);
		// The stored selection is what's displayed.
		expect(habitsStore.selectedHabitIds.has('h1')).toBe(true);
	});

	it('offers drafts on the pristine new-entry form', async () => {
		seedHabitDraft(today, ['h1']);
		seedNoteDraft(today, 'Fresh words');

		const { findByText, getByText, getByPlaceholderText } = renderForm();

		await findByText('Restore unsaved changes?');
		await fireEvent.click(getByText('Restore'));

		await waitFor(() => {
			expect(getByPlaceholderText(/on your mind/)).toHaveValue('Fresh words');
			expect(habitsStore.selectedHabitIds.has('h1')).toBe(true);
		});
	});

	it('shows one combined dialog for both drafts and restores both', async () => {
		const entry = makeEntry({ id: 'entry-1', entryDate: pastDate });
		seedHabitDraft(pastDate, ['h1']);
		seedNoteDraft(pastDate, 'Draft text');

		const { component, container, findByText, getByText, getByPlaceholderText } = renderForm();
		await component.startEditJournal(entry);

		await findByText('Restore unsaved changes?');
		expect(container.querySelectorAll('[role="dialog"]')).toHaveLength(1);
		expect(container).toHaveTextContent('habit selections and a journal note');

		await fireEvent.click(getByText('Restore'));

		await waitFor(() => {
			expect(habitsStore.selectedHabitIds.has('h1')).toBe(true);
			expect(getByPlaceholderText(/on your mind/)).toHaveValue('Draft text');
		});
	});

	it('discard clears both drafts after the stored selection was loaded', async () => {
		const entry = makeEntry({ id: 'entry-1', entryDate: pastDate });
		seedHabitDraft(pastDate, ['h1']);
		seedNoteDraft(pastDate, 'Draft text');

		const { component, findByText, getByText } = renderForm();
		await component.startEditJournal(entry);

		await findByText('Restore unsaved changes?');
		await fireEvent.click(getByText('Discard'));

		await waitFor(() => {
			expect(localStorage.getItem(habitDraftKey(pastDate))).toBeNull();
			expect(localStorage.getItem(noteDraftKey(pastDate))).toBeNull();
			expect(getHabitLogsForJournalEntry).toHaveBeenCalledTimes(1);
		});
	});

	it('loads the habit logs and opens no prompt when no drafts exist', async () => {
		const entry = makeEntry({ id: 'entry-1', entryDate: pastDate });

		const { component, container } = renderForm();
		await component.startEditJournal(entry);
		flushSync();

		expect(getHabitLogsForJournalEntry).toHaveBeenCalledWith(uid, 'entry-1');
		expect(container.querySelectorAll('[role="dialog"]')).toHaveLength(0);
	});

	it('prompts on entry-date change but performs no load compensation on dismiss', async () => {
		seedHabitDraft(pastDate, ['h1', 'h2']);

		const { container, findByText, queryAllByRole } = renderForm();

		await fireEvent.click(await findByText('Journal Details'));
		const dateInput = container.querySelector('#journal-entry-date') as HTMLInputElement;
		expect(dateInput).not.toBeNull();
		await fireEvent.input(dateInput, { target: { value: pastDate } });
		await fireEvent.change(dateInput);

		await findByText('Restore unsaved habits?');
		await fireEvent.keyDown(window, { key: 'Escape' });

		await waitFor(() => expect(queryAllByRole('dialog')).toHaveLength(0));
		// No load is skipped on the date-change path, so nothing to compensate…
		expect(getHabitLogsForJournalEntry).not.toHaveBeenCalled();
		// …but the draft is still kept.
		expect(localStorage.getItem(habitDraftKey(pastDate))).not.toBeNull();
	});

	it('resetJournalForm clears drafts for the outgoing date only', async () => {
		const entry = makeEntry({ id: 'entry-1', entryDate: pastDate });

		const { component } = renderForm();
		await component.startEditJournal(entry);
		flushSync();

		seedHabitDraft(pastDate, ['h1']);
		seedNoteDraft(pastDate, 'Draft text');
		seedHabitDraft(today, ['h2']);
		seedNoteDraft(today, 'Unrelated');

		component.resetJournalForm();
		flushSync();

		expect(localStorage.getItem(habitDraftKey(pastDate))).toBeNull();
		expect(localStorage.getItem(noteDraftKey(pastDate))).toBeNull();
		expect(localStorage.getItem(habitDraftKey(today))).not.toBeNull();
		expect(localStorage.getItem(noteDraftKey(today))).not.toBeNull();
	});

	it('defaults a new entry to today so habit toggles persist a draft', async () => {
		await habitsStore.loadHabits(uid);

		const { findByRole } = renderForm();

		const chip = await findByRole('button', { name: '💪 Exercise' });
		await fireEvent.click(chip);

		const raw = localStorage.getItem(habitDraftKey(today));
		expect(raw).not.toBeNull();
		expect(JSON.parse(raw!).selectedHabitIds).toEqual(['h1']);
	});

	it('persists a programmatic toolbar edit through the debounced note draft', async () => {
		vi.useFakeTimers();
		try {
			const { getByText, getByPlaceholderText } = renderForm();

			await fireEvent.click(getByText('Journal Details'));
			const textarea = getByPlaceholderText(/on your mind/) as HTMLTextAreaElement;
			expect(textarea.value).toBe('');

			await fireEvent.click(getByText('Insert Date & Time'));
			await vi.advanceTimersByTimeAsync(600);

			const saved = localStorage.getItem(noteDraftKey(today));
			expect(saved).not.toBeNull();
			expect(JSON.parse(saved!).content).toContain('### ');
		} finally {
			vi.useRealTimers();
		}
	});

	it('does not re-create a draft after Cancel Edit within the debounce window', async () => {
		vi.useFakeTimers();
		try {
			const entry = makeEntry({ id: 'entry-1', entryDate: pastDate });
			const { component, getByText, getByPlaceholderText } = renderForm();
			await component.startEditJournal(entry);
			flushSync();

			// The entry has content, so the editor is rendered as-is.
			const textarea = getByPlaceholderText(/on your mind/);
			await fireEvent.input(textarea, { target: { value: 'abandoned' } });
			await fireEvent.click(getByText('Cancel Edit'));
			await vi.advanceTimersByTimeAsync(600);

			// The pending save must be cancelled, not re-create the draft
			// that resetJournalForm just discarded.
			expect(localStorage.getItem(noteDraftKey(pastDate))).toBeNull();
			expect(localStorage.getItem(habitDraftKey(pastDate))).toBeNull();
		} finally {
			vi.useRealTimers();
		}
	});
});
