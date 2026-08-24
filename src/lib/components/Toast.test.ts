import { render, screen } from '@testing-library/svelte';
import { tick } from 'svelte';
import { beforeEach, describe, expect, it } from 'vitest';
import { dismissToast, getToasts, toast } from '$lib/stores/toast.svelte';
import Toast from './Toast.svelte';

// The toast store is a module singleton — clear it between tests so the
// 3-second real-time auto-dismissal can never leak state between cases.
beforeEach(() => {
	for (const t of [...getToasts()]) {
		dismissToast(t.id);
	}
});

describe('Toast', () => {
  it('renders nothing when there are no toasts', async () => {
    const { container } = render(Toast);
    await tick();
    expect(container.querySelector('.fixed.bottom-4')).toBeNull();
  });

  it('renders a success toast message with success styling', async () => {
    render(Toast);
    toast('Saved successfully', 'success');
    await tick();

    expect(screen.getByText('Saved successfully')).toBeInTheDocument();
    expect(screen.getByText('Saved successfully').closest('div')).toHaveClass(
      'text-emerald-400',
    );
  });

  it('renders error variant styling for error toasts', async () => {
    render(Toast);
    toast('Something broke', 'error');
    await tick();

    expect(screen.getByText('Something broke')).toBeInTheDocument();
    expect(screen.getByText('Something broke').closest('div')).toHaveClass(
      'bg-red-500/10',
    );
  });

  it('provides a dismiss button for every visible toast', async () => {
    render(Toast);
    toast('one');
    toast('two');
    await tick();

    expect(screen.getAllByLabelText('Dismiss')).toHaveLength(2);
  });
});
