import { getPosts } from "$lib/firebase/firestore.svelte";
import { SITE_URL } from "$lib/site";

export const prerender = true;

/** @param {string} value */
function escapeXml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

/**
 * @param {string} path
 * @param {string | undefined} lastmod
 */
function urlEntry(path, lastmod) {
  const loc = `${SITE_URL}${path}`;
  const lastmodTag = lastmod
    ? `\n    <lastmod>${escapeXml(lastmod)}</lastmod>`
    : "";

  return `  <url>
    <loc>${escapeXml(loc)}</loc>${lastmodTag}
  </url>`;
}

export async function GET() {
  const posts = await getPosts();

  const urls = [
    urlEntry("/", undefined),
    urlEntry("/blogs/", undefined),
    ...posts.map((post) =>
      urlEntry(
        `/blogs/${post.slug}/`,
        post.createdAt?.toISOString().slice(0, 10),
      ),
    ),
  ];

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join("\n")}
</urlset>
`;

  return new Response(body, {
    headers: {
      "Content-Type": "application/xml",
    },
  });
}
