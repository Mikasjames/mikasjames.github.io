import { beforeEach, describe, expect, it } from 'vitest';
import { saveNoteDraft, loadNoteDraft, clearNoteDraft } from './noteDraft';

const STORAGE_KEY_PREFIX = 'mj_note_draft_';

beforeEach(() => {
	localStorage.clear();
});

describe('noteDraft', () => {
	it('saveNoteDraft writes note data to localStorage', () => {
		saveNoteDraft('user-1', '2026-09-21', {
			content: 'Hello world',
			happinessRating: 4,
			showNote: true,
		});

		const raw = localStorage.getItem(`${STORAGE_KEY_PREFIX}user-1_2026-09-21`);
		expect(raw).not.toBeNull();
		const parsed = JSON.parse(raw!);
		expect(parsed.content).toBe('Hello world');
		expect(parsed.happinessRating).toBe(4);
		expect(parsed.showNote).toBe(true);
		expect(parsed.timestamp).toBeTypeOf('number');
	});

	it('loadNoteDraft returns the saved data', () => {
		saveNoteDraft('user-1', '2026-09-21', {
			content: 'Test note',
			happinessRating: 2,
			showNote: false,
		});

		const loaded = loadNoteDraft('user-1', '2026-09-21');
		expect(loaded).not.toBeNull();
		expect(loaded!.content).toBe('Test note');
		expect(loaded!.happinessRating).toBe(2);
		expect(loaded!.showNote).toBe(false);
	});

	it('loadNoteDraft returns null when no draft exists', () => {
		expect(loadNoteDraft('user-1', '2026-09-21')).toBeNull();
	});

	it('loadNoteDraft returns null on corrupted data', () => {
		localStorage.setItem(`${STORAGE_KEY_PREFIX}user-1_2026-09-21`, 'not-json');
		expect(loadNoteDraft('user-1', '2026-09-21')).toBeNull();
	});

	it('loadNoteDraft returns null when content is not a string', () => {
		localStorage.setItem(
			`${STORAGE_KEY_PREFIX}user-1_2026-09-21`,
			JSON.stringify({ content: 123 }),
		);
		expect(loadNoteDraft('user-1', '2026-09-21')).toBeNull();
	});

	it('clearNoteDraft removes the entry from localStorage', () => {
		saveNoteDraft('user-1', '2026-09-21', {
			content: 'To be cleared',
			happinessRating: 3,
			showNote: true,
		});
		expect(localStorage.getItem(`${STORAGE_KEY_PREFIX}user-1_2026-09-21`)).not.toBeNull();

		clearNoteDraft('user-1', '2026-09-21');
		expect(localStorage.getItem(`${STORAGE_KEY_PREFIX}user-1_2026-09-21`)).toBeNull();
	});

	it('drafts are keyed per user and per date', () => {
		saveNoteDraft('user-1', '2026-09-21', { content: 'A', happinessRating: 1, showNote: true });
		saveNoteDraft('user-1', '2026-09-22', { content: 'B', happinessRating: 2, showNote: false });
		saveNoteDraft('user-2', '2026-09-21', { content: 'C', happinessRating: 3, showNote: true });

		expect(loadNoteDraft('user-1', '2026-09-21')!.content).toBe('A');
		expect(loadNoteDraft('user-1', '2026-09-22')!.content).toBe('B');
		expect(loadNoteDraft('user-2', '2026-09-21')!.content).toBe('C');
	});

	it('saveNoteDraft overwrites a previous draft for the same key', () => {
		saveNoteDraft('user-1', '2026-09-21', { content: 'First', happinessRating: 1, showNote: true });
		saveNoteDraft('user-1', '2026-09-21', { content: 'Second', happinessRating: 5, showNote: false });

		const loaded = loadNoteDraft('user-1', '2026-09-21');
		expect(loaded!.content).toBe('Second');
		expect(loaded!.happinessRating).toBe(5);
		expect(loaded!.showNote).toBe(false);
	});
});
