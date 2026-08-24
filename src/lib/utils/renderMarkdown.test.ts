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
    expect(html).toContain('max-width: 100%');
  });

  it('omits width/height when the URL has no meta entry', () => {
    const html = renderMarkdown('![x](https://a.com/unknown.png)');
    expect(html).toContain('<img src="https://a.com/unknown.png"');
    expect(html).not.toContain('width=');
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
});
