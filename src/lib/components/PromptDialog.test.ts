import { fireEvent, render } from '@testing-library/svelte';
import { tick } from 'svelte';
import { describe, expect, it, vi } from 'vitest';
import PromptDialog from './PromptDialog.svelte';

async function open(props: Record<string, unknown> = {}) {
	const result = render(PromptDialog, {
		props: { show: true, title: 'Rename', ...props },
	});
	return result;
}

describe('PromptDialog', () => {
	it('renders label only when provided and binds typed value', async () => {
		const { container, getByLabelText, queryByText } = await open({
			label: 'New name',
			placeholder: 'type here',
		});
		expect(getByLabelText('New name')).toBeInTheDocument();
		expect(queryByText('unnecessary-label')).toBeNull();

		const input = container.querySelector('#prompt-input') as HTMLInputElement;
		await fireEvent.input(input, { target: { value: 'my new name' } });
		expect(input.value).toBe('my new name');
	});

	it('disables confirm while the value is blank', async () => {
		const { container, getByText } = await open();
		const confirmBtn = getByText('Confirm') as HTMLButtonElement;
		expect(confirmBtn.disabled).toBe(true);

		const input = container.querySelector('#prompt-input') as HTMLInputElement;
		await fireEvent.input(input, { target: { value: '  ' } });
		expect((getByText('Confirm') as HTMLButtonElement).disabled).toBe(true);

		await fireEvent.input(input, { target: { value: 'x' } });
		expect((getByText('Confirm') as HTMLButtonElement).disabled).toBe(false);
	});

	it('confirms with the current value on button click', async () => {
		const onConfirm = vi.fn();
		const { container, getByText } = await open({ onConfirm });
		const input = container.querySelector('#prompt-input') as HTMLInputElement;
		await fireEvent.input(input, { target: { value: 'answer' } });

		await fireEvent.click(getByText('Confirm'));
		expect(onConfirm).toHaveBeenCalledWith('answer');
	});

	it('confirms on Enter and cancels on Escape from the input', async () => {
		const onConfirm = vi.fn();
		const onCancel = vi.fn();
		const { container } = await open({ onConfirm, onCancel });
		const input = container.querySelector('#prompt-input') as HTMLInputElement;
		await fireEvent.input(input, { target: { value: 'typed' } });

		await fireEvent.keyDown(input, { key: 'Enter' });
		expect(onConfirm).toHaveBeenCalledWith('typed');

		await fireEvent.input(input, { target: { value: 'again' } });
		await fireEvent.keyDown(input, { key: 'Escape' });
		expect(onCancel).toHaveBeenCalledTimes(1);
	});

	it('resets the value to empty so a reopened dialog starts clean', async () => {
		const { container, getByText, rerender } = await open({});
		const input = container.querySelector('#prompt-input') as HTMLInputElement;
		await fireEvent.input(input, { target: { value: 'will vanish' } });

		await fireEvent.click(getByText('Cancel'));
		await rerender({ show: true, title: 'Rename' });
		await tick();
		const reopened = document.querySelector('#prompt-input') as HTMLInputElement;
		expect(reopened.value).toBe('');
	});
});
