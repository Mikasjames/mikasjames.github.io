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

function isDirectVideoUrl(url: string): boolean {
  return /\.(mp4|webm|ogg)(?:\?.*)?$/i.test(url.trim());
}

function createVideoEmbedHtml(url: string, title = "Video"): string {
  const escapedUrl = escapeHtml(url.trim());
  const escapedTitle = escapeHtml(title || "Video embed");
  const embedUrl = getVideoEmbedUrl(url);

  if (embedUrl) {
    return `<div class="video-embed my-6"><iframe src="${escapeHtml(embedUrl)}" title="${escapedTitle}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen style="width:100%;min-height:360px;max-height:65vh;border-radius:0.75rem;overflow:hidden;"></iframe></div>`;
  }

  if (isDirectVideoUrl(url)) {
    return `<div class="video-embed my-6"><video controls preload="metadata" style="width:100%;height:auto;max-height:65vh;border-radius:0.75rem;background:#000;"><source src="${escapedUrl}" /></video></div>`;
  }

  return "";
}

export function transformMediaMarkdown(markdown: string): string {
  if (!markdown) return "";

  const transformCustomVideo = markdown.replace(
    /^!video\[(.*?)\]\((.*?)\)\s*$/gm,
    (_, title, url) => createVideoEmbedHtml(url, title),
  );

  const transformImageUrl = transformCustomVideo.replace(
    /^\s*(https?:\/\/(?:www\.)?\S+\.(?:png|jpe?g|gif|webp|avif|svg)(?:\?.*)?)\s*$/gm,
    (_, url) =>
      `<img src="${escapeHtml(url)}" alt="Image" loading="lazy" style="max-width: 100%; height: auto;" />`,
  );

  return transformImageUrl.replace(
    /^\s*(https?:\/\/\S+\.(?:mp4|webm|ogg)(?:\?.*)?|https?:\/\/(?:www\.)?(?:youtube\.com\/watch\?v=[A-Za-z0-9_-]+|youtu\.be\/[A-Za-z0-9_-]+|vimeo\.com\/\d+))\s*$/gm,
    (_, url) => {
      const videoHtml = createVideoEmbedHtml(url);
      return videoHtml || _;
    },
  );
}
