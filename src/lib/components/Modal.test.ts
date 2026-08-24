import { fireEvent, render } from '@testing-library/svelte';
import { describe, expect, it, vi } from 'vitest';
import Modal from './Modal.svelte';

// NOTE: queries are scoped to the rendered container rather than `screen`
// to avoid cross-copy @testing-library/dom binding issues under pnpm.

describe('Modal', () => {
  it('renders nothing when show is false', () => {
    const { container } = render(Modal, { props: { show: false } });
    expect(container.querySelector('[role="dialog"]')).toBeNull();
    expect(document.body.classList.contains('overflow-hidden')).toBe(false);
  });

  it('renders dialog with title/description and locks body scroll', () => {
    const { container, unmount } = render(Modal, {
      props: { show: true, title: 'Delete post?', description: 'This cannot be undone.' },
    });

    const dialog = container.querySelector<HTMLElement>('[role="dialog"]');
    expect(dialog).not.toBeNull();
    expect(dialog).toHaveAccessibleName('Delete post?');
    expect(container).toHaveTextContent('Delete post?');
    expect(container).toHaveTextContent('This cannot be undone.');
    expect(document.body.classList.contains('overflow-hidden')).toBe(true);

    unmount();
    expect(document.body.classList.contains('overflow-hidden')).toBe(false);
  });

  it('closes via the close button and reports onclose', async () => {
    const onclose = vi.fn();
    const { container, getByLabelText } = render(Modal, {
      props: { show: true, title: 'T', onclose },
    });
    void container;

    await fireEvent.click(getByLabelText('Close'));
    expect(onclose).toHaveBeenCalledTimes(1);
  });

  it('closes on Escape key anywhere in the window', async () => {
    const onclose = vi.fn();
    render(Modal, { props: { show: true, onclose } });

    await fireEvent.keyDown(window, { key: 'Escape' });
    expect(onclose).toHaveBeenCalledTimes(1);
  });

  it('closes when clicking the backdrop itself', async () => {
    const onclose = vi.fn();
    const { container } = render(Modal, { props: { show: true, onclose } });
    const backdrop = container.querySelector<HTMLElement>('[role="dialog"]')!;

    await fireEvent.click(backdrop);
    expect(onclose).toHaveBeenCalledTimes(1);
  });

  it('stays open when clicking inside the panel', async () => {
    const onclose = vi.fn();
    const { container } = render(Modal, {
      props: { show: true, title: 'T', description: 'D', onclose },
    });
    const panel = container.querySelector<HTMLElement>('[role="dialog"] > div')!;

    await fireEvent.click(panel);
    expect(onclose).not.toHaveBeenCalled();
  });
});
