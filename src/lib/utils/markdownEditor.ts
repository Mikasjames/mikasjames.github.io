export type FormatAction =
	| { kind: "wrap"; before: string; after: string; placeholder: string }
	| { kind: "prefix"; prefix: string; placeholder: string }
	| { kind: "block"; before: string; after: string; placeholder: string };

export function computeFormattedSelection(
	text: string,
	start: number,
	end: number,
	action: FormatAction
) {
	const selected = text.substring(start, end);
	const before = text.substring(0, start);
	const after = text.substring(end);

	let replacement: string;
	let cursorStart: number;
	let cursorEnd: number;

	if (action.kind === "wrap" || action.kind === "block") {
		const placeholderText = selected || action.placeholder;
		replacement = `${action.before}${placeholderText}${action.after}`;
		cursorStart = start + action.before.length;
		cursorEnd = cursorStart + placeholderText.length;
	} else {
		const lines = (selected || action.placeholder).split("\n");
		const prefixed = lines.map((l) => `${action.prefix}${l}`).join("\n");
		replacement = prefixed;
		cursorStart = start;
		cursorEnd = start + prefixed.length;
	}

	return {
		newContent: before + replacement + after,
		cursorStart,
		cursorEnd
	};
}