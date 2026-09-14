import { render } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';
import Load from './Load.svelte';

describe('Load', () => {
	it('renders a full-screen loading indicator', () => {
		const { container } = render(Load);
		const el = container.firstElementChild as HTMLElement;
		expect(el).not.toBeNull();
		expect(el.tagName).toBe('DIV');
		expect(el.className).toContain('fixed');
		expect(el.className).toContain('inset-0');
		expect(el.className).toContain('z-50');
	});

	it('contains the SVG animation', () => {
		const { container } = render(Load);
		const svg = container.querySelector('svg');
		expect(svg).not.toBeNull();
		expect(svg).toHaveAttribute('viewBox', '0 0 128 128');
	});

	it('has the draw-container, draw-bracket, and blink-cursor elements', () => {
		const { container } = render(Load);
		expect(container.querySelector('.draw-container')).not.toBeNull();
		expect(container.querySelector('.draw-bracket')).not.toBeNull();
		expect(container.querySelector('.blink-cursor')).not.toBeNull();
	});
});
