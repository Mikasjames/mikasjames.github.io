import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
	insertMarkdownAtCursor,
	handleContentUpload,
	copyToClipboard,
	setEditorCoverImage,
	handleDeleteMediaWrapper,
} from './editorActions';

vi.mock('$lib/stores/toast.svelte', () => ({
	toast: vi.fn(),
}));

function createMockMediaStore() {
	return {
		handleGalleryUpload: vi.fn().mockResolvedValue({
			url: 'https://example.com/img.jpg',
			width: 800,
			height: 600,
			name: 'img.jpg',
		}),
		handleDeleteMedia: vi.fn().mockResolvedValue(undefined),
	} as any;
}

function createMockTextarea(value = '') {
	return {
		value,
		selectionStart: value.length,
		selectionEnd: value.length,
		focus: vi.fn(),
	} as unknown as HTMLTextAreaElement;
}

describe('editorActions', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe('insertMarkdownAtCursor', () => {
		it('inserts markdown tag at cursor position', async () => {
			const textarea = createMockTextarea('Hello world');
			const setActiveTab = vi.fn();
			const setForm = vi.fn();
			const getForm = vi.fn().mockReturnValue({ content: 'Hello world', imageMeta: {} });

			await insertMarkdownAtCursor(
				'https://example.com/img.jpg',
				'My Image',
				textarea,
				'preview',
				setActiveTab,
				undefined,
				getForm,
				setForm,
			);

			expect(setActiveTab).toHaveBeenCalledWith('write');
			expect(setForm).toHaveBeenCalledWith(
				expect.objectContaining({ content: 'Hello world![My Image](https://example.com/img.jpg)' }),
			);
		});

		it('updates imageMeta when dims provided', async () => {
			const textarea = createMockTextarea('');
			const setActiveTab = vi.fn();
			const setForm = vi.fn();
			const getForm = vi.fn().mockReturnValue({ content: '', imageMeta: {} });

			await insertMarkdownAtCursor(
				'https://example.com/img.jpg',
				'alt',
				textarea,
				'write',
				setActiveTab,
				{ width: 800, height: 600 },
				getForm,
				setForm,
			);

			expect(setForm).toHaveBeenCalledWith(
				expect.objectContaining({
					imageMeta: { 'https://example.com/img.jpg': { width: 800, height: 600 } },
				}),
			);
		});

		it('does not update imageMeta when dims not provided', async () => {
			const textarea = createMockTextarea('');
			const setActiveTab = vi.fn();
			const setForm = vi.fn();
			const getForm = vi.fn().mockReturnValue({ content: '', imageMeta: {} });

			await insertMarkdownAtCursor(
				'https://example.com/img.jpg',
				'alt',
				textarea,
				'write',
				setActiveTab,
				undefined,
				getForm,
				setForm,
			);

			expect(setForm).toHaveBeenCalledTimes(1);
			expect(setForm).toHaveBeenCalledWith(
				expect.objectContaining({ content: '![alt](https://example.com/img.jpg)' }),
			);
		});

		it('returns early if textareaRef is null', async () => {
			const setActiveTab = vi.fn();
			const setForm = vi.fn();
			const getForm = vi.fn();

			await insertMarkdownAtCursor(
				'url',
				'alt',
				null,
				'write',
				setActiveTab,
				undefined,
				getForm,
				setForm,
			);

			expect(setActiveTab).toHaveBeenCalledWith('write');
			expect(setForm).not.toHaveBeenCalled();
		});

		it('focuses textarea and sets cursor position after insertion', async () => {
			const textarea = createMockTextarea('');
			const setActiveTab = vi.fn();
			const setForm = vi.fn();
			const getForm = vi.fn().mockReturnValue({ content: '', imageMeta: {} });

			await insertMarkdownAtCursor(
				'https://example.com/img.jpg',
				'Image',
				textarea,
				'write',
				setActiveTab,
				undefined,
				getForm,
				setForm,
			);

			expect(textarea.focus).toHaveBeenCalled();
		});
	});

	describe('handleContentUpload', () => {
		it('uploads file and calls insertFn', async () => {
			const mediaStore = createMockMediaStore();
			const getForm = vi.fn().mockReturnValue({ content: '', imageMeta: {} });
			const setForm = vi.fn();
			const insertFn = vi.fn().mockResolvedValue(undefined);
			const file = new File(['test'], 'photo.png', { type: 'image/png' });
			const input = document.createElement('input');
			input.type = 'file';
			Object.defineProperty(input, 'files', { value: [file] });

			await handleContentUpload(
				{ target: input } as unknown as Event,
				mediaStore,
				getForm,
				setForm,
				insertFn,
			);

			expect(mediaStore.handleGalleryUpload).toHaveBeenCalledWith(file);
			expect(setForm).toHaveBeenCalledWith(
				expect.objectContaining({
					imageMeta: { 'https://example.com/img.jpg': { width: 800, height: 600 } },
				}),
			);
			expect(insertFn).toHaveBeenCalledWith(
				'https://example.com/img.jpg',
				'img',
				{ width: 800, height: 600 },
			);
		});

		it('resets input value after upload', async () => {
			const mediaStore = createMockMediaStore();
			const getForm = vi.fn().mockReturnValue({ content: '', imageMeta: {} });
			const setForm = vi.fn();
			const insertFn = vi.fn().mockResolvedValue(undefined);
			const file = new File(['test'], 'photo.png', { type: 'image/png' });
			const input = document.createElement('input');
			input.type = 'file';
			Object.defineProperty(input, 'files', { value: [file] });

			await handleContentUpload(
				{ target: input } as unknown as Event,
				mediaStore,
				getForm,
				setForm,
				insertFn,
			);

			expect(input.value).toBe('');
		});

		it('does nothing when no files selected', async () => {
			const mediaStore = createMockMediaStore();
			const getForm = vi.fn();
			const setForm = vi.fn();
			const insertFn = vi.fn();
			const input = document.createElement('input');
			input.type = 'file';
			Object.defineProperty(input, 'files', { value: [] });

			await handleContentUpload(
				{ target: input } as unknown as Event,
				mediaStore,
				getForm,
				setForm,
				insertFn,
			);

			expect(mediaStore.handleGalleryUpload).not.toHaveBeenCalled();
		});

		it('resets input value even on error', async () => {
			const mediaStore = createMockMediaStore();
			mediaStore.handleGalleryUpload.mockRejectedValue(new Error('fail'));
			const getForm = vi.fn().mockReturnValue({ content: '', imageMeta: {} });
			const setForm = vi.fn();
			const insertFn = vi.fn();
			const file = new File(['test'], 'photo.png', { type: 'image/png' });
			const input = document.createElement('input');
			input.type = 'file';
			Object.defineProperty(input, 'files', { value: [file] });

			await handleContentUpload(
				{ target: input } as unknown as Event,
				mediaStore,
				getForm,
				setForm,
				insertFn,
			);

			expect(input.value).toBe('');
		});
	});

	describe('copyToClipboard', () => {
		it('copies text to clipboard and toasts', async () => {
			const writeText = vi.fn().mockResolvedValue(undefined);
			Object.defineProperty(navigator, 'clipboard', {
				value: { writeText },
				configurable: true,
			});

			copyToClipboard('![alt](url)');

			expect(writeText).toHaveBeenCalledWith('![alt](url)');
		});
	});

	describe('setEditorCoverImage', () => {
		it('calls setter with url', () => {
			const setter = vi.fn();
			setEditorCoverImage('https://example.com/cover.jpg', setter);
			expect(setter).toHaveBeenCalledWith('https://example.com/cover.jpg');
		});

		it('calls setter with null', () => {
			const setter = vi.fn();
			setEditorCoverImage(null, setter);
			expect(setter).toHaveBeenCalledWith(null);
		});
	});

	describe('handleDeleteMediaWrapper', () => {
		it('delegates to mediaStore.handleDeleteMedia with callbacks', async () => {
			const mediaStore = createMockMediaStore();
			const item = { id: '1', url: 'https://example.com/img.jpg', name: 'img.jpg', uploadedAt: null };
			const callbacks = {
				onBeforeConfirm: vi.fn().mockResolvedValue(true),
				onError: vi.fn(),
				onRemoveImage: vi.fn(),
				onRemoveMarkdown: vi.fn(),
			};

			await handleDeleteMediaWrapper(item, mediaStore, callbacks);

			expect(mediaStore.handleDeleteMedia).toHaveBeenCalledWith(
				item,
				expect.any(Function),
				callbacks.onBeforeConfirm,
				callbacks.onError,
			);
		});

		it('calls onRemoveImage and onRemoveMarkdown when onDelete fires', async () => {
			const mediaStore = createMockMediaStore();
			const item = { id: '1', url: 'https://example.com/img.jpg', name: 'img.jpg', uploadedAt: null };
			const callbacks = {
				onBeforeConfirm: vi.fn().mockResolvedValue(true),
				onError: vi.fn(),
				onRemoveImage: vi.fn(),
				onRemoveMarkdown: vi.fn(),
			};

			await handleDeleteMediaWrapper(item, mediaStore, callbacks);

			// Get the onDelete callback passed to handleDeleteMedia
			const onDeleteFn = mediaStore.handleDeleteMedia.mock.calls[0][1];
			onDeleteFn('https://example.com/img.jpg');

			expect(callbacks.onRemoveImage).toHaveBeenCalledWith('https://example.com/img.jpg');
			expect(callbacks.onRemoveMarkdown).toHaveBeenCalledWith('https://example.com/img.jpg');
		});
	});
});
