import { describe, expect, it } from 'vitest';
import {
  extractImageUrlsFromMarkdown,
  isDirectVideoUrl,
  sanitizeImageMetaFromMarkdown,
  standaloneVideoRegex,
  videoEmbedRegex,
} from './mediaMeta';

describe('isDirectVideoUrl', () => {
  it('accepts direct video extensions', () => {
    expect(isDirectVideoUrl('https://x.com/a.mp4')).toBe(true);
    expect(isDirectVideoUrl('https://x.com/a.webm')).toBe(true);
    expect(isDirectVideoUrl('https://x.com/a.ogg?token=1')).toBe(true);
    expect(isDirectVideoUrl('  https://x.com/a.MP4  ')).toBe(true);
  });

  it('rejects embeddable and non-video URLs', () => {
    expect(isDirectVideoUrl('https://youtube.com/watch?v=abc')).toBe(false);
    expect(isDirectVideoUrl('https://vimeo.com/123')).toBe(false);
    expect(isDirectVideoUrl('https://x.com/a.mov')).toBe(false);
    expect(isDirectVideoUrl('https://x.com/a.mp4.bak')).toBe(false);
  });
});

describe('extractImageUrlsFromMarkdown', () => {
  it('collects inline markdown images', () => {
    const urls = extractImageUrlsFromMarkdown('![alt](https://a.com/x.png)');
    expect(urls).toEqual(['https://a.com/x.png']);
  });

  it('collects standalone image lines and dedupes across forms', () => {
    const md = [
      '![cover](https://a.com/cover.jpg)',
      '',
      'https://a.com/cover.jpg',
      'https://b.com/extra.webp',
    ].join('\n');
    const urls = extractImageUrlsFromMarkdown(md);
    expect(urls).toHaveLength(2);
    expect(urls).toContain('https://a.com/cover.jpg');
    expect(urls).toContain('https://b.com/extra.webp');
  });

  it('trims whitespace around matches and returns empty for no input', () => {
    expect(extractImageUrlsFromMarkdown('![a](  https://c.com/i.gif  )')).toEqual([
      'https://c.com/i.gif',
    ]);
    expect(extractImageUrlsFromMarkdown('')).toEqual([]);
    expect(extractImageUrlsFromMarkdown('no media here')).toEqual([]);
  });
});

describe('sanitizeImageMetaFromMarkdown', () => {
  it('keeps only meta entries whose URLs still appear in the markdown', () => {
    const meta = {
      'https://a.com/keep.png': { width: 10, height: 20 },
      'https://a.com/gone.png': { width: 1, height: 2 },
    };
    const md = '![k](https://a.com/keep.png)';
    expect(sanitizeImageMetaFromMarkdown(md, meta)).toEqual({
      'https://a.com/keep.png': { width: 10, height: 20 },
    });
  });

  it('returns an empty object when there is no meta', () => {
    expect(sanitizeImageMetaFromMarkdown('![k](https://a.com/keep.png)', undefined)).toEqual({});
  });
});

describe('exported regexes', () => {
  it('videoEmbedRegex captures title and url from a full line', () => {
    // /g regexes are stateful — use a fresh instance like the source does
    const fresh = new RegExp(videoEmbedRegex.source, videoEmbedRegex.flags.replace('g', ''));
    const match = '!video[T](https://vimeo.com/5)'.match(fresh);
    expect(match?.[1]).toBe('T');
    expect(match?.[2]).toBe('https://vimeo.com/5');
  });

  it('standaloneVideoRegex matches bare YouTube and mp4 lines but not prose', () => {
    expect(standaloneVideoRegex.test('https://youtu.be/abc')).toBe(true);
    standaloneVideoRegex.lastIndex = 0;
    expect(standaloneVideoRegex.test('see https://x.com/a.mp4 now')).toBe(false);
  });
});
