const NOTE_DRAFT_PREFIX = "mj_note_draft_";

/** Drafts older than this are treated as abandoned and pruned on load. */
export const DRAFT_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export interface NoteDraft {
	content: string;
	happinessRating: number;
	showNote: boolean;
	timestamp: number;
}

function noteDraftKey(userId: string, date: string): string {
	return `${NOTE_DRAFT_PREFIX}${userId}_${date}`;
}

export function saveNoteDraft(
	userId: string,
	date: string,
	data: Pick<NoteDraft, "content" | "happinessRating" | "showNote">,
): void {
	// An empty note is never worth offering to restore — don't persist one.
	if (!data.content) return;
	try {
		localStorage.setItem(
			noteDraftKey(userId, date),
			JSON.stringify({ ...data, timestamp: Date.now() }),
		);
	} catch {
		// ignore
	}
}

export function loadNoteDraft(userId: string, date: string): NoteDraft | null {
	try {
		const raw = localStorage.getItem(noteDraftKey(userId, date));
		if (!raw) return null;
		const parsed = JSON.parse(raw);
		if (
			typeof parsed.content === "string" &&
			parsed.content !== "" &&
			typeof parsed.happinessRating === "number" &&
			typeof parsed.showNote === "boolean"
		) {
			if (
				typeof parsed.timestamp === "number" &&
				Date.now() - parsed.timestamp <= DRAFT_TTL_MS
			) {
				return parsed as NoteDraft;
			}
			// Expired (or timestamp missing/corrupt): treat as absent and prune.
			clearNoteDraft(userId, date);
			return null;
		}
		return null;
	} catch {
		return null;
	}
}

export function clearNoteDraft(userId: string, date: string): void {
	try {
		localStorage.removeItem(noteDraftKey(userId, date));
	} catch {
		// ignore
	}
}

export interface NoteDraftDebouncer {
	/**
	 * Schedule a debounced save of `content`, snapshotting the current mood
	 * state now — not when the timer fires.
	 */
	schedule(content: string): void;
	/** Run any pending save immediately (e.g. before a direct save). */
	flush(): void;
	/** Drop any pending save without running it. */
	cancel(): void;
}

export function createNoteDraftDebouncer(options: {
	getUid: () => string | null;
	getDate: () => string | null;
	getSnapshot: () => Pick<NoteDraft, "happinessRating" | "showNote">;
}): NoteDraftDebouncer {
	let timer: ReturnType<typeof setTimeout> | null = null;
	let pending: (() => void) | null = null;

	function runPending() {
		timer = null;
		const action = pending;
		pending = null;
		action?.();
	}

	return {
		schedule(content: string) {
			if (timer) clearTimeout(timer);
			// Capture the target uid/date and mood snapshot now — by the time
			// the timer fires the user may have navigated to another date/entry.
			const uid = options.getUid();
			const date = options.getDate();
			const snapshot = { ...options.getSnapshot(), content };
			pending = () => {
				if (!uid || !date) return;
				// Empty content means the user deleted their text — remove the
				// draft rather than leaving the old text around to restore later.
				if (!content) clearNoteDraft(uid, date);
				else saveNoteDraft(uid, date, snapshot);
			};
			timer = setTimeout(runPending, 500);
		},
		flush() {
			if (timer) {
				clearTimeout(timer);
				timer = null;
			}
			runPending();
		},
		cancel() {
			if (timer) clearTimeout(timer);
			timer = null;
			pending = null;
		},
	};
}
