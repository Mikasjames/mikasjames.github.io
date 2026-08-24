import { render, screen } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';
import AppButton from './AppButton.svelte';

describe('AppButton', () => {
  it('renders a button by default with secondary/md styling', () => {
    render(AppButton, { props: { children: undefined } });
    const btn = screen.getByRole('button');
    expect(btn.tagName).toBe('BUTTON');
    expect(btn.className).toContain('bg-zinc-800');
    expect(btn.className).toContain('px-4 py-2');
  });

  it('applies primary/lg classes when requested', () => {
    render(AppButton, {
      props: { variant: 'primary', size: 'lg', children: undefined },
    });
    const btn = screen.getByRole('button');
    expect(btn.className).toContain('bg-accent-600');
    expect(btn.className).toContain('px-6 py-3');
  });

  it('renders an anchor when href is provided', () => {
    render(AppButton, {
      props: { href: 'https://example.com', children: undefined },
    });
    const link = screen.getByRole('link');
    expect(link.getAttribute('href')).toBe('https://example.com');
  });

  it('shows the loading spinner while loading', () => {
    const { container, rerender } = render(AppButton, {
      props: { loading: false, children: undefined },
    });
    expect(container.querySelector('.animate-spin')).toBeNull();

    rerender({ props: { loading: true, children: undefined } });
    expect(container.querySelector('.animate-spin')).not.toBeNull();
  });

  it('disables the button via the disabled prop', () => {
    render(AppButton, { props: { disabled: true, children: undefined } });
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('merges custom classes and forwards extra attributes', () => {
    render(AppButton, {
      props: { class: 'my-custom-class', type: 'submit', children: undefined },
    });
    const btn = screen.getByRole('button');
    expect(btn.className).toContain('my-custom-class');
    expect(btn.getAttribute('type')).toBe('submit');
  });
});
