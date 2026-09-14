import { render } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';
import Spinner from './Spinner.svelte';

describe('Spinner', () => {
	it('renders with default size and color', () => {
		const { container } = render(Spinner);
		const el = container.firstElementChild as HTMLElement;
		expect(el).not.toBeNull();
		expect(el.tagName).toBe('DIV');
		expect(el.className).toContain('animate-spin');
		expect(el.className).toContain('w-5 h-5');
		expect(el.className).toContain('border-accent-500');
	});

	it('renders with xs size', () => {
		const { container } = render(Spinner, { props: { size: 'xs' } });
		const el = container.firstElementChild as HTMLElement;
		expect(el.className).toContain('w-3 h-3');
	});

	it('renders with sm size', () => {
		const { container } = render(Spinner, { props: { size: 'sm' } });
		const el = container.firstElementChild as HTMLElement;
		expect(el.className).toContain('w-4 h-4');
	});

	it('renders with lg size', () => {
		const { container } = render(Spinner, { props: { size: 'lg' } });
		const el = container.firstElementChild as HTMLElement;
		expect(el.className).toContain('w-6 h-6');
	});

	it('renders with xl size', () => {
		const { container } = render(Spinner, { props: { size: 'xl' } });
		const el = container.firstElementChild as HTMLElement;
		expect(el.className).toContain('w-8 h-8');
	});

	it('renders with white color', () => {
		const { container } = render(Spinner, { props: { color: 'white' } });
		const el = container.firstElementChild as HTMLElement;
		expect(el.className).toContain('border-white/30');
		expect(el.className).toContain('border-t-white');
	});

	it('renders with zinc color', () => {
		const { container } = render(Spinner, { props: { color: 'zinc' } });
		const el = container.firstElementChild as HTMLElement;
		expect(el.className).toContain('border-zinc-600');
		expect(el.className).toContain('border-t-zinc-300');
	});

	it('renders with danger color', () => {
		const { container } = render(Spinner, { props: { color: 'danger' } });
		const el = container.firstElementChild as HTMLElement;
		expect(el.className).toContain('border-zinc-700');
		expect(el.className).toContain('border-t-red-500');
	});

	it('applies custom className', () => {
		const { container } = render(Spinner, { props: { class: 'my-custom-class' } });
		const el = container.firstElementChild as HTMLElement;
		expect(el.className).toContain('my-custom-class');
	});
});
