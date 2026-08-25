import { render, screen } from '@testing-library/svelte';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import OljLoginPanel from './OljLoginPanel.svelte';

const getLatestOljLoginLog = vi.hoisted(() => vi.fn());
const callOljLoginNow = vi.hoisted(() => vi.fn());

vi.mock('$lib/firebase/olj', () => ({
	getLatestOljLoginLog,
	callOljLoginNow,
}));

vi.mock('$lib/stores/toast.svelte', () => ({
	toast: vi.fn(),
}));

import { createOljStore } from '$lib/firebase/olj.svelte';
import { flushSync } from 'svelte';

function makeLog(overrides: Record<string, unknown> = {}) {
	return {
		id: 'latest',
		date: '2026-08-25',
		status: 'success' as const,
		pointsBalance: 1250,
		previousBalance: 1000,
		ranAt: new Date('2026-08-25T02:00:00+08:00'),
		atCap: false,
		detail: null,
		debug: null,
		...overrides,
	};
}

async function renderPanelWith(log: Record<string, unknown> | null) {
	getLatestOljLoginLog.mockResolvedValue(log);
	const oljStore = createOljStore();
	await oljStore.loadLog();
	flushSync();
	return render(OljLoginPanel, { props: { oljStore } });
}

describe('OljLoginPanel', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('shows the empty state when there is no log', async () => {
		await renderPanelWith(null);
		expect(screen.getByText(/no login recorded yet/i)).toBeInTheDocument();
	});

	it('renders balance stats for a successful run', async () => {
		await renderPanelWith(makeLog());

		expect(screen.getByText('1250')).toBeInTheDocument();
		expect(screen.getByText('1000')).toBeInTheDocument();
		expect(screen.getByText('+250')).toBeInTheDocument();
		expect(screen.getByText(/success/i)).toBeInTheDocument();
		expect(screen.getByText(/run login now/i)).toBeInTheDocument();
	});

	it('shows failure detail and debug toggle on a failed run', async () => {
		await renderPanelWith(
			makeLog({
				status: 'failed',
				pointsBalance: null,
				detail: 'CAPTCHA enforced',
				debug: { authStatus: 200 },
			}),
		);

		expect(screen.getByText(/failed/i)).toBeInTheDocument();
		expect(screen.getByText('CAPTCHA enforced')).toBeInTheDocument();
		expect(screen.getByRole('button', { name: /show debug diagnostics/i })).toBeInTheDocument();
	});

	it('shows the at-cap badge when atCap is set', async () => {
		await renderPanelWith(makeLog({ pointsBalance: 60, previousBalance: 59, atCap: true }));

		expect(screen.getByText(/at cap — time to apply/i)).toBeInTheDocument();
	});
});
