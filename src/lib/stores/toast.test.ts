import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Module-level $state means every test needs a fresh module instance
async function freshToastModule() {
	vi.resetModules();
	return await import('$lib/stores/toast.svelte');
}

beforeEach(() => {
	vi.useFakeTimers();
});

afterEach(() => {
	vi.useRealTimers();
});

describe('toast store', () => {
	it('adds a toast with the info variant by default', async () => {
		const mod = await freshToastModule();
		mod.toast('Saved!');
		const toasts = mod.getToasts();
		expect(toasts).toHaveLength(1);
		expect(toasts[0].message).toBe('Saved!');
		expect(toasts[0].variant).toBe('info');
		expect(toasts[0].id).toBeTruthy();
	});

	it('honors explicit variants and keeps multiple toasts ordered', async () => {
		const mod = await freshToastModule();
		mod.toast('first', 'success');
		mod.toast('second', 'error');
		const toasts = mod.getToasts();
		expect(toasts.map((t) => [t.message, t.variant])).toEqual([
			['first', 'success'],
			['second', 'error'],
		]);
	});

	it('dismisses a specific toast by id without touching others', async () => {
		const mod = await freshToastModule();
		mod.toast('keep me');
		mod.toast('also keep');
		mod.toast('remove me');

		const middle = mod.getToasts()[1];
		mod.dismissToast(middle.id);

		expect(mod.getToasts().map((t) => t.message)).toEqual(['keep me', 'remove me']);
	});

	it('auto-dismisses after 3 seconds, not before', async () => {
		const mod = await freshToastModule();
		mod.toast('fleeting');

		vi.advanceTimersByTime(2999);
		expect(mod.getToasts()).toHaveLength(1);

		vi.advanceTimersByTime(1);
		expect(mod.getToasts()).toHaveLength(0);
	});

	it('starts empty on a fresh module instance', async () => {
		const mod = await freshToastModule();
		expect(mod.getToasts()).toEqual([]);
	});
});
