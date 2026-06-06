export interface ImageMeta {
    width: number;
    height: number;
}

const imageMarkdownRegex = /!\[[^\]]*]\(([^)]+)\)/g;

export function extractImageUrlsFromMarkdown(markdown: string): string[] {
    if (!markdown) return [];

    const urls = new Set<string>();
    let match: RegExpExecArray | null;

    while ((match = imageMarkdownRegex.exec(markdown)) !== null) {
        const url = match[1].trim();
        if (url) urls.add(url);
    }

    return Array.from(urls);
}

export function sanitizeImageMetaFromMarkdown(
    markdown: string,
    imageMeta: Record<string, ImageMeta> | undefined,
): Record<string, ImageMeta> {
    if (!imageMeta) return {};

    const activeUrls = new Set(extractImageUrlsFromMarkdown(markdown));
    return Object.fromEntries(
        Object.entries(imageMeta).filter(([url]) => activeUrls.has(url)),
    );
}

export function removeImageReferencesFromMarkdown(
    markdown: string,
    imageUrl: string,
): string {
    if (!markdown) return "";

    const escapedUrl = imageUrl.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const imageRefRegex = new RegExp(`!\\[[^\\]]*]\\(${escapedUrl}\\)`, "g");

    const cleaned = markdown.replace(imageRefRegex, "");
    return cleaned.replace(/\n{3,}/g, "\n\n").trim();
}
