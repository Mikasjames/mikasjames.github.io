import { render, fireEvent } from '@testing-library/svelte';
import { flushSync } from 'svelte';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import BlogPostForm from './BlogPostForm.svelte';

vi.mock('$lib/firebase/firestore.svelte', () => ({
	createPost: vi.fn().mockResolvedValue('new-post-id'),
	updatePost: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('$lib/stores/toast.svelte', () => ({
	toast: vi.fn(),
}));

vi.mock('$lib/utils/imageMeta', () => ({
	resolveMissingImageMeta: vi.fn().mockResolvedValue({}),
	sanitizeImageMetaFromMarkdown: vi.fn().mockReturnValue({}),
	enrichImageMetaFromGallery: vi.fn().mockReturnValue({}),
}));

function createMockMediaStore() {
	return {
		mediaItems: [],
		mediaUploading: false,
		mediaUploadError: '',
		mediaLoadError: '',
		recentMediaItems: [],
		openMediaGallery: vi.fn(),
		handleGalleryUpload: vi.fn().mockResolvedValue({ url: 'https://example.com/uploaded.jpg', width: 100, height: 100, name: 'uploaded.jpg' }),
		handleDeleteMedia: vi.fn(),
		loadRecentMedia: vi.fn(),
		mediaLoaded: false,
		mediaLoading: false,
		deletingMediaIds: new Set<string>(),
		mediaHasMore: false,
		loadMoreMediaItems: vi.fn(),
		loadMediaItems: vi.fn(),
	} as unknown as ReturnType<typeof import('$lib/firebase/media.svelte').createMediaStore>;
}

describe('BlogPostForm', () => {
	const defaultProps = {
		mediaStore: createMockMediaStore(),
		loadPosts: vi.fn().mockResolvedValue(undefined),
	};

	beforeEach(() => {
		vi.clearAllMocks();
		vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
	});

	it('renders "New Post" heading by default', () => {
		const { getByText } = render(BlogPostForm, { props: defaultProps });
		expect(getByText('New Post')).toBeInTheDocument();
	});

	it('renders form fields', () => {
		const { getByLabelText } = render(BlogPostForm, { props: defaultProps });
		expect(getByLabelText('Title')).toBeInTheDocument();
		expect(getByLabelText(/Slug/)).toBeInTheDocument();
		expect(getByLabelText('Status')).toBeInTheDocument();
		expect(getByLabelText('Excerpt')).toBeInTheDocument();
	});

	it('renders publish button with submit type', () => {
		const { container } = render(BlogPostForm, { props: defaultProps });
		const submitBtn = container.querySelector('#publish-btn');
		expect(submitBtn).not.toBeNull();
		expect(submitBtn).toHaveAttribute('type', 'submit');
	});

	it('auto-generates slug from title', async () => {
		const { getByLabelText } = render(BlogPostForm, { props: defaultProps });
		const titleInput = getByLabelText('Title') as HTMLInputElement;
		await fireEvent.input(titleInput, { target: { value: 'My New Post' } });
		const slugInput = getByLabelText(/Slug/) as HTMLInputElement;
		expect(slugInput.value).toBe('my-new-post');
	});

	it('does not auto-generate slug after manual edit', async () => {
		const { getByLabelText } = render(BlogPostForm, { props: defaultProps });
		const slugInput = getByLabelText(/Slug/) as HTMLInputElement;
		await fireEvent.input(slugInput, { target: { value: 'custom-slug' } });
		const titleInput = getByLabelText('Title') as HTMLInputElement;
		await fireEvent.input(titleInput, { target: { value: 'Changed Title' } });
		expect(slugInput.value).toBe('custom-slug');
	});

	it('renders status selector with all options', () => {
		const { container } = render(BlogPostForm, { props: defaultProps });
		const select = container.querySelector('select') as HTMLSelectElement;
		const options = Array.from(select.options).map((o) => o.value);
		expect(options).toContain('published');
		expect(options).toContain('unlisted');
		expect(options).toContain('draft');
	});

	it('default status is published', () => {
		const { container } = render(BlogPostForm, { props: defaultProps });
		const select = container.querySelector('select') as HTMLSelectElement;
		expect(select.value).toBe('published');
	});

	it('renders content editor', () => {
		const { container } = render(BlogPostForm, { props: defaultProps });
		const textarea = container.querySelector('textarea');
		expect(textarea).not.toBeNull();
	});

	it('renders cover image section', () => {
		const { container } = render(BlogPostForm, { props: defaultProps });
		expect(container).toHaveTextContent('Cover Image');
	});

	it('startEdit sets form to edit mode', async () => {
		const { component, getByText } = render(BlogPostForm, { props: defaultProps });

		component.startEdit({
			id: 'post-1',
			title: 'Test Post',
			slug: 'test-post',
			excerpt: 'Test excerpt',
			content: 'Test content',
			coverImage: null,
			imageMeta: {},
			createdAt: new Date(),
			status: 'draft',
		});
		flushSync();

		expect(getByText('Edit Post')).toBeInTheDocument();
		expect(getByText('Save Changes')).toBeInTheDocument();
	});

	it('resetForm returns to new post mode', () => {
		const { component, getByText } = render(BlogPostForm, { props: defaultProps });

		component.startEdit({
			id: 'post-1',
			title: 'Test Post',
			slug: 'test-post',
			excerpt: 'Test excerpt',
			content: 'Test content',
			coverImage: null,
			imageMeta: {},
			createdAt: new Date(),
			status: 'draft',
		});

		component.resetForm();
		expect(getByText('New Post')).toBeInTheDocument();
		expect(getByText('Publish Post')).toBeInTheDocument();
	});

	it('isEditing returns correct value', () => {
		const { component } = render(BlogPostForm, { props: defaultProps });

		expect(component.isEditing('any-id')).toBe(false);

		component.startEdit({
			id: 'post-1',
			title: 'Test',
			slug: 'test',
			excerpt: 'Excerpt',
			content: 'Content',
			coverImage: null,
			imageMeta: {},
			createdAt: new Date(),
			status: 'draft',
		});

		expect(component.isEditing('post-1')).toBe(true);
		expect(component.isEditing('other-id')).toBe(false);
	});

	it('populates form fields when startEdit is called', async () => {
		const { component, getByLabelText } = render(BlogPostForm, { props: defaultProps });

		component.startEdit({
			id: 'post-1',
			title: 'My Edited Post',
			slug: 'my-edited-post',
			excerpt: 'Edited excerpt',
			content: 'Edited content',
			coverImage: 'https://example.com/cover.jpg',
			imageMeta: {},
			createdAt: new Date(),
			status: 'unlisted',
		});
		flushSync();

		expect((getByLabelText('Title') as HTMLInputElement).value).toBe('My Edited Post');
		expect((getByLabelText(/Slug/) as HTMLInputElement).value).toBe('my-edited-post');
		expect((getByLabelText('Excerpt') as HTMLTextAreaElement).value).toBe('Edited excerpt');
	});
});
