import { fireEvent, render } from '@testing-library/svelte';
import { describe, expect, it, vi } from 'vitest';
import DraftRestoreDialog from './DraftRestoreDialog.svelte';

describe('DraftRestoreDialog', () => {
	const date = '2026-09-21';

	it('mentions only habits when only a habit draft exists', () => {
		const { container } = render(DraftRestoreDialog, {
			props: { show: true, date, restoreHabits: true, onRestore: vi.fn(), onDiscard: vi.fn(), onDismiss: vi.fn() },
		});
		expect(container).toHaveTextContent('unsaved habit selections');
		expect(container).not.toHaveTextContent('journal note');
		expect(container).toHaveTextContent('Restore unsaved habits?');
	});

	it('mentions only the note when only a note draft exists', () => {
		const { container } = render(DraftRestoreDialog, {
			props: { show: true, date, restoreNote: true, onRestore: vi.fn(), onDiscard: vi.fn(), onDismiss: vi.fn() },
		});
		expect(container).toHaveTextContent('unsaved journal note');
		expect(container).not.toHaveTextContent('habit selections');
		expect(container).toHaveTextContent('Restore unsaved note?');
	});

	it('combines both when habit and note drafts exist', () => {
		const { container } = render(DraftRestoreDialog, {
			props: {
				show: true,
				date,
				restoreHabits: true,
				restoreNote: true,
				onRestore: vi.fn(),
				onDiscard: vi.fn(),
				onDismiss: vi.fn(),
			},
		});
		expect(container).toHaveTextContent('habit selections and a journal note');
		expect(container).toHaveTextContent('Restore unsaved changes?');
	});

	it('calls onRestore with the date on confirm click', async () => {
		const onRestore = vi.fn();
		const onDiscard = vi.fn();
		const { getByText } = render(DraftRestoreDialog, {
			props: { show: true, date, restoreHabits: true, onRestore, onDiscard, onDismiss: vi.fn() },
		});

		await fireEvent.click(getByText('Restore'));
		expect(onRestore).toHaveBeenCalledWith(date);
		expect(onDiscard).not.toHaveBeenCalled();
	});

	it('calls onDiscard with the date on cancel click', async () => {
		const onRestore = vi.fn();
		const onDiscard = vi.fn();
		const { getByText } = render(DraftRestoreDialog, {
			props: { show: true, date, restoreHabits: true, onRestore, onDiscard, onDismiss: vi.fn() },
		});

		await fireEvent.click(getByText('Discard'));
		expect(onDiscard).toHaveBeenCalledWith(date);
		expect(onRestore).not.toHaveBeenCalled();
	});

	it('calls onDismiss (not onDiscard) when dismissed with Escape', async () => {
		const onDiscard = vi.fn();
		const onDismiss = vi.fn();
		render(DraftRestoreDialog, {
			props: { show: true, date, restoreHabits: true, onRestore: vi.fn(), onDiscard, onDismiss },
		});

		await fireEvent.keyDown(window, { key: 'Escape' });
		expect(onDismiss).toHaveBeenCalledWith(date);
		expect(onDiscard).not.toHaveBeenCalled();
	});
});
