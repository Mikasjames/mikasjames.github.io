import imageCompression from 'browser-image-compression';

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

export async function compressAndGetMeta(file: File) {
	const options = {
		maxWidthOrHeight: 1200,
		useWebWorker: true,
		fileType: 'image/webp',
		initialQuality: 0.78
	} as any;

	const compressedBlob = await imageCompression(file, options);
	const compressedFile =
		compressedBlob instanceof File
			? compressedBlob
			: new File([compressedBlob], file.name.replace(/\.[^/.]+$/, '') + '.webp', {
				  type: 'image/webp'
			  });

	const url = URL.createObjectURL(compressedFile);
	const img = new Image();
	img.src = url;
	await new Promise<void>((res, rej) => {
		img.onload = () => res();
		img.onerror = (e) => rej(e);
	});
	const width = img.naturalWidth;
	const height = img.naturalHeight;
	URL.revokeObjectURL(url);
	return { compressedFile, width, height };
}