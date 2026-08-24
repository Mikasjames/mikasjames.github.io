import { describe, expect, it } from 'vitest';
import { escapeHtml, transformMediaMarkdown } from './mediaMarkdown';
import type { MediaDimensions } from './mediaMeta';

describe('escapeHtml', () => {
  it('escapes all HTML-significant characters', () => {
    expect(escapeHtml(`a & b < c > d " e ' f`)).toBe(
      'a &amp; b &lt; c &gt; d &quot; e &#39; f',
    );
  });

  it('leaves safe strings untouched', () => {
    expect(escapeHtml('plain-url/path.png?x=1')).toBe('plain-url/path.png?x=1');
  });
});

describe('transformMediaMarkdown — !video syntax', () => {
  it('converts YouTube watch URLs into lazy iframes', () => {
    const out = transformMediaMarkdown('!video[Cool Vid](https://www.youtube.com/watch?v=dQw4w9WgXcQ)');
    expect(out).toContain('<div class="video-embed my-6">');
    expect(out).toContain('<iframe src="https://www.youtube.com/embed/dQw4w9WgXcQ"');
    expect(out).toContain('title="Cool Vid"');
    expect(out).toContain('loading="lazy"');
    expect(out).toContain('allowfullscreen');
  });

  it('supports youtu.be short links', () => {
    const out = transformMediaMarkdown('!video[V](https://youtu.be/abc_-123)');
    expect(out).toContain('src="https://www.youtube.com/embed/abc_-123"');
  });

  it('converts Vimeo URLs', () => {
    const out = transformMediaMarkdown('!video[V](https://vimeo.com/12345678)');
    expect(out).toContain('src="https://player.vimeo.com/video/12345678"');
  });

  it('renders direct video files with a video element', () => {
    const out = transformMediaMarkdown('!video[Clip](https://cdn.example.com/clip.mp4)');
    expect(out).toContain('<video controls preload="metadata">');
    expect(out).toContain('<source src="https://cdn.example.com/clip.mp4" />');
    expect(out).not.toContain('<iframe');
  });

  it('passes through unknown !video URLs unchanged instead of dropping them', () => {
    const md = '!video[Mystery](https://example.com/not-a-video)';
    expect(transformMediaMarkdown(md)).toBe(md);
  });
});

describe('transformMediaMarkdown — standalone media lines', () => {
  it('renders a standalone image line as an img element', () => {
    const out = transformMediaMarkdown('https://img.example.com/photo.png');
    expect(out.trim()).toMatch(/^<img src="https:\/\/img\.example\.com\/photo\.png"/);
    expect(out).toContain('alt="Image"');
    expect(out).toContain('loading="lazy"');
  });

  it('injects width and height from image meta when available', () => {
    const meta: Record<string, MediaDimensions> = {
      'https://img.example.com/photo.png': { width: 800, height: 600 },
    };
    const out = transformMediaMarkdown('https://img.example.com/photo.png', {
      imageMeta: meta,
    });
    expect(out).toContain('width="800" height="600"');
  });

  it('omits dimension attributes when meta is missing that URL', () => {
    const out = transformMediaMarkdown('https://img.example.com/photo.png', {
      imageMeta: { 'https://other.png': { width: 1, height: 1 } },
    });
    expect(out).not.toContain('width=');
  });

  it('embeds bare YouTube lines with a generic title', () => {
    const out = transformMediaMarkdown('https://youtube.com/watch?v=xyz789');
    expect(out).toContain('title="Video"');
    expect(out).toContain('src="https://www.youtube.com/embed/xyz789"');
  });

  it('embeds bare mp4 links as video elements', () => {
    const out = transformMediaMarkdown('https://files.example.com/movie.webm');
    expect(out).toContain('<source src="https://files.example.com/movie.webm" />');
  });

  it('returns empty string for empty input', () => {
    expect(transformMediaMarkdown('')).toBe('');
  });

  it('leaves ordinary markdown untouched', () => {
    const md = '# Title\n\nSome **bold** text.';
    expect(transformMediaMarkdown(md)).toBe(md);
  });
});
