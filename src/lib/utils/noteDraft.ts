const NOTE_DRAFT_PREFIX = "mj_note_draft_";

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
			return parsed as NoteDraft;
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
