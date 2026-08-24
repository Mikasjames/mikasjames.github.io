import { beforeEach, describe, expect, it, vi } from 'vitest';

const firestore = vi.hoisted(() => ({
	getMediaItemsPage: vi.fn(),
	getRecentMediaItems: vi.fn(async () => []),
	addMediaItem: vi.fn(async () => {}),
	deleteMediaItem: vi.fn(async () => {}),
}));
const storage = vi.hoisted(() => ({
	uploadImage: vi.fn(),
	deleteImage: vi.fn(async () => {}),
}));
const imageMeta = vi.hoisted(() => ({
	compressAndGetMeta: vi.fn(),
}));

vi.mock('$lib/firebase/firestore.svelte', () => firestore);
vi.mock('$lib/firebase/storage', () => storage);
vi.mock('$lib/utils/imageMeta', () => ({ compressAndGetMeta: imageMeta.compressAndGetMeta }));

import { createMediaStore } from '$lib/firebase/media.svelte';
import type { MediaItem } from '$lib/firebase/firestore.svelte';

type Page = {
	items: MediaItem[];
	nextCursor: unknown;
	hasMore: boolean;
};

function mediaItem(id: string): MediaItem {
	return {
		id,
		url: `https://media.test/${id}.png`,
		name: `${id}.png`,
		width: 10,
		height: 10,
		createdAt: new Date(0)
	} as unknown as MediaItem;
}

function page(items: Page['items'], hasMore: boolean): Page {
	return { items, nextCursor: hasMore ? { id: 'cursor' } : null, hasMore };
}

beforeEach(() => {
	for (const fn of Object.values(firestore)) fn.mockReset();
	for (const fn of Object.values(storage)) fn.mockReset();
	imageMeta.compressAndGetMeta.mockReset();
	firestore.getRecentMediaItems.mockResolvedValue([]);
	storage.deleteImage.mockResolvedValue(undefined);
});

describe('media store — pagination', () => {
	it('loadMediaItems resets state and stores the first page', async () => {
		const store = createMediaStore();
		firestore.getMediaItemsPage.mockResolvedValueOnce(page([mediaItem('a')], true));

		await store.loadMediaItems();

		expect(store.mediaItems).toEqual([mediaItem('a')]);
		expect(store.mediaHasMore).toBe(true);
		expect(store.mediaLoaded).toBe(true);
		expect(store.mediaLoading).toBe(false);

		firestore.getMediaItemsPage.mockResolvedValueOnce(
			page([mediaItem('fresh')], false),
		);
		await store.loadMediaItems();
		expect(store.mediaItems.map((m) => m.id)).toEqual(['fresh']);
		expect(store.mediaHasMore).toBe(false);
	});

	it('loadMoreMediaItems appends and feeds the stored cursor forward', async () => {
		const store = createMediaStore();
		const cursor2 = { id: 'cursor-2' };
		firestore.getMediaItemsPage
			.mockResolvedValueOnce(page([mediaItem('a')], true))
			.mockResolvedValueOnce({
				items: [mediaItem('b')],
				nextCursor: cursor2,
				hasMore: true,
			})
			.mockResolvedValueOnce({ items: [mediaItem('c')], nextCursor: null, hasMore: false });

		await store.loadMediaItems();
		await store.loadMoreMediaItems();

		expect(firestore.getMediaItemsPage).toHaveBeenNthCalledWith(2, { id: 'cursor' });
		expect(store.mediaItems.map((m) => m.id)).toEqual(['a', 'b']);

		await store.loadMoreMediaItems(); // must reuse cursor2 internally
		expect(firestore.getMediaItemsPage).toHaveBeenLastCalledWith(cursor2);
		expect(store.mediaItems.map((m) => m.id)).toEqual(['a', 'b', 'c']);
	});

	it('loadMoreMediaItems is a no-op without a cursor or while loading', async () => {
		const store = createMediaStore();

		await store.loadMoreMediaItems(); // no cursor yet
		expect(firestore.getMediaItemsPage).not.toHaveBeenCalled();

		let release!: (v: Page) => void;
		firestore.getMediaItemsPage.mockReturnValueOnce(new Promise((res) => (release = res)));
		const first = store.loadMediaItems();
		void store.loadMoreMediaItems(); // blocked because loading
		release(page([], false));
		await first;
		expect(firestore.getMediaItemsPage).toHaveBeenCalledTimes(1);
	});
});

