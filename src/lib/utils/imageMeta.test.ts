import { describe, expect, it } from 'vitest';
import {
	enrichImageMetaFromGallery,
	removeImageReferencesFromMarkdown,
} from './imageMeta';
import type { MediaItem } from '$lib/firebase/firestore.svelte';

function item(id: string, url: string, width?: number | null, height?: number | null): MediaItem {
	return { id, url, width: width ?? null, height: height ?? null, name: id } as unknown as MediaItem;
}

describe('enrichImageMetaFromGallery', () => {
	const md = '![a](https://a.com/x.png)\n\nhttps://b.com/y.jpg\n\nhttps://c.com/z.gif';

	it('adopts gallery dimensions for known URLs found in markdown', () => {
		const meta = enrichImageMetaFromGallery(
			md,
			{},
			[item('m1', 'https://a.com/x.png', 800, 600)],
		);
		expect(meta).toEqual({ 'https://a.com/x.png': { width: 800, height: 600 } });
	});

	it('prefers existing meta over gallery data', () => {
		const meta = enrichImageMetaFromGallery(
			md,
			{ 'https://a.com/x.png': { width: 1, height: 2 } },
			[item('m1', 'https://a.com/x.png', 800, 600)],
		);
		expect(meta['https://a.com/x.png']).toEqual({ width: 1, height: 2 });
	});

	it('drops entries whose gallery dimensions are missing or zero', () => {
		const meta = enrichImageMetaFromGallery(md, {}, [
			item('zero-w', 'https://a.com/x.png', 0, 600),
			item('no-h', 'https://b.com/y.jpg', 100),
			item('full', 'https://c.com/z.gif', 50, 40),
		]);
		expect(Object.keys(meta)).toEqual(['https://c.com/z.gif']);
	});

	it('omits URLs that exist nowhere', () => {
		const meta = enrichImageMetaFromGallery('![x](https://unknown.io/i.png)', {}, []);
		expect(meta).toEqual({});
	});

	it('handles both inline and standalone URL forms', () => {
		const meta = enrichImageMetaFromGallery(md, {}, [
			item('a', 'https://a.com/x.png', 10, 20),
			item('b', 'https://b.com/y.jpg', 30, 40),
		]);
		expect(Object.keys(meta)).toHaveLength(2);
	});
});

describe('removeImageReferencesFromMarkdown', () => {
	it('removes every reference to the given URL regardless of alt text', () => {
		const md = 'keep\n![one](https://a.com/x.png)\nmid ![two](https://a.com/x.png) end';
		const out = removeImageReferencesFromMarkdown(md, 'https://a.com/x.png');
		// one removal leaves a double newline; the collapse only kicks in at 3+
		expect(out).toBe('keep\n\nmid  end');
	});

	it('escapes regex-special characters in the URL', () => {
		const md = '![shot](https://a.com/img(1).png)\n![again](https://a.com/img(1).png)';
		expect(removeImageReferencesFromMarkdown(md, 'https://a.com/img(1).png')).toBe('');
	});

	it('leaves other images intact', () => {
		const md = '![keep](https://a.com/keep.png)\n![drop](https://a.com/drop.png)';
		const out = removeImageReferencesFromMarkdown(md, 'https://a.com/drop.png');
		expect(out).toContain('keep.png');
		expect(out).not.toContain('drop.png');
	});

	it('collapses triple newlines left behind by removals and trims edges', () => {
		const md = '\npara one\n![gone](https://a.com/g.png)\n\n\n![gone](https://a.com/g.png)\n\npara two\n';
		const out = removeImageReferencesFromMarkdown(md, 'https://a.com/g.png');
		expect(out).not.toMatch(/\n{3,}/);
		expect(out.startsWith('para one')).toBe(true);
		expect(out.endsWith('para two')).toBe(true);
	});

	it('returns empty string for falsy input', () => {
		expect(removeImageReferencesFromMarkdown('', 'https://a.com/x.png')).toBe('');
	});
});
