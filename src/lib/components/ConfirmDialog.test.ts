import { fireEvent, render } from '@testing-library/svelte';
import { describe, expect, it, vi } from 'vitest';
import ConfirmDialog from './ConfirmDialog.svelte';

describe('ConfirmDialog', () => {
	it('renders message and default button texts inside the dialog', () => {
		const { container, getByText } = render(ConfirmDialog, {
			props: { show: true, title: 'Delete habit?', message: 'This cannot be undone.' },
		});

		expect(container.querySelector('[role="dialog"]')).not.toBeNull();
		expect(getByText('Delete habit?')).toBeInTheDocument();
		expect(getByText('This cannot be undone.')).toBeInTheDocument();
		expect(getByText('Confirm')).toBeInTheDocument();
		expect(getByText('Cancel')).toBeInTheDocument();
	});

	function confirmButton(result: {
		getByRole: (role: string, opts?: { name: string }) => HTMLElement;
	}) {
		return result.getByRole('button', { name: 'Confirm' }) as HTMLButtonElement;
	}

	it('applies danger styling by default and primary when requested', () => {
		const danger = render(ConfirmDialog, { props: { show: true } });
		expect(confirmButton(danger).className).toContain('text-red-400');
		danger.unmount();

		const primary = render(ConfirmDialog, {
			props: { show: true, variant: 'primary' },
		});
		expect(confirmButton(primary).className).toContain('bg-accent-600');
	});

	it('fires onConfirm and closes on confirm click', async () => {
		const onConfirm = vi.fn();
		const onCancel = vi.fn();
		const { getByText } = render(ConfirmDialog, {
			props: { show: true, title: 'T', onConfirm, onCancel },
		});

		await fireEvent.click(getByText('Confirm'));
		expect(onConfirm).toHaveBeenCalledTimes(1);
		expect(onCancel).not.toHaveBeenCalled();
	});

	it('fires onCancel on cancel click', async () => {
		const onConfirm = vi.fn();
		const onCancel = vi.fn();
		const { getByText } = render(ConfirmDialog, {
			props: { show: true, title: 'T', onConfirm, onCancel },
		});

		await fireEvent.click(getByText('Cancel'));
		expect(onCancel).toHaveBeenCalledTimes(1);
		expect(onConfirm).not.toHaveBeenCalled();
	});

	it('fires onDismiss (not onCancel) on Escape when onDismiss is provided', async () => {
		const onCancel = vi.fn();
		const onDismiss = vi.fn();
		render(ConfirmDialog, {
			props: { show: true, title: 'T', onConfirm: vi.fn(), onCancel, onDismiss },
		});

		await fireEvent.keyDown(window, { key: 'Escape' });
		expect(onDismiss).toHaveBeenCalledTimes(1);
		expect(onCancel).not.toHaveBeenCalled();
	});

	it('falls back to onCancel on Escape when no onDismiss is provided', async () => {
		const onCancel = vi.fn();
		render(ConfirmDialog, {
			props: { show: true, title: 'T', onConfirm: vi.fn(), onCancel },
		});

		await fireEvent.keyDown(window, { key: 'Escape' });
		expect(onCancel).toHaveBeenCalledTimes(1);
	});

	it('fires onDismiss (not onCancel) on backdrop click', async () => {
		const onCancel = vi.fn();
		const onDismiss = vi.fn();
		const { container } = render(ConfirmDialog, {
			props: { show: true, title: 'T', onConfirm: vi.fn(), onCancel, onDismiss },
		});
		const backdrop = container.querySelector<HTMLElement>('[role="dialog"]')!;

		await fireEvent.click(backdrop);
		expect(onDismiss).toHaveBeenCalledTimes(1);
		expect(onCancel).not.toHaveBeenCalled();
	});

	it('fires onDismiss (not onCancel) on the close button', async () => {
		const onCancel = vi.fn();
		const onDismiss = vi.fn();
		const { getByLabelText } = render(ConfirmDialog, {
			props: { show: true, title: 'T', onConfirm: vi.fn(), onCancel, onDismiss },
		});

		await fireEvent.click(getByLabelText('Close'));
		expect(onDismiss).toHaveBeenCalledTimes(1);
		expect(onCancel).not.toHaveBeenCalled();
	});

	it('does not fire onDismiss when the cancel button is clicked', async () => {
		const onCancel = vi.fn();
		const onDismiss = vi.fn();
		const { getByText } = render(ConfirmDialog, {
			props: { show: true, title: 'T', onConfirm: vi.fn(), onCancel, onDismiss },
		});

		await fireEvent.click(getByText('Cancel'));
		expect(onCancel).toHaveBeenCalledTimes(1);
		expect(onDismiss).not.toHaveBeenCalled();
	});
});
