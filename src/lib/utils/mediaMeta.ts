export interface MediaDimensions {
  width: number;
  height: number;
}

const imageMarkdownRegex = /!\[[^\]]*]\(([^)]+)\)/g;
const standaloneImageRegex =
  /^\s*(https?:\/\/(?:www\.)?\S+\.(?:png|jpe?g|gif|webp|avif|svg)(?:\?.*)?)\s*$/gm;
const videoEmbedRegex = /^!video\[(.*?)\]\((.*?)\)\s*$/gm;
const standaloneVideoRegex =
  /^\s*(https?:\/\/\S+\.(?:mp4|webm|ogg)(?:\?.*)?|https?:\/\/(?:www\.)?(?:youtube\.com\/watch\?v=[A-Za-z0-9_-]+|youtu\.be\/[A-Za-z0-9_-]+|vimeo\.com\/\d+))\s*$/gm;

export function isDirectVideoUrl(url: string): boolean {
  return /\.(mp4|webm|ogg)(?:\?.*)?$/i.test(url.trim());
}

function collectRegexUrls(markdown: string, regex: RegExp): string[] {
  const urls = new Set<string>();
  let match: RegExpExecArray | null;
  const pattern = new RegExp(regex.source, regex.flags);

  while ((match = pattern.exec(markdown)) !== null) {
    const url = match[match.length - 1]?.trim();
    if (url) urls.add(url);
  }

  return Array.from(urls);
}

export function extractImageUrlsFromMarkdown(markdown: string): string[] {
  if (!markdown) return [];

  const urls = new Set<string>(collectRegexUrls(markdown, imageMarkdownRegex));
  for (const url of collectRegexUrls(markdown, standaloneImageRegex)) {
    urls.add(url);
  }

  return Array.from(urls);
}

export function sanitizeImageMetaFromMarkdown(
  markdown: string,
  imageMeta: Record<string, MediaDimensions> | undefined,
): Record<string, MediaDimensions> {
  if (!imageMeta) return {};

  const activeUrls = new Set(extractImageUrlsFromMarkdown(markdown));
  return Object.fromEntries(
    Object.entries(imageMeta).filter(([url]) => activeUrls.has(url)),
  );
}

export function getImageDimensionsFromUrl(
  url: string,
): Promise<MediaDimensions> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.onerror = () => reject(new Error(`Failed to load image: ${url}`));
    img.src = url;
  });
}

async function resolveMissingMeta(
  markdown: string,
  currentMeta: Record<string, MediaDimensions>,
  extractUrls: (markdown: string) => string[],
  shouldResolve: (url: string) => boolean,
  getDimensions: (url: string) => Promise<MediaDimensions>,
): Promise<Record<string, MediaDimensions>> {
  const urls = extractUrls(markdown);
  const resolved = { ...currentMeta };

  await Promise.all(
    urls.map(async (url) => {
      if (resolved[url] || !shouldResolve(url)) return;

      try {
        resolved[url] = await getDimensions(url);
      } catch {
        // Keep going when probing fails (CORS, bad URL, etc.).
      }
    }),
  );

  return resolved;
}

export function resolveMissingImageMeta(
  markdown: string,
  imageMeta: Record<string, MediaDimensions>,
): Promise<Record<string, MediaDimensions>> {
  return resolveMissingMeta(
    markdown,
    imageMeta,
    extractImageUrlsFromMarkdown,
    () => true,
    getImageDimensionsFromUrl,
  );
}

export {
  standaloneImageRegex,
  standaloneVideoRegex,
  videoEmbedRegex,
};
