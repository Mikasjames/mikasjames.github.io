import { render, fireEvent } from '@testing-library/svelte';
import { describe, expect, it, vi } from 'vitest';
import CoverImage from './CoverImage.svelte';

describe('CoverImage', () => {
	it('renders with no cover image', () => {
		const { container } = render(CoverImage, {
			props: {
				coverImage: null,
				onCoverUpload: vi.fn(),
				coverUploading: false,
				coverError: '',
			},
		});
		expect(container).toHaveTextContent('Cover Image');
		expect(container).toHaveTextContent('No cover image preview');
	});

	it('renders preview when coverImage is set', () => {
		const { container } = render(CoverImage, {
			props: {
				coverImage: 'https://example.com/cover.jpg',
				onCoverUpload: vi.fn(),
				coverUploading: false,
				coverError: '',
			},
		});
		const img = container.querySelector('img');
		expect(img).not.toBeNull();
		expect(img).toHaveAttribute('src', 'https://example.com/cover.jpg');
		expect(img).toHaveAttribute('alt', 'Cover Preview');
	});

	it('shows Remove Cover button when coverImage is set', () => {
		const { getByText } = render(CoverImage, {
			props: {
				coverImage: 'https://example.com/cover.jpg',
				onCoverUpload: vi.fn(),
				coverUploading: false,
				coverError: '',
			},
		});
		expect(getByText('Remove Cover')).toBeInTheDocument();
	});

	it('removes cover image when Remove Cover is clicked', async () => {
		const { getByText, container } = render(CoverImage, {
			props: {
				coverImage: 'https://example.com/cover.jpg',
				onCoverUpload: vi.fn(),
				coverUploading: false,
				coverError: '',
			},
		});
		await fireEvent.click(getByText('Remove Cover'));
		expect(container).toHaveTextContent('No cover image preview');
	});

	it('shows uploading state', () => {
		const { container } = render(CoverImage, {
			props: {
				coverImage: null,
				onCoverUpload: vi.fn(),
				coverUploading: true,
				coverError: '',
			},
		});
		expect(container).toHaveTextContent('Uploading...');
	});

	it('shows error message', () => {
		const { container } = render(CoverImage, {
			props: {
				coverImage: null,
				onCoverUpload: vi.fn(),
				coverUploading: false,
				coverError: 'Upload failed',
			},
		});
		expect(container).toHaveTextContent('Upload failed');
	});

	it('renders file input for upload', () => {
		const { container } = render(CoverImage, {
			props: {
				coverImage: null,
				onCoverUpload: vi.fn(),
				coverUploading: false,
				coverError: '',
			},
		});
		const fileInput = container.querySelector('input[type="file"]');
		expect(fileInput).not.toBeNull();
		expect(fileInput).toHaveAttribute('accept', 'image/*');
	});

	it('calls onCoverUpload when file is selected', async () => {
		const onCoverUpload = vi.fn();
		const { container } = render(CoverImage, {
			props: {
				coverImage: null,
				onCoverUpload,
				coverUploading: false,
				coverError: '',
			},
		});
		const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
		const file = new File(['test'], 'test.png', { type: 'image/png' });
		await fireEvent.change(fileInput, { target: { files: [file] } });
		expect(onCoverUpload).toHaveBeenCalledTimes(1);
	});

	it('has text input for URL', () => {
		const { container } = render(CoverImage, {
			props: {
				coverImage: null,
				onCoverUpload: vi.fn(),
				coverUploading: false,
				coverError: '',
			},
		});
		const urlInput = container.querySelector('input[type="text"]') as HTMLInputElement;
		expect(urlInput).not.toBeNull();
		expect(urlInput).toHaveAttribute('placeholder', 'https://example.com/image.jpg');
	});
});
