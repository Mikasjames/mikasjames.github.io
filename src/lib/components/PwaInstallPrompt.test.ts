import { render } from '@testing-library/svelte';
import { describe, expect, it, vi } from 'vitest';
import PwaInstallPrompt from './PwaInstallPrompt.svelte';

describe('PwaInstallPrompt', () => {
	it('renders nothing by default (no install prompt event)', () => {
		vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: false }));
		const { container } = render(PwaInstallPrompt);
		expect(container.querySelector('[role="dialog"]')).toBeNull();
		vi.unstubAllGlobals();
	});

	it('renders nothing when standalone (already installed)', () => {
		vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: true }));
		const { container } = render(PwaInstallPrompt);
		expect(container.querySelector('[role="dialog"]')).toBeNull();
		vi.unstubAllGlobals();
	});

	it('does not show prompt when on iOS', () => {
		vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: false }));
		vi.stubGlobal('navigator', {
			...navigator,
			userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X)',
		});
		const { container } = render(PwaInstallPrompt);
		expect(container.querySelector('[role="dialog"]')).toBeNull();
		vi.unstubAllGlobals();
	});

	it('does not show prompt on non-PWA routes', () => {
		vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: false }));
		const { container } = render(PwaInstallPrompt);
		expect(container.querySelector('[role="dialog"]')).toBeNull();
		vi.unstubAllGlobals();
	});
});
