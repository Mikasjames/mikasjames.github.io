import { render, fireEvent } from '@testing-library/svelte';
import { describe, expect, it, vi } from 'vitest';
import ContentImagesHelper from './ContentImagesHelper.svelte';

describe('ContentImagesHelper', () => {
	it('renders the helper heading', () => {
		const { container } = render(ContentImagesHelper, {
			props: {
				onOpenMediaGallery: vi.fn(),
				handleContentUpload: vi.fn(),
				contentUploading: false,
				contentUploadError: '',
				recentMediaItems: [],
				mediaLoadError: '',
				insertMarkdownAtCursor: vi.fn(),
				setEditorCoverImage: vi.fn(),
			},
		});
		expect(container).toHaveTextContent('Content Images Helper');
	});

	it('renders Manage Gallery button', () => {
		const onOpenMediaGallery = vi.fn();
		const { getByText } = render(ContentImagesHelper, {
			props: {
				onOpenMediaGallery,
				handleContentUpload: vi.fn(),
				contentUploading: false,
				contentUploadError: '',
				recentMediaItems: [],
				mediaLoadError: '',
				insertMarkdownAtCursor: vi.fn(),
				setEditorCoverImage: vi.fn(),
			},
		});
		expect(getByText('Manage Gallery')).toBeInTheDocument();
	});

	it('calls onOpenMediaGallery when Manage Gallery is clicked', async () => {
		const onOpenMediaGallery = vi.fn();
		const { getByText } = render(ContentImagesHelper, {
			props: {
				onOpenMediaGallery,
				handleContentUpload: vi.fn(),
				contentUploading: false,
				contentUploadError: '',
				recentMediaItems: [],
				mediaLoadError: '',
				insertMarkdownAtCursor: vi.fn(),
				setEditorCoverImage: vi.fn(),
			},
		});
		await fireEvent.click(getByText('Manage Gallery'));
		expect(onOpenMediaGallery).toHaveBeenCalledTimes(1);
	});

	it('shows uploading state', () => {
		const { container } = render(ContentImagesHelper, {
			props: {
				onOpenMediaGallery: vi.fn(),
				handleContentUpload: vi.fn(),
				contentUploading: true,
				contentUploadError: '',
				recentMediaItems: [],
				mediaLoadError: '',
				insertMarkdownAtCursor: vi.fn(),
				setEditorCoverImage: vi.fn(),
			},
		});
		expect(container).toHaveTextContent('Uploading and indexing asset...');
	});

	it('shows upload error', () => {
		const { container } = render(ContentImagesHelper, {
			props: {
				onOpenMediaGallery: vi.fn(),
				handleContentUpload: vi.fn(),
				contentUploading: false,
				contentUploadError: 'Upload failed',
				recentMediaItems: [],
				mediaLoadError: '',
				insertMarkdownAtCursor: vi.fn(),
				setEditorCoverImage: vi.fn(),
			},
		});
		expect(container).toHaveTextContent('Upload failed');
	});

	it('shows media load error', () => {
		const { container } = render(ContentImagesHelper, {
			props: {
				onOpenMediaGallery: vi.fn(),
				handleContentUpload: vi.fn(),
				contentUploading: false,
				contentUploadError: '',
				recentMediaItems: [],
				mediaLoadError: 'Failed to load gallery',
				insertMarkdownAtCursor: vi.fn(),
				setEditorCoverImage: vi.fn(),
			},
		});
		expect(container).toHaveTextContent('Gallery Load Failed');
		expect(container).toHaveTextContent('Failed to load gallery');
	});

	it('shows empty state when no images', () => {
		const { container } = render(ContentImagesHelper, {
			props: {
				onOpenMediaGallery: vi.fn(),
				handleContentUpload: vi.fn(),
				contentUploading: false,
				contentUploadError: '',
				recentMediaItems: [],
				mediaLoadError: '',
				insertMarkdownAtCursor: vi.fn(),
				setEditorCoverImage: vi.fn(),
			},
		});
		expect(container).toHaveTextContent('No images found in your media gallery');
	});

	it('renders recent media items', () => {
		const items = [
			{ id: '1', url: 'https://example.com/img1.jpg', name: 'img1.jpg', uploadedAt: null, width: 100, height: 100 },
			{ id: '2', url: 'https://example.com/img2.png', name: 'img2.png', uploadedAt: null, width: 200, height: 150 },
		];
		const { getByText } = render(ContentImagesHelper, {
			props: {
				onOpenMediaGallery: vi.fn(),
				handleContentUpload: vi.fn(),
				contentUploading: false,
				contentUploadError: '',
				recentMediaItems: items,
				mediaLoadError: '',
				insertMarkdownAtCursor: vi.fn(),
				setEditorCoverImage: vi.fn(),
			},
		});
		expect(getByText('img1.jpg')).toBeInTheDocument();
		expect(getByText('img2.png')).toBeInTheDocument();
	});

	it('calls insertMarkdownAtCursor when Insert is clicked', async () => {
		const insertMarkdownAtCursor = vi.fn();
		const items = [
			{ id: '1', url: 'https://example.com/img1.jpg', name: 'img1.jpg', uploadedAt: null, width: 100, height: 100 },
		];
		const { container } = render(ContentImagesHelper, {
			props: {
				onOpenMediaGallery: vi.fn(),
				handleContentUpload: vi.fn(),
				contentUploading: false,
				contentUploadError: '',
				recentMediaItems: items,
				mediaLoadError: '',
				insertMarkdownAtCursor,
				setEditorCoverImage: vi.fn(),
			},
		});
		const insertButton = container.querySelector('button[title="Insert image into editor content"]')!;
		await fireEvent.click(insertButton);
		expect(insertMarkdownAtCursor).toHaveBeenCalledWith(
			'https://example.com/img1.jpg',
			'img1',
			{ width: 100, height: 100 },
		);
	});

	it('calls setEditorCoverImage when Cover is clicked', async () => {
		const setEditorCoverImage = vi.fn();
		const items = [
			{ id: '1', url: 'https://example.com/img1.jpg', name: 'img1.jpg', uploadedAt: null, width: 100, height: 100 },
		];
		const { container } = render(ContentImagesHelper, {
			props: {
				onOpenMediaGallery: vi.fn(),
				handleContentUpload: vi.fn(),
				contentUploading: false,
				contentUploadError: '',
				recentMediaItems: items,
				mediaLoadError: '',
				insertMarkdownAtCursor: vi.fn(),
				setEditorCoverImage,
			},
		});
		const coverButtons = container.querySelectorAll('button');
		const coverBtn = Array.from(coverButtons).find((b) => b.textContent?.trim() === 'Cover')!;
		await fireEvent.click(coverBtn);
		expect(setEditorCoverImage).toHaveBeenCalledWith('https://example.com/img1.jpg');
	});

	it('has file input for image upload', () => {
		const { container } = render(ContentImagesHelper, {
			props: {
				onOpenMediaGallery: vi.fn(),
				handleContentUpload: vi.fn(),
				contentUploading: false,
				contentUploadError: '',
				recentMediaItems: [],
				mediaLoadError: '',
				insertMarkdownAtCursor: vi.fn(),
				setEditorCoverImage: vi.fn(),
			},
		});
		const fileInput = container.querySelector('input[type="file"]');
		expect(fileInput).not.toBeNull();
		expect(fileInput).toHaveAttribute('accept', 'image/*');
	});
});
