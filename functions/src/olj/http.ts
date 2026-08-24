import { request as oljHttpsRequest } from 'node:https';

export const OLJ_BASE_URL = 'https://www.onlinejobs.ph';
export const OLJ_V2_BASE_URL = 'https://v2.onlinejobs.ph';
const OLJ_USER_AGENT =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

export type OljCookieJar = Map<string, string>;

export function oljCookieHeader(jar: OljCookieJar): string {
  return [...jar.entries()].map(([name, value]) => `${name}=${value}`).join('; ');
}

function mergeOljSetCookies(jar: OljCookieJar, setCookies: readonly string[] | undefined): void {
  for (const cookie of setCookies ?? []) {
    const pair = cookie.split(';')[0] ?? '';
    const separatorIndex = pair.indexOf('=');
    if (separatorIndex > 0) {
      jar.set(pair.slice(0, separatorIndex).trim(), pair.slice(separatorIndex + 1).trim());
    }
  }
}

export function oljHttpRequest(
  jar: OljCookieJar,
  urlString: string,
  options: {
    method?: string;
    body?: string;
    referer?: string;
    headers?: Record<string, string>;
  } = {},
): Promise<{ status: number; location: string | null; body: string }> {
  return new Promise((resolve, reject) => {
    const url = new URL(urlString);
    const headers: Record<string, string> = {
      'User-Agent': OLJ_USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-PH,en;q=0.9',
    };

    const cookie = oljCookieHeader(jar);
    if (cookie) headers.Cookie = cookie;
    for (const [name, value] of Object.entries(options.headers ?? {})) {
      headers[name] = value;
    }
    if (options.referer) headers.Referer = options.referer;
    if (options.body) {
      headers['Content-Type'] = 'application/x-www-form-urlencoded';
      headers['Content-Length'] = String(Buffer.byteLength(options.body));
    }

    const req = oljHttpsRequest(
      {
        hostname: url.hostname,
        port: url.port || 443,
        path: `${url.pathname}${url.search}`,
        method: options.method ?? 'GET',
        headers,
      },
      (res) => {
        res.setEncoding('utf8');
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => {
          mergeOljSetCookies(jar, res.headers['set-cookie']);
          resolve({
            status: res.statusCode ?? 0,
            location: res.headers.location ?? null,
            body: data,
          });
        });
        res.on('error', reject);
      },
    );

    req.on('error', reject);
    req.setTimeout(20_000, () => req.destroy(new Error(`Timeout requesting ${urlString}`)));
    if (options.body) req.write(options.body);
    req.end();
  });
}

export async function oljFollowRedirects(
  jar: OljCookieJar,
  startUrl: string,
  options: { method?: string; body?: string; referer?: string; maxHops?: number } = {},
): Promise<{ status: number; body: string; finalUrl: string; hops: string[] }> {
  const maxHops = options.maxHops ?? 6;
  let currentUrl = startUrl;
  let method = options.method ?? 'GET';
  let body = options.body;
  let referer = options.referer;
  const hops: string[] = [];

  for (let hop = 0; hop <= maxHops; hop += 1) {
    const result = await oljHttpRequest(jar, currentUrl, { method, body, referer });

    if (!(result.status >= 300 && result.status < 400 && result.location)) {
      return { status: result.status, body: result.body, finalUrl: currentUrl, hops };
    }

    hops.push(`${result.status} → ${result.location}`);
    const nextUrl = new URL(result.location, currentUrl).toString();
    if (method === 'POST') {
      method = 'GET';
      body = undefined;
    }
    referer = currentUrl;
    currentUrl = nextUrl;
  }

  throw new Error(`Too many redirects starting at ${startUrl}`);
}

export function stripOljHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z#0-9]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function extractErrorSnippet(html: string): string | null {
  const text = stripOljHtml(html);
  const match = text.match(
    /.{0,120}(?:invalid|incorrect|wrong|error|required|captcha|verif|failed|attempt|locked|blocked|suspend|credential)[^\n]{0,180}/i,
  );
  if (match?.[0]) return match[0].slice(0, 320);
  return text ? `${text.slice(0, 200)}…` : null;
}

export function isCloudflareChallenge(status: number, html: string): boolean {
  if (status !== 403 && status !== 503) return false;
  const markers = ['challenge-platform', 'Just a moment', 'cf-browser-verification', 'Attention Required'];
  return markers.some((marker) => html.includes(marker));
}

export function extractOljCsrfToken(html: string): string | null {
  const meta = html.match(/<meta\s+name="csrf-token"\s+content="([^"]+)"/);
  if (meta?.[1]) return meta[1];
  const input = html.match(/name="csrf-token"[^>]*value="([^"]+)"/);
  return input?.[1] ?? null;
}

export function extractApplyPoints(html: string): number | null {
  const patterns = [
    /apply[_\s-]?points["']?\s*[:=]\s*"?(\d[\d,]*)/i,
    /"applyPoints"\s*:\s*"?(\d[\d,]*)/i,
    /"points"\s*:\s*"?(\d[\d,]*)/i,
    /apply\s*points?[\s\S]{0,120}?(\d[\d,]*)/i,
    /(\d[\d,]*)[\s\S]{0,120}?apply\s*points?/i,
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) {
      const value = Number.parseInt(match[1].replace(/,/g, ''), 10);
      if (!Number.isNaN(value)) return value;
    }
  }
  return null;
}

export function classifyOljLoginFailure(html: string): string {
  const lower = html.toLowerCase();
  if (/incorrect|invalid\s+(email|password|login)|wrong\s+password|credentials/.test(lower)) {
    return 'Bad credentials rejected by OnlineJobs.ph';
  }
  if (/(captcha|recaptcha)[\s\S]{0,80}(required|invalid|please|failed|verify)|please[\s\S]{0,40}captcha/.test(lower)) {
    return 'CAPTCHA appears to be enforced — automated login blocked';
  }
  return 'Login form was re-served after authentication attempt';
}
