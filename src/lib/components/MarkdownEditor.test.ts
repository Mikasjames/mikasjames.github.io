import { render, fireEvent } from '@testing-library/svelte';
import { describe, expect, it, vi } from 'vitest';
import MarkdownEditor from './MarkdownEditor.svelte';

describe('MarkdownEditor', () => {
	it('renders with write tab active by default', () => {
		const { container } = render(MarkdownEditor, {
			props: {
				content: '',
				imageMeta: {},
				id: 'test-editor',
			},
		});
		const textarea = container.querySelector('textarea');
		expect(textarea).not.toBeNull();
		expect(container.querySelector('[role="toolbar"]')).not.toBeNull();
	});

	it('renders with preview tab when activeTab is preview', () => {
		const { container } = render(MarkdownEditor, {
			props: {
				content: '**Bold text**',
				imageMeta: {},
				id: 'test-editor',
				activeTab: 'preview',
			},
		});
		expect(container.querySelector('textarea')).toBeNull();
		expect(container).toHaveTextContent('Bold text');
	});

	it('shows placeholder text in preview when content is empty', () => {
		const { container } = render(MarkdownEditor, {
			props: {
				content: '',
				imageMeta: {},
				id: 'test-editor',
				activeTab: 'preview',
			},
		});
		expect(container).toHaveTextContent('Nothing to preview yet.');
	});

	it('switches to write tab when Write button is clicked', async () => {
		const { container, getByText } = render(MarkdownEditor, {
			props: {
				content: '',
				imageMeta: {},
				id: 'test-editor',
				activeTab: 'preview',
			},
		});
		await fireEvent.click(getByText('Write'));
		expect(container.querySelector('textarea')).not.toBeNull();
	});

	it('switches to preview tab when Preview button is clicked', async () => {
		const { container, getByText } = render(MarkdownEditor, {
			props: {
				content: '# Hello',
				imageMeta: {},
				id: 'test-editor',
			},
		});
		await fireEvent.click(getByText('Preview'));
		expect(container.querySelector('textarea')).toBeNull();
		expect(container).toHaveTextContent('Hello');
	});

	it('renders toolbar buttons', () => {
		const { container } = render(MarkdownEditor, {
			props: {
				content: '',
				imageMeta: {},
				id: 'test-editor',
			},
		});
		const toolbar = container.querySelector('[role="toolbar"]');
		expect(toolbar).not.toBeNull();
		const buttons = toolbar!.querySelectorAll('button');
		expect(buttons.length).toBeGreaterThan(5);
	});

	it('has Media Gallery button', () => {
		const { getByText } = render(MarkdownEditor, {
			props: {
				content: '',
				imageMeta: {},
				id: 'test-editor',
			},
		});
		expect(getByText('Media Gallery')).toBeInTheDocument();
	});

	it('calls onOpenMediaGallery when Media Gallery is clicked', async () => {
		const onOpenMediaGallery = vi.fn();
		const { getByText } = render(MarkdownEditor, {
			props: {
				content: '',
				imageMeta: {},
				id: 'test-editor',
				onOpenMediaGallery,
			},
		});
		await fireEvent.click(getByText('Media Gallery'));
		expect(onOpenMediaGallery).toHaveBeenCalledTimes(1);
	});

	it('renders textarea with placeholder', () => {
		const { container } = render(MarkdownEditor, {
			props: {
				content: '',
				imageMeta: {},
				id: 'test-editor',
				placeholderText: 'Custom placeholder',
			},
		});
		const textarea = container.querySelector('textarea');
		expect(textarea).toHaveAttribute('placeholder', 'Custom placeholder');
	});

	it('textarea is bound to content', async () => {
		const { container } = render(MarkdownEditor, {
			props: {
				content: 'Initial content',
				imageMeta: {},
				id: 'test-editor',
			},
		});
		const textarea = container.querySelector('textarea') as HTMLTextAreaElement;
		expect(textarea.value).toBe('Initial content');
	});

	it('has proper label association', () => {
		const { container } = render(MarkdownEditor, {
			props: {
				content: '',
				imageMeta: {},
				id: 'my-editor',
			},
		});
		const label = container.querySelector('label');
		expect(label).not.toBeNull();
		expect(label).toHaveAttribute('for', 'my-editor');
		const textarea = container.querySelector('textarea');
		expect(textarea).toHaveAttribute('id', 'my-editor');
	});
});
