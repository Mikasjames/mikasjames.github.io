import imageCompression from "browser-image-compression";
import { extractImageUrlsFromMarkdown } from "./mediaMeta";

export type { MediaDimensions as ImageMeta } from "./mediaMeta";
export {
  extractImageUrlsFromMarkdown,
  sanitizeImageMetaFromMarkdown,
  getImageDimensionsFromUrl,
  resolveMissingImageMeta,
} from "./mediaMeta";

export function enrichImageMetaFromGallery(
  markdown: string,
  currentImageMeta: Record<string, { width: number; height: number }>,
  galleryItems: any[],
): Record<string, { width: number; height: number }> {
  const urls = extractImageUrlsFromMarkdown(markdown);
  return urls.reduce(
    (acc, url) => {
      if (currentImageMeta[url]) {
        acc[url] = currentImageMeta[url];
        return acc;
      }

      const media = galleryItems.find((item) => item.url === url);
      if (media?.width && media?.height) {
        acc[url] = {
          width: media.width,
          height: media.height,
        };
      }
      return acc;
    },
    {} as Record<string, { width: number; height: number }>,
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
  const isGif = file.type === "image/gif" || /\.gif$/i.test(file.name);

  let compressedFile: File;

  if (isGif) {
    compressedFile = file;
  } else {
    const options = {
      maxWidthOrHeight: 1200,
      useWebWorker: true,
      fileType: "image/webp",
      initialQuality: 0.78,
    } as any;

    const compressedBlob = await imageCompression(file, options);
    compressedFile =
      compressedBlob instanceof File
        ? compressedBlob
        : new File(
            [compressedBlob],
            file.name.replace(/\.[^/.]+$/, "") + ".webp",
            {
              type: "image/webp",
            },
          );
  }

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
