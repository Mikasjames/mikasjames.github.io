import '@testing-library/jest-dom/vitest';
import '../utils/auth-mock';

// jsdom lacks the Web Animations API, which Svelte 5 transitions use.
if (!Element.prototype.animate) {
	Element.prototype.animate = (() =>
		({
			cancel: () => {},
			finished: Promise.resolve()
		}) as unknown as Animation) as never;
}

// jsdom lacks requestIdleCallback
if (!window.requestIdleCallback) {
	window.requestIdleCallback = (cb: IdleRequestCallback, options?: IdleRequestOptions) => {
		const start = Date.now();
		return setTimeout(() => {
			cb({
				didTimeout: false,
				timeRemaining: () => Math.max(0, 50 - (Date.now() - start)),
			} as IdleDeadline);
		}, 0) as unknown as number;
	};
}
