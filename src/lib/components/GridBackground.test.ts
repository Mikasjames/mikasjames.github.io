import { render } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';
import GridBackground from './GridBackground.svelte';

describe('GridBackground', () => {
	it('renders a fixed grid element', () => {
		const { container } = render(GridBackground);
		const el = container.firstElementChild as HTMLElement;
		expect(el).not.toBeNull();
		expect(el.tagName).toBe('DIV');
		expect(el.className).toContain('fixed');
		expect(el.className).toContain('pointer-events-none');
	});

	it('renders with default opacity 2', () => {
		const { container } = render(GridBackground);
		const el = container.firstElementChild as HTMLElement;
		expect(el.className).toContain('0.02');
	});

	it('renders with opacity 3', () => {
		const { container } = render(GridBackground, { props: { opacity: '3' } });
		const el = container.firstElementChild as HTMLElement;
		expect(el.className).toContain('0.03');
	});

	it('applies custom className', () => {
		const { container } = render(GridBackground, { props: { class: 'test-class' } });
		const el = container.firstElementChild as HTMLElement;
		expect(el.className).toContain('test-class');
	});
});
