import { render, fireEvent } from '@testing-library/svelte';
import { describe, expect, it, vi } from 'vitest';
import EntryList from './EntryList.svelte';

const mockBlogPosts = [
	{ id: '1', title: 'First Post', slug: 'first-post', excerpt: 'Excerpt 1', content: 'Content 1', coverImage: null, imageMeta: {}, createdAt: new Date('2026-01-15'), status: 'published' as const },
	{ id: '2', title: 'Draft Post', slug: 'draft-post', excerpt: 'Excerpt 2', content: 'Content 2', coverImage: 'https://example.com/cover.jpg', imageMeta: {}, createdAt: new Date('2026-01-10'), status: 'draft' as const },
	{ id: '3', title: 'Unlisted Post', slug: 'unlisted-post', excerpt: 'Excerpt 3', content: 'Content 3', coverImage: null, imageMeta: {}, createdAt: new Date('2026-01-05'), status: 'unlisted' as const },
];

const mockJournalEntries = [
	{ id: 'j1', title: 'Journal Entry 1', content: 'Today was great', excerpt: '', coverImage: null, imageMeta: {}, happinessRating: 5, ownerUid: 'uid', entryDate: '2026-01-15', createdAt: new Date('2026-01-15'), updatedAt: null },
	{ id: 'j2', title: 'Journal Entry 2', content: 'Feeling okay', excerpt: '', coverImage: null, imageMeta: {}, happinessRating: 3, ownerUid: 'uid', entryDate: '2026-01-14', createdAt: new Date('2026-01-14'), updatedAt: null },
];

describe('EntryList', () => {
	const defaultProps = {
		items: mockBlogPosts,
		loading: false,
		type: 'blog' as const,
		onEdit: vi.fn(),
		onDelete: vi.fn(),
	};

	it('renders loading state', () => {
		const { container } = render(EntryList, {
			props: { ...defaultProps, loading: true },
		});
		expect(container).toHaveTextContent('Loading posts…');
	});

	it('renders error state', () => {
		const { container } = render(EntryList, {
			props: { ...defaultProps, error: 'Failed to load' },
		});
		expect(container).toHaveTextContent('Blog Load Failed');
		expect(container).toHaveTextContent('Failed to load');
	});

	it('renders empty state', () => {
		const { container } = render(EntryList, {
			props: { ...defaultProps, items: [] },
		});
		expect(container).toHaveTextContent('No posts yet. Publish your first one above!');
	});

	it('renders blog posts', () => {
		const { getByText } = render(EntryList, {
			props: defaultProps,
		});
		expect(getByText('First Post')).toBeInTheDocument();
		expect(getByText('Draft Post')).toBeInTheDocument();
		expect(getByText('Unlisted Post')).toBeInTheDocument();
	});

	it('renders status badges', () => {
		const { container } = render(EntryList, {
			props: defaultProps,
		});
		expect(container).toHaveTextContent('Published');
		expect(container).toHaveTextContent('Draft');
		expect(container).toHaveTextContent('Unlisted');
	});

	it('renders cover image when available', () => {
		const { container } = render(EntryList, {
			props: defaultProps,
		});
		const imgs = container.querySelectorAll('img');
		const coverImg = Array.from(imgs).find((img) => img.getAttribute('src') === 'https://example.com/cover.jpg');
		expect(coverImg).not.toBeNull();
	});

	it('calls onEdit when Edit is clicked', async () => {
		const onEdit = vi.fn();
		const { getAllByText } = render(EntryList, {
			props: { ...defaultProps, onEdit },
		});
		const editButtons = getAllByText('Edit');
		await fireEvent.click(editButtons[0]);
		expect(onEdit).toHaveBeenCalledWith(mockBlogPosts[0]);
	});

	it('calls onDelete when Delete is clicked', async () => {
		const onDelete = vi.fn();
		const { getAllByText } = render(EntryList, {
			props: { ...defaultProps, onDelete },
		});
		const deleteButtons = getAllByText('Delete');
		await fireEvent.click(deleteButtons[0]);
		expect(onDelete).toHaveBeenCalledWith(mockBlogPosts[0]);
	});

	it('renders View links for blog posts', () => {
		const { getAllByText } = render(EntryList, {
			props: defaultProps,
		});
		const viewLinks = getAllByText('View');
		expect(viewLinks.length).toBe(3);
	});

	it('links draft posts to /blogs/drafts/', () => {
		const { container } = render(EntryList, {
			props: defaultProps,
		});
		const draftLink = container.querySelector('a[href="/blogs/drafts/draft-post/"]');
		expect(draftLink).not.toBeNull();
	});

	it('links published posts to /blogs/', () => {
		const { container } = render(EntryList, {
			props: defaultProps,
		});
		const pubLink = container.querySelector('a[href="/blogs/first-post/"]');
		expect(pubLink).not.toBeNull();
	});

	it('search filters items by title', async () => {
		const { getByPlaceholderText, queryByText } = render(EntryList, {
			props: defaultProps,
		});
		const searchInput = getByPlaceholderText('Search posts…');
		await fireEvent.input(searchInput, { target: { value: 'Draft' } });
		expect(queryByText('First Post')).toBeNull();
		expect(queryByText('Draft Post')).toBeInTheDocument();
	});

	it('status filter shows correct items', async () => {
		const { container } = render(EntryList, {
			props: defaultProps,
		});
		const select = container.querySelector('select') as HTMLSelectElement;
		await fireEvent.change(select, { target: { value: 'draft' } });
		expect(container).toHaveTextContent('1 of 3');
	});

	it('shows journal entries with dates', () => {
		const { getByText } = render(EntryList, {
			props: { ...defaultProps, items: mockJournalEntries, type: 'journal' },
		});
		expect(getByText('Journal Entry 1')).toBeInTheDocument();
		expect(getByText('Journal Entry 2')).toBeInTheDocument();
		expect(getByText('2026-01-15')).toBeInTheDocument();
	});

	it('journal empty state message is different', () => {
		const { container } = render(EntryList, {
			props: { ...defaultProps, items: [], type: 'journal' },
		});
		expect(container).toHaveTextContent('No journal entries found');
	});

	it('shows search results count when filtering', async () => {
		const { getByPlaceholderText, container } = render(EntryList, {
			props: defaultProps,
		});
		const searchInput = getByPlaceholderText('Search posts…');
		await fireEvent.input(searchInput, { target: { value: 'Draft' } });
		expect(container).toHaveTextContent('1 of 3');
	});

	it('renders sort dropdown', () => {
		const { container } = render(EntryList, {
			props: defaultProps,
		});
		const selects = container.querySelectorAll('select');
		expect(selects.length).toBeGreaterThanOrEqual(2);
	});

	it('shows "Show more" button when hasMore is true', () => {
		const { getByText } = render(EntryList, {
			props: { ...defaultProps, hasMore: true },
		});
		expect(getByText('Show more')).toBeInTheDocument();
	});

	it('does not show "Show more" when hasMore is false', () => {
		const { queryByText } = render(EntryList, {
			props: { ...defaultProps, hasMore: false },
		});
		expect(queryByText('Show more')).toBeNull();
	});

	it('shows loading more state', () => {
		const { getByText } = render(EntryList, {
			props: { ...defaultProps, hasMore: true, loadingMore: true },
		});
		expect(getByText('Loading…')).toBeInTheDocument();
	});
});
