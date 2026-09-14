import { vi, describe, it, expect, beforeEach } from 'vitest';

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
	});

	it('logPageView calls firebaseLogEvent with page_view', () => {
		logPageView('/test-page', 'Test Page');

		expect(mockGetAnalytics).toHaveBeenCalled();
		expect(mockFirebaseLogEvent).toHaveBeenCalledWith(
			expect.anything(),
			'page_view',
			expect.objectContaining({
				page_path: '/test-page',
				page_title: 'Test Page',
			}),
		);
	});

	it('logPageView uses defaults when args omitted', () => {
		logPageView();

		expect(mockFirebaseLogEvent).toHaveBeenCalledWith(
			expect.anything(),
			'page_view',
			expect.objectContaining({
				page_path: expect.any(String),
				page_title: expect.any(String),
			}),
		);
	});

	it('logEvent calls firebaseLogEvent with given event name', () => {
		logEvent('cta_click', { button: 'contact' });

		expect(mockFirebaseLogEvent).toHaveBeenCalledWith(
			expect.anything(),
			'cta_click',
			{ button: 'contact' },
		);
	});

	it('logEvent works without params', () => {
		logEvent('test_event');

		expect(mockFirebaseLogEvent).toHaveBeenCalledWith(
			expect.anything(),
			'test_event',
			undefined,
		);
	});

	it('does not throw when analytics init fails', () => {
		mockGetAnalytics.mockImplementation(() => {
			throw new Error('Analytics not available');
		});

		expect(() => logPageView('/test', 'Test')).not.toThrow();
		expect(() => logEvent('test')).not.toThrow();
	});
});
