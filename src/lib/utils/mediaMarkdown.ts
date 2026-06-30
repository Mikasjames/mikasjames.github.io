import type { MediaDimensions } from "./mediaMeta";
import {
  isDirectVideoUrl,
  standaloneImageRegex,
  standaloneVideoRegex,
  videoEmbedRegex,
} from "./mediaMeta";

export interface MediaRenderMeta {
  imageMeta?: Record<string, MediaDimensions>;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function getVideoEmbedUrl(url: string): string | null {
  const normalized = url.trim();

  const youtubeMatch = normalized.match(
    /^(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/)([A-Za-z0-9_-]+)/,
  );
  if (youtubeMatch) {
    return `https://www.youtube.com/embed/${youtubeMatch[1]}`;
  }

  const vimeoMatch = normalized.match(
    /^(?:https?:\/\/)?(?:www\.)?vimeo\.com\/(\d+)/,
  );
  if (vimeoMatch) {
    return `https://player.vimeo.com/video/${vimeoMatch[1]}`;
  }

  return null;
}

function dimensionAttrs(meta: MediaDimensions | undefined): string {
  if (!meta?.width || !meta?.height) return "";
  return ` width="${meta.width}" height="${meta.height}"`;
}

function createVideoEmbedHtml(url: string, title = "Video"): string {
  const trimmedUrl = url.trim();
  const escapedUrl = escapeHtml(trimmedUrl);
  const escapedTitle = escapeHtml(title || "Video embed");
  const embedUrl = getVideoEmbedUrl(trimmedUrl);

  if (embedUrl) {
    return `<div class="video-embed my-6"><iframe src="${escapeHtml(embedUrl)}" title="${escapedTitle}" loading="lazy" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe></div>`;
  }

  if (isDirectVideoUrl(trimmedUrl)) {
    return `<div class="video-embed my-6"><video controls preload="metadata"><source src="${escapedUrl}" /></video></div>`;
  }

  return "";
}

function createStandaloneImageHtml(
  url: string,
  imageMeta?: Record<string, MediaDimensions>,
): string {
  const trimmedUrl = url.trim();
  const meta = imageMeta?.[trimmedUrl];
  const dimAttrs = dimensionAttrs(meta);
  return `<img src="${escapeHtml(trimmedUrl)}" alt="Image" loading="lazy"${dimAttrs} />`;
}

export function transformMediaMarkdown(
  markdown: string,
  meta?: MediaRenderMeta,
): string {
  if (!markdown) return "";

  const transformCustomVideo = markdown.replace(
    videoEmbedRegex,
    (_, title, url) => createVideoEmbedHtml(url, title) || `!video[${title}](${url})`,
  );

  const transformImageUrl = transformCustomVideo.replace(
    standaloneImageRegex,
    (_, url) => createStandaloneImageHtml(url, meta?.imageMeta),
  );

  return transformImageUrl.replace(standaloneVideoRegex, (_, url) => {
    const videoHtml = createVideoEmbedHtml(url, "Video");
    return videoHtml || _;
  });
}
