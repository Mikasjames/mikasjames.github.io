import { describe, expect, it } from 'vitest';
import { renderMarkdown } from './renderMarkdown';

describe('renderMarkdown', () => {
  it('returns empty string for empty input', () => {
    expect(renderMarkdown('')).toBe('');
  });

  it('renders basic markdown to HTML', () => {
    const html = renderMarkdown('**bold** and _italic_');
    expect(html).toContain('<strong>bold</strong>');
    expect(html).toContain('<em>italic</em>');
  });

  it('renders inline markdown images with lazy loading and dimension meta', () => {
    const html = renderMarkdown('![Alt text](https://a.com/pic.png)', {
      'https://a.com/pic.png': { width: 640, height: 480 },
    });
    expect(html).toContain('<img src="https://a.com/pic.png"');
    expect(html).toContain('alt="Alt text"');
    expect(html).toContain('loading="lazy"');
    expect(html).toContain('width="640"');
    expect(html).toContain('height="480"');
  });

  it('omits width/height when the URL has no meta entry', () => {
    const html = renderMarkdown('![x](https://a.com/unknown.png)');
    expect(html).toContain('<img src="https://a.com/unknown.png"');
    expect(html).not.toContain('width=');
  });

  it('omits dimensions that are not positive finite numbers', () => {
    const html = renderMarkdown('![x](https://a.com/pic.png)', {
      'https://a.com/pic.png': { width: Number.NaN, height: -10 },
    });
    expect(html).toContain('<img src="https://a.com/pic.png"');
    expect(html).not.toContain('width=');
    expect(html).not.toContain('height=');
  });

  it('escapes quotes inside alt and href attributes', () => {
    const html = renderMarkdown('![a"b](https://a.com/x"y.png)');
    expect(html).toContain('alt="a&quot;b"');
    expect(html).toContain('src="https://a.com/x&quot;y.png"');
    expect(html).not.toMatch(/alt="a"b"/);
  });

  it('transforms standalone image lines through the media pipeline', () => {
    const html = renderMarkdown('https://a.com/standalone.avif', {
      'https://a.com/standalone.avif': { width: 32, height: 16 },
    });
    expect(html).toContain('src="https://a.com/standalone.avif"');
    expect(html).toContain('width="32" height="16"');
  });

  it('embeds standalone YouTube lines as iframes', () => {
    const html = renderMarkdown('https://youtu.be/zq1');
    expect(html).toContain('<iframe src="https://www.youtube.com/embed/zq1"');
  });

  describe('sanitization', () => {
    it('strips script tags and their contents', () => {
      const html = renderMarkdown('before\n\n<script>alert(1)</script>\n\nafter');
      expect(html).not.toContain('<script');
      expect(html).not.toContain('alert(1)');
      expect(html).toContain('before');
      expect(html).toContain('after');
    });

    it('strips inline event handler attributes', () => {
      const html = renderMarkdown('<img src="https://a.com/x.png" onerror="alert(1)">');
      expect(html).not.toContain('onerror');
      expect(html).toContain('src="https://a.com/x.png"');
    });

    it('strips javascript: URLs from links', () => {
      const html = renderMarkdown('[click me](javascript:alert(1))');
      expect(html).not.toContain('javascript:');
      expect(html).toContain('click me');
    });

    it('strips style attributes', () => {
      const html = renderMarkdown('<p style="position:fixed">styled</p>');
      expect(html).not.toContain('style=');
      expect(html).toContain('styled');
    });

    it('strips style attributes injected through an image meta entry', () => {
      const html = renderMarkdown('![x](https://a.com/pic.png)');
      expect(html).not.toContain('max-width');
    });

    it('does not let a non-numeric imageMeta value break out of the attribute', () => {
      const html = renderMarkdown('![x](https://a.com/pic.png)', {
        // Simulates untyped Firestore data reaching a field typed as number.
        'https://a.com/pic.png': { width: '1" onerror="alert(1)' as unknown as number, height: 5 },
      });
      expect(html).not.toContain('onerror');
    });

    it('keeps allowed structural markup', () => {
      const html = renderMarkdown(
        '| a | b |\n| - | - |\n| 1 | 2 |\n\n- item\n\n> quote',
      );
      expect(html).toContain('<table>');
      expect(html).toContain('<th');
      expect(html).toContain('<ul>');
      expect(html).toContain('<li>item</li>');
      expect(html).toContain('<blockquote>');
    });

    it('keeps video embeds intact', () => {
      const html = renderMarkdown('!video[Clip](https://cdn.example.com/clip.mp4)');
      expect(html).toContain('<video');
      expect(html).toContain('<source');
    });

    it('keeps standalone YouTube embeds intact through sanitization', () => {
      const html = renderMarkdown('https://vimeo.com/12345');
      expect(html).toContain('<iframe src="https://player.vimeo.com/video/12345"');
      expect(html).toContain('allowfullscreen');
    });
  });

  it('does not leak image dimensions between calls', () => {
    const withMeta = renderMarkdown('![x](https://a.com/pic.png)', {
      'https://a.com/pic.png': { width: 100, height: 50 },
    });
    const withoutMeta = renderMarkdown('![x](https://a.com/pic.png)');
    expect(withMeta).toContain('width="100"');
    expect(withoutMeta).not.toContain('width=');
  });
});
