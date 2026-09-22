import '@testing-library/jest-dom/vitest';
import '../utils/auth-mock';

// jsdom lacks the Web Animations API, which Svelte 5 transitions use.
// The stub must fire `onfinish` asynchronously: Svelte chains a zero-delay
// "dummy" animation into the main animation via `onfinish`, and only calls
// its `on_finish` (which removes the element on transition-out) from the
// main animation's `onfinish`. Never firing it would hang every outro.
if (!Element.prototype.animate) {
	Element.prototype.animate = ((_keyframes: unknown) => {
		const animation = {
			currentTime: 0,
			playState: 'running',
			effect: null as unknown,
			onfinish: null as (() => void) | null,
			finished: Promise.resolve(),
			cancel: () => {},
			finish: () => {},
		};
		queueMicrotask(() => {
			animation.onfinish?.();
		});
		return animation as unknown as Animation;
	}) as typeof Element.prototype.animate;
}

// jsdom lacks requestIdleCallback
if (!window.requestIdleCallback) {
	window.requestIdleCallback = (cb: IdleRequestCallback, _options?: IdleRequestOptions) => {
		const start = Date.now();
		return setTimeout(() => {
			cb({
				didTimeout: false,
				timeRemaining: () => Math.max(0, 50 - (Date.now() - start)),
			} as IdleDeadline);
		}, 0) as unknown as number;
	};
}
