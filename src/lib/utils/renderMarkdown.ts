import { Marked, type Tokens } from "marked";
import { sanitize } from "isomorphic-dompurify";
import { escapeHtml, transformMediaMarkdown } from "./mediaMarkdown";
import type { MediaDimensions } from "./mediaMeta";

/**
 * `marked` performs no sanitization, and its output is injected with `{@html}`,
 * so every tag and attribute that survives to the DOM has to be named here.
 *
 * The list is exactly what this module and `mediaMarkdown.ts` emit, plus the
 * elements `marked` itself produces. Everything else -- raw HTML typed into a
 * post body, `<script>`, `<style>`, `on*` handlers, `javascript:` URLs -- is
 * dropped. `style` is deliberately absent: image sizing lives in
 * `.prose-custom img` (src/app.css) rather than inline attributes.
 */
const ALLOWED_TAGS = [
	// emitted by marked
	"p", "br", "hr",
	"h1", "h2", "h3", "h4", "h5", "h6",
	"strong", "em", "del", "code", "pre",
	"blockquote", "ul", "ol", "li",
	"a", "table", "thead", "tbody", "tr", "th", "td",
	"input",
	// emitted by mediaMarkdown.ts / createImageRenderer below
	"div", "img", "iframe", "video", "source",
];

const ALLOWED_ATTR = [
	"href", "title", "src", "alt",
	"width", "height", "align", "class", "id",
	"loading", "controls", "preload", "frameborder",
	"allow", "allowfullscreen",
	"type", "checked", "disabled",
];

const SANITIZE_CONFIG = {
	ALLOWED_TAGS,
	ALLOWED_ATTR,
	ALLOW_DATA_ATTR: false,
	ALLOW_ARIA_ATTR: false,
};

/**
 * `imageMeta` is typed as numbers but arrives from Firestore, so coerce before
 * interpolating. A stringy `width` would otherwise break out of the attribute.
 */
function dimensionAttr(name: string, value: number | undefined): string {
	return typeof value === "number" && Number.isFinite(value) && value > 0
		? ` ${name}="${String(Math.round(value))}"`
		: "";
}

function createImageRenderer(meta: Record<string, MediaDimensions>) {
	return {
		image(token: Tokens.Image): string {
			const dimensions = meta[token.href];
			return (
				`<img src="${escapeHtml(token.href)}"` +
				` alt="${escapeHtml(token.text)}"` +
				` loading="lazy"` +
				`${dimensionAttr("width", dimensions?.width)}` +
				`${dimensionAttr("height", dimensions?.height)} />`
			);
		},
	};
}

export function renderMarkdown(
	md: string,
	imageMeta?: Record<string, MediaDimensions>,
): string {
	if (!md) return "";

	const meta = imageMeta ?? {};

	// A fresh `Marked` per call: `use()` mutates its renderer in place, so a
	// shared instance would stack closures across renders and leak the `meta`
	// captured by an earlier one.
	const parser = new Marked({ renderer: createImageRenderer(meta) });

	const html = parser.parse(
		transformMediaMarkdown(md, { imageMeta: meta }),
		{ async: false },
	) as string;

	return sanitize(html, SANITIZE_CONFIG);
}
