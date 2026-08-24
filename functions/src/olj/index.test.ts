import { beforeEach, describe, expect, it, vi } from 'vitest';

const httpMocks = vi.hoisted(() => ({
	oljFollowRedirects: vi.fn(),
	extractOljCsrfToken: vi.fn(),
	isCloudflareChallenge: vi.fn(),
	extractErrorSnippet: vi.fn(),
	classifyOljLoginFailure: vi.fn(),
	extractApplyPoints: vi.fn(),
}));

vi.mock('./http.js', () => ({
	OLJ_BASE_URL: 'https://www.onlinejobs.test',
	OLJ_V2_BASE_URL: 'https://v2.onlinejobs.test',
	oljFollowRedirects: httpMocks.oljFollowRedirects,
	extractOljCsrfToken: httpMocks.extractOljCsrfToken,
	isCloudflareChallenge: httpMocks.isCloudflareChallenge,
	extractErrorSnippet: httpMocks.extractErrorSnippet,
	classifyOljLoginFailure: httpMocks.classifyOljLoginFailure,
	extractApplyPoints: httpMocks.extractApplyPoints,
}));

const dbSpies = vi.hoisted(() => ({ collection: vi.fn() }));
vi.mock('../firebase.js', () => ({
	db: {
		collection: (...args: unknown[]) => dbSpies.collection(...args),
	},
}));

import { Timestamp } from 'firebase-admin/firestore';
import { recordOljLogin, runOljLogin } from './index.js';

type RedirectResult = { status: number; body: string; finalUrl: string; hops: string[] };

function redirect(status: number, body: string, finalUrl = 'https://www.onlinejobs.test/x'): RedirectResult {
	return { status, body, finalUrl, hops: [] };
}

