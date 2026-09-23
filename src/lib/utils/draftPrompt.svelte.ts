import { clearNoteDraft } from "./noteDraft";

export interface DraftPromptFlags {
	habits: boolean;
	note: boolean;
}

export interface DraftPromptController {
	/** Whether the restore dialog should be shown (bindable). */
	show: boolean;
	readonly date: string | null;
	readonly habits: boolean;
	readonly note: boolean;
	/** Offer to restore drafts for `date`; replaces any open prompt. */
	open(date: string, habits: boolean, note: boolean): void;
	/** Apply the open prompt's drafts via `onRestore`, then close it. */
	restore(date: string): void;
	/** Delete the open prompt's drafts, then close it. */
	discard(date: string): void;
	/** Close the prompt without touching the stored drafts. */
	dismiss(): void;
}

/**
 * Shared state machine for the DraftRestoreDialog on the admin journal form
 * and the habits check-in page: which date's drafts are offered, and what
 * restoring/discard/dismissing does about them.
 */
export function createDraftPromptController(options: {
	getUid: () => string | null;
	clearHabitDraft: (uid: string, date: string) => void;
	onRestore: (date: string, flags: DraftPromptFlags) => void;
}): DraftPromptController {
	let prompt = $state<{ date: string; habits: boolean; note: boolean } | null>(null);

	return {
		get show() {
			return prompt !== null;
		},
		set show(_value: boolean) {
			// The dialog writes `show = false` before invoking its callback
			// (restore/discard/dismiss); that callback clears the prompt state
			// itself, so this write must not drop the flags it still needs.
			// Every close path runs one of those callbacks.
		},
		get date() {
			return prompt?.date ?? null;
		},
		get habits() {
			return prompt?.habits ?? false;
		},
		get note() {
			return prompt?.note ?? false;
		},
		open(date, habits, note) {
			prompt = { date, habits, note };
		},
		restore(date) {
			const flags = prompt;
			if (!flags || !options.getUid()) return;
			options.onRestore(date, flags);
			prompt = null;
		},
		discard(date) {
			// The stored selection is already displayed — just drop the drafts.
			const flags = prompt;
			prompt = null;
			const uid = options.getUid();
			if (!uid || !flags) return;
			if (flags.habits) options.clearHabitDraft(uid, date);
			if (flags.note) clearNoteDraft(uid, date);
		},
		dismiss() {
			// Dismissed (Escape/backdrop/✕): keep the drafts for next time.
			prompt = null;
		},
	};
}
