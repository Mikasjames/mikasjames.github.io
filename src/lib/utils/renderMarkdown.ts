import { marked } from "marked";
import { transformMediaMarkdown } from "./mediaMarkdown";
import type { MediaDimensions } from "./mediaMeta";

export function renderMarkdown(
	md: string,
	imageMeta?: Record<string, MediaDimensions>,
): string {
	if (!md) return "";

	const meta = imageMeta ?? {};

	const renderer = {
		image(token: { href: string; title: string | null; text: string }) {
			const metadata = meta[token.href];
			const widthAttr = metadata?.width ? ` width="${metadata.width}"` : "";
			const heightAttr = metadata?.height ? ` height="${metadata.height}"` : "";
			return `<img src="${token.href}" alt="${token.text}" loading="lazy"${widthAttr}${heightAttr} style="max-width: 100%; height: auto;" />`;
		},
	};

	marked.use({ renderer });
	return marked.parse(
		transformMediaMarkdown(md, { imageMeta: meta }),
		{ async: false },
	) as string;
}
