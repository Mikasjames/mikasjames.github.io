import '@testing-library/jest-dom/vitest';

// jsdom lacks the Web Animations API, which Svelte 5 transitions use.
if (!Element.prototype.animate) {
	Element.prototype.animate = (() =>
		({
			cancel: () => {},
			finished: Promise.resolve()
		}) as unknown as Animation) as never;
}