describe('media store — gallery lifecycle', () => {
	it('openMediaGallery lazily loads exactly once', async () => {
		const store = createMediaStore();
		firestore.getMediaItemsPage.mockResolvedValue(page([mediaItem('a')], false));

		await store.openMediaGallery();
		await store.openMediaGallery();

		expect(firestore.getMediaItemsPage).toHaveBeenCalledTimes(1);
		expect(store.mediaLoaded).toBe(true);
	});

	it('skips reloading when mediaLoaded was set externally', async () => {
		const store = createMediaStore();
		store.mediaLoaded = true;
		await store.openMediaGallery();
		expect(firestore.getMediaItemsPage).not.toHaveBeenCalled();
	});
});

describe('media store — uploads', () => {
	it('runs compress -> upload -> record -> refresh and returns metadata', async () => {
		const store = createMediaStore();
		const file = new File(['x'], 'photo.png', { type: 'image/png' });
		const compressed = new File(['y'], 'photo.webp', { type: 'image/webp' });
		imageMeta.compressAndGetMeta.mockResolvedValue({
			compressedFile: compressed,
			width: 1200,
			height: 900,
		});
		storage.uploadImage.mockResolvedValue('https://media.test/photo.webp');
		firestore.getMediaItemsPage.mockResolvedValue(page([], false));

		const result = await store.handleGalleryUpload(file);

		expect(imageMeta.compressAndGetMeta).toHaveBeenCalledWith(file);
		expect(storage.uploadImage).toHaveBeenCalledTimes(1);
		const [uploaded, folder] = storage.uploadImage.mock.calls[0];
		expect(uploaded).toBe(compressed);
		expect(folder).toBe('blog-content');
		expect(firestore.addMediaItem).toHaveBeenCalledWith({
			url: 'https://media.test/photo.webp',
			name: 'photo.webp',
			width: 1200,
			height: 900,
		});
		expect(firestore.getRecentMediaItems).toHaveBeenCalled();
		expect(result).toEqual({
			url: 'https://media.test/photo.webp',
			width: 1200,
			height: 900,
			name: 'photo.webp',
		});
	});

	it('sets uploading flag around the operation and clears it after failure', async () => {
		const store = createMediaStore();
		imageMeta.compressAndGetMeta.mockRejectedValue(new Error('compression blew up'));
		const file = new File(['x'], 'photo.png', { type: 'image/png' });

		const pending = store.handleGalleryUpload(file);
		expect(store.mediaUploading).toBe(true);
		await expect(pending).rejects.toThrow('compression blew up');
		expect(store.mediaUploadError).toBe('compression blew up');
		expect(store.mediaUploading).toBe(false);
	});
});

describe('media store — deletions', () => {
	it('removes storage object before the firestore doc and notifies markdown cleanup', async () => {
		const store = createMediaStore();
		const order: string[] = [];
		storage.deleteImage.mockImplementationOnce(async () => {
			order.push('storage');
		});
		firestore.deleteMediaItem.mockImplementationOnce(async () => {
			order.push('firestore');
		});
		firestore.getMediaItemsPage.mockResolvedValue(page([], false));
		const onDelete = vi.fn(() => order.push('markdown'));

		await store.handleDeleteMedia(mediaItem('doomed'), onDelete, async () => true);

		expect(order).toEqual(['storage', 'firestore', 'markdown']);
		expect(onDelete).toHaveBeenCalledWith('https://media.test/doomed.png');
		expect(store.deletingMediaIds.size).toBe(0); // cleaned up in finally
	});

	it('no-ops when the confirm hook declines', async () => {
		const store = createMediaStore();
		await store.handleDeleteMedia(mediaItem('keep'), undefined, async () => false);
		expect(storage.deleteImage).not.toHaveBeenCalled();
		expect(firestore.deleteMediaItem).not.toHaveBeenCalled();
	});

	it('routes failures to onError instead of alert()', async () => {
		const alertSpy = vi.spyOn(globalThis, 'alert').mockImplementation(() => {});
		const store = createMediaStore();
		const onError = vi.fn();
		storage.deleteImage.mockRejectedValueOnce(new Error('bucket denied'));

		await store.handleDeleteMedia(mediaItem('boom'), vi.fn(), async () => true, onError);

		expect(onError).toHaveBeenCalledWith('bucket denied');
		expect(alertSpy).not.toHaveBeenCalled();
		alertSpy.mockRestore();
	});
});
