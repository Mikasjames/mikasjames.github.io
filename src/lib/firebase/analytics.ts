import { browser } from '$app/environment';
import { getAnalytics, logEvent as firebaseLogEvent, type Analytics } from 'firebase/analytics';
import { PUBLIC_FIREBASE_MEASUREMENT_ID } from '$env/static/public';
import app from './firebase';

let analytics: Analytics | null = null;

function init(): Analytics | null {
	if (!browser) return null;
	if (!PUBLIC_FIREBASE_MEASUREMENT_ID) return null;
	if (analytics) return analytics;
	try {
		analytics = getAnalytics(app);
		return analytics;
	} catch {
		return null;
	}
}

export function logPageView(pagePath?: string, pageTitle?: string) {
	const instance = init();
	if (!instance) return;
	firebaseLogEvent(instance, 'page_view', {
		page_path: pagePath ?? window.location.pathname,
		page_title: pageTitle ?? document.title
	});
}

export function logEvent(eventName: string, eventParams?: Record<string, string | number | boolean>) {
	const instance = init();
	if (!instance) return;
	firebaseLogEvent(instance, eventName, eventParams);
}
