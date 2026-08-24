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
});
