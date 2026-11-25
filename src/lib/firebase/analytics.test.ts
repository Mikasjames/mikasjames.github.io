import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

vi.mock('firebase/analytics', () => ({
	getAnalytics: vi.fn(),
	logEvent: vi.fn(),
}));

vi.mock('firebase/app', () => ({
	getApps: vi.fn().mockReturnValue([]),
	initializeApp: vi.fn(),
}));

import { getAnalytics, logEvent as firebaseLogEvent } from 'firebase/analytics';
import { logPageView, logEvent } from './analytics';

const mockGetAnalytics = vi.mocked(getAnalytics);
const mockFirebaseLogEvent = vi.mocked(firebaseLogEvent);

describe('analytics', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockGetAnalytics.mockReturnValue({} as never);
		// Fire idle callbacks immediately so logPageView doesn't wait for idle.
		vi.stubGlobal('requestIdleCallback', (cb: IdleRequestCallback) => {
			cb({ didTimeout: false, timeRemaining: () => 50 } as IdleDeadline);
			return 0;
		});
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('logPageView calls firebaseLogEvent with page_view', async () => {
		logPageView('/test-page', 'Test Page');

		await vi.waitFor(() => {
			expect(mockFirebaseLogEvent).toHaveBeenCalledWith(
				expect.anything(),
				'page_view',
				expect.objectContaining({
					page_path: '/test-page',
					page_title: 'Test Page',
				}),
			);
		});
		expect(mockGetAnalytics).toHaveBeenCalled();
	});

	it('logPageView uses defaults when args omitted', async () => {
		logPageView();

		await vi.waitFor(() => {
			expect(mockFirebaseLogEvent).toHaveBeenCalledWith(
				expect.anything(),
				'page_view',
				expect.objectContaining({
					page_path: expect.any(String),
					page_title: expect.any(String),
				}),
			);
		});
	});

	it('logEvent calls firebaseLogEvent with given event name', async () => {
		logEvent('cta_click', { button: 'contact' });

		await vi.waitFor(() => {
			expect(mockFirebaseLogEvent).toHaveBeenCalledWith(expect.anything(), 'cta_click', {
				button: 'contact',
			});
		});
	});

	it('logEvent works without params', async () => {
		logEvent('test_event');

		await vi.waitFor(() => {
			expect(mockFirebaseLogEvent).toHaveBeenCalledWith(expect.anything(), 'test_event', undefined);
		});
	});

	it('does not throw when analytics init fails', () => {
		mockGetAnalytics.mockImplementation(() => {
			throw new Error('Analytics not available');
		});

		expect(() => logPageView('/test', 'Test')).not.toThrow();
		expect(() => logEvent('test')).not.toThrow();
	});
});
