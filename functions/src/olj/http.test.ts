import { describe, it, expect } from 'vitest';
import {
  classifyOljLoginFailure,
  extractApplyPoints,
  extractErrorSnippet,
  extractOljCsrfToken,
  isCloudflareChallenge,
  mergeOljSetCookies,
  oljCookieHeader,
  stripOljHtml,
} from './http.js';
import type { OljCookieJar } from './http.js';

describe('extractOljCsrfToken', () => {
  it('reads the meta tag form', () => {
    const html = '<head><meta name="csrf-token" content="tok-123"></head>';
    expect(extractOljCsrfToken(html)).toBe('tok-123');
  });

  it('falls back to the input tag form', () => {
    const html = '<input type="hidden" name="csrf-token" value="abc-def">';
    expect(extractOljCsrfToken(html)).toBe('abc-def');
  });

  it('returns null when absent', () => {
    expect(extractOljCsrfToken('<html><body>hi</body></html>')).toBeNull();
  });
});

describe('extractApplyPoints', () => {
  it('matches labeled assignments', () => {
    expect(extractApplyPoints('apply_points: 3400')).toBe(3400);
    expect(extractApplyPoints('applypoints="12500"')).toBe(12500);
  });

  it('matches JSON keys', () => {
    expect(extractApplyPoints('{"applyPoints": "12500"}')).toBe(12500);
    expect(extractApplyPoints('{"points":"9,999"}')).toBe(9999);
  });

  it('matches prose before and after the phrase', () => {
    expect(extractApplyPoints('your apply points balance is 750 today')).toBe(750);
    expect(extractApplyPoints('Balance: 750 — logins apply points daily')).toBe(750);
  });

  it('strips thousands separators', () => {
    expect(extractApplyPoints('"points": "1,234,567"')).toBe(1234567);
  });

  it('returns null when nothing matches', () => {
    expect(extractApplyPoints('<html>nothing to see</html>')).toBeNull();
  });
});

describe('isCloudflareChallenge', () => {
  it('detects challenge markers on 403/503', () => {
    expect(isCloudflareChallenge(403, '<div id="challenge-platform">x</div>')).toBe(true);
    expect(isCloudflareChallenge(503, 'Just a moment...')).toBe(true);
    expect(isCloudflareChallenge(403, 'cf-browser-verification')).toBe(true);
    expect(isCloudflareChallenge(503, 'Attention Required!')).toBe(true);
  });

  it('ignores markers on other statuses and clean error pages', () => {
    expect(isCloudflareChallenge(200, 'challenge-platform')).toBe(false);
    expect(isCloudflareChallenge(403, 'normal forbidden page')).toBe(false);
  });
});

describe('classifyOljLoginFailure', () => {
  it('identifies bad credentials', () => {
    expect(classifyOljLoginFailure('Invalid email or password')).toContain('Bad credentials');
  });

  it('identifies captcha enforcement', () => {
    expect(classifyOljLoginFailure('Please complete the captcha to continue')).toContain('CAPTCHA');
  });

  it('defaults to form re-served', () => {
    expect(classifyOljLoginFailure('<form>login</form>')).toContain('re-served');
  });
});

describe('stripOljHtml / extractErrorSnippet', () => {
  it('removes scripts, styles, tags, and entities', () => {
    const html = '<p>Hello</p><script>bad()</script><style>.x{color:red}</style>&amp; world';
    expect(stripOljHtml(html)).toBe('Hello world');
  });

  it('captures a window around failure keywords', () => {
    const filler = 'x'.repeat(200);
    const snippet = extractErrorSnippet(`${filler} invalid credentials please try again ${filler}`);
    expect(snippet).not.toBeNull();
    expect(snippet).toContain('invalid credentials');
    expect(snippet!.length).toBeLessThanOrEqual(320);
  });

  it('returns a truncated prefix for pages without keywords', () => {
    const text = 'y'.repeat(500);
    const snippet = extractErrorSnippet(text);
    expect(snippet).not.toBeNull();
    expect(snippet!.startsWith('yyy')).toBe(true);
  });
});

describe('cookie jar helpers', () => {
  function jar(): OljCookieJar {
    return new Map<string, string>();
  }

  it('merges set-cookie pairs up to the first semicolon', () => {
    const j = jar();
    mergeOljSetCookies(j, ['a=1; Path=/; HttpOnly', 'b=2; Secure']);
    expect(oljCookieHeader(j)).toBe('a=1; b=2');
  });

  it('skips malformed cookies and overwrites existing names', () => {
    const j = jar();
    mergeOljSetCookies(j, ['novalue', '=nope', 'sid=old']);
    mergeOljSetCookies(j, ['sid=new']);
    expect(oljCookieHeader(j)).toBe('sid=new');
  });

  it('handles an undefined set-cookie header', () => {
    const j = jar();
    mergeOljSetCookies(j, undefined);
    expect(oljCookieHeader(j)).toBe('');
  });
});
