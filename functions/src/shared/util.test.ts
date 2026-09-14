import { describe, it, expect, vi, afterEach } from 'vitest';
import { sleep, createTimeoutSignal } from './util.js';

describe('sleep', () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('resolves after specified time', async () => {
		vi.useFakeTimers();
		const callback = vi.fn();

		const promise = sleep(1000).then(callback);
		expect(callback).not.toHaveBeenCalled();

		vi.advanceTimersByTime(1000);
		await promise;
		expect(callback).toHaveBeenCalledTimes(1);

		vi.useRealTimers();
	});

	it('resolves with undefined', async () => {
		vi.useFakeTimers();
		const promise = sleep(100);
		vi.advanceTimersByTime(100);
		const result = await promise;
		expect(result).toBeUndefined();
		vi.useRealTimers();
	});
});

describe('createTimeoutSignal', () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('creates an abort signal', () => {
		const { signal } = createTimeoutSignal(5000);
		expect(signal).toBeInstanceOf(AbortSignal);
		expect(signal.aborted).toBe(false);
	});

	it('aborts after timeout', async () => {
		vi.useFakeTimers();
		const { signal, cancel } = createTimeoutSignal(1000);

		expect(signal.aborted).toBe(false);

		vi.advanceTimersByTime(1000);
		expect(signal.aborted).toBe(true);

		cancel();
		vi.useRealTimers();
	});

	it('cancel prevents abort', async () => {
		vi.useFakeTimers();
		const { signal, cancel } = createTimeoutSignal(1000);

		cancel();
		vi.advanceTimersByTime(2000);
		expect(signal.aborted).toBe(false);

		vi.useRealTimers();
	});

	it('returns TimeoutSignal type with signal and cancel', () => {
		const result = createTimeoutSignal(1000);
		expect(result).toHaveProperty('signal');
		expect(result).toHaveProperty('cancel');
		expect(typeof result.cancel).toBe('function');
	});
});