beforeEach(() => {
	for (const m of Object.values(httpMocks)) m.mockReset();
	dbSpies.collection.mockReset();
	process.env.OLJ_EMAIL = 'me@test.local';
	process.env.OLJ_PASSWORD = 'hunter2';
	httpMocks.isCloudflareChallenge.mockReturnValue(false);
	vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('runOljLogin', () => {
	it('throws when credentials are missing', async () => {
		delete process.env.OLJ_PASSWORD;
		await expect(runOljLogin()).rejects.toThrow(
			'OLJ_EMAIL or OLJ_PASSWORD secret is not set',
		);
		expect(httpMocks.oljFollowRedirects).not.toHaveBeenCalled();
	});

	it('throws when Cloudflare challenges the login page', async () => {
		httpMocks.oljFollowRedirects.mockResolvedValueOnce(redirect(403, 'challenge'));
		httpMocks.isCloudflareChallenge.mockReturnValueOnce(true);

		await expect(runOljLogin()).rejects.toThrow(/Cloudflare challenged the login page/);
	});

	it('throws when the login page is not reachable', async () => {
		httpMocks.oljFollowRedirects.mockResolvedValueOnce(redirect(500, ''));

		await expect(runOljLogin()).rejects.toThrow('Login page unreachable (status 500)');
	});

	it('throws when the CSRF token cannot be found', async () => {
		httpMocks.oljFollowRedirects.mockResolvedValueOnce(redirect(200, '<html></html>'));
		httpMocks.extractOljCsrfToken.mockReturnValueOnce(null);

		await expect(runOljLogin()).rejects.toThrow('CSRF token not found on login page');
	});

	it('submits credentials with the csrf token and reports classified failure', async () => {
		const loginPage = redirect(200, '<form>login</form>', `${'https://www.onlinejobs.test'}/login`);
		httpMocks.oljFollowRedirects
			.mockResolvedValueOnce(loginPage)
			.mockResolvedValueOnce(
				redirect(
					200,
					'<input name="info[email]"><input name="info[password]">',
					'https://www.onlinejobs.test/login',
				),
			);
		httpMocks.extractOljCsrfToken.mockReturnValueOnce('csrf-1');
		httpMocks.classifyOljLoginFailure.mockReturnValueOnce('Bad credentials rejected by OnlineJobs.ph');
		httpMocks.extractErrorSnippet.mockReturnValueOnce(
			'{"access_token":"SECRET"} invalid password',
		);

		const result = await runOljLogin();

		expect(result.ok).toBe(false);
		expect(result.detail).toBe('Bad credentials rejected by OnlineJobs.ph');
		expect(result.debug?.authStatus).toBe(200);
		expect(result.debug?.snippet).toContain('"access_token":"[redacted]"');

		const [, , authOpts] = httpMocks.oljFollowRedirects.mock.calls[1];
		const body = new URLSearchParams((authOpts as { body: string }).body);
		expect(httpMocks.oljFollowRedirects.mock.calls[1][1]).toBe(
			'https://www.onlinejobs.test/authenticate',
		);
		expect(body.get('csrf-token')).toBe('csrf-1');
		expect(body.get('info[email]')).toBe('me@test.local');
		expect(body.get('info[password]')).toBe('hunter2');
	});

	it('authenticates and extracts the points balance from the dashboard', async () => {
		httpMocks.oljFollowRedirects
			.mockResolvedValueOnce(redirect(200, '<meta name="csrf-token" content="t">'))
			.mockResolvedValueOnce(redirect(200, '', 'https://v2.onlinejobs.test/dashboard'))
			.mockResolvedValueOnce(redirect(200, '"applyPoints": "1,250"'));
		httpMocks.extractOljCsrfToken.mockReturnValueOnce('t');
		httpMocks.extractApplyPoints.mockReturnValueOnce(1250);

		const result = await runOljLogin();

		expect(result).toMatchObject({
			ok: true,
			pointsBalance: 1250,
			detail: 'Authenticated (ssr:/api/redirects/to-account-dashboard)',
		});
		expect(httpMocks.oljFollowRedirects.mock.calls[2][1]).toBe(
			'https://v2.onlinejobs.test/api/redirects/to-account-dashboard',
		);
	});

	it('still authenticates when the dashboard probe crashes, recording the attempt', async () => {
		httpMocks.oljFollowRedirects
			.mockResolvedValueOnce(redirect(200, '<html/>'))
			.mockResolvedValueOnce(redirect(200, '', '/dash'))
			.mockRejectedValueOnce(new Error('"access_token":"LEAKED" exploded'));
		httpMocks.extractOljCsrfToken.mockReturnValueOnce('t');
		httpMocks.extractApplyPoints.mockReturnValue(null);

		const result = await runOljLogin();

		expect(result.ok).toBe(true);
		expect(result.pointsBalance).toBeNull();
		expect(result.detail).toBe('Authenticated (balance not located)');
		expect(result.debug?.balanceSource).toBeNull();
		expect(result.debug?.ssrAttempts?.[0]).toEqual({
			url: '/api/redirects/to-account-dashboard',
			status: null,
			finalUrl: '"access_token":"[redacted]" exploded',
		});
	});
});

describe('recordOljLogin', () => {
	function makeChain(previous?: { pointsBalance: number }) {
		const state = {
			docId: '',
			set: vi.fn(async () => {}),
		};
		const query = {
			where: () => query,
			orderBy: () => query,
			limit: () => query,
			get: async () => ({
				docs: previous ? [{ data: () => ({ pointsBalance: previous.pointsBalance }) }] : [],
			}),
			doc: (id: string) => {
				state.docId = id;
				return { set: state.set };
			},
		};
		return Object.assign(query, { state });
	}

	it('records success with previous balance and Manila date key', async () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date(Date.UTC(2026, 7, 23, 18, 0, 0))); // Aug 24, 02:00 Manila
		const chain = makeChain({ pointsBalance: 1000 });
		dbSpies.collection.mockReturnValue(chain);

		await recordOljLogin({ ok: true, pointsBalance: 1250, detail: 'Authenticated (x)' });

		expect(dbSpies.collection).toHaveBeenCalledWith('oljLoginLogs');
		expect(chain.state.docId).toBe('2026-08-24');
		const [payload] = chain.state.set.mock.calls[0];
		expect(payload).toMatchObject({
			date: '2026-08-24',
			status: 'success',
			pointsBalance: 1250,
			previousBalance: 1000,
		});
		expect((payload as Record<string, unknown>).ranAt).toBeInstanceOf(Timestamp);
		expect((payload as Record<string, unknown>).detail).toBeUndefined();
		vi.useRealTimers();
	});

	it('includes detail and debug for failed logins', async () => {
		const chain = makeChain();
		dbSpies.collection.mockReturnValue(chain);

		await recordOljLogin({
			ok: false,
			pointsBalance: null,
			detail: 'CAPTCHA appears to be enforced — automated login blocked',
			debug: { authStatus: 200 },
		});

		const [payload] = chain.state.set.mock.calls[0];
		expect(chain.state.docId).toMatch(/^\d{4}-\d{2}-\d{2}$/);
		expect(payload.status).toBe('failed');
		expect(payload.previousBalance).toBeNull();
		expect(payload.detail).toContain('CAPTCHA');
		expect(payload.debug).toEqual({ authStatus: 200 });
	});
});
