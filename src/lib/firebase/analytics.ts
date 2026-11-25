import { browser } from '$app/environment';
import type { Analytics } from 'firebase/analytics';

type AnalyticsSdk = typeof import('firebase/analytics');

let analytics: Analytics | null = null;
let sdk: AnalyticsSdk | null = null;
let initPromise: Promise<Analytics | null> | null = null;

async function init(): Promise<Analytics | null> {
	if (!browser) return null;
	if (analytics) return analytics;
	if (!initPromise) {
		initPromise = (async () => {
			try {
				const [analyticsSdk, firebase] = await Promise.all([
					import('firebase/analytics'),
					import('./firebase'),
				]);
				sdk = analyticsSdk;
				analytics = analyticsSdk.getAnalytics(firebase.default);
				return analytics;
			} catch {
				return null;
			}
		})();
	}
	return initPromise;
}

function whenIdle(run: () => void) {
	if (typeof window === 'undefined') return;
	if ('requestIdleCallback' in window) {
		window.requestIdleCallback(run, { timeout: 3000 });
	} else {
		setTimeout(run, 2000);
	}
}

async function send(eventName: string, params?: Record<string, string | number | boolean>) {
	const instance = await init();
	if (!instance || !sdk) return;
	sdk.logEvent(instance, eventName, params);
}

export function logPageView(pagePath?: string, pageTitle?: string) {
	if (!browser) return;
	const params = {
		page_path: pagePath ?? window.location.pathname,
		page_title: pageTitle ?? document.title,
	};
	whenIdle(() => {
		void send('page_view', params);
	});
}

export function logEvent(
	eventName: string,
	eventParams?: Record<string, string | number | boolean>,
) {
	if (!browser) return;
	// Clicks shouldn't wait for idle, but the SDK still loads on demand.
	void send(eventName, eventParams);
}
