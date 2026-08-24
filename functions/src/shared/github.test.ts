import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { triggerGitHubDispatch } from './github.js';

const OK = (status: number, statusText = '') =>
	new Response(null, { status, statusText });

beforeEach(() => {
	vi.useFakeTimers();
});

afterEach(() => {
	vi.useRealTimers();
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
});

// Responses are described as values, not pre-built promises: creating
// Promise.reject() eagerly triggers unhandled-rejection detection before
// the code under test ever awaits them.
type QueuedResponse = Response | Error;

function stubFetchQueue(responses: QueuedResponse[]) {
	const fetchMock = vi.fn();
	for (const r of responses) {
		fetchMock.mockImplementationOnce(() =>
			r instanceof Error ? Promise.reject(r) : Promise.resolve(r),
		);
	}
	vi.stubGlobal('fetch', fetchMock);
	return fetchMock;
}

describe('triggerGitHubDispatch', () => {
	it('posts to the repo dispatches endpoint with the expected headers and body', async () => {
		const fetchMock = stubFetchQueue([OK(204)]);
		const promise = triggerGitHubDispatch('tok-1', 'octo', 'repo');
		await vi.runAllTimersAsync();
		await promise;

		expect(fetchMock).toHaveBeenCalledTimes(1);
		const [url, init] = fetchMock.mock.calls[0];
		expect(url).toBe('https://api.github.com/repos/octo/repo/dispatches');
		expect(init.method).toBe('POST');
		expect(init.headers).toEqual({
			Authorization: 'Bearer tok-1',
			'X-GitHub-Api-Version': '2022-11-28',
			Accept: 'application/vnd.github.v3+json',
		});
		expect(JSON.parse(init.body)).toEqual({ event_type: 'deploy-blog' });
	});

	it('returns immediately on success without retrying', async () => {
		const fetchMock = stubFetchQueue([OK(204)]);
		await vi.runAllTimersAsync();
		await expect(triggerGitHubDispatch('t', 'o', 'r')).resolves.toBeUndefined();
		expect(fetchMock).toHaveBeenCalledTimes(1);
	});

	it('retries on 429 with linear backoff and then succeeds', async () => {
		const fetchMock = stubFetchQueue([
			OK(429, 'Too Many Requests'),
			OK(204),
		]);
		const promise = triggerGitHubDispatch('t', 'o', 'r');

		await vi.advanceTimersByTimeAsync(0);
		expect(fetchMock).toHaveBeenCalledTimes(1);

		await vi.runAllTimersAsync();
		await promise;
		expect(fetchMock).toHaveBeenCalledTimes(2);
	});

	it('exhausts retries on persistent 500s and throws the last API error', async () => {
		const fetchMock = stubFetchQueue([
			OK(500, 'Internal Server Error'),
			OK(502, 'Bad Gateway'),
			OK(503, 'Service Unavailable'),
		]);
		const promise = triggerGitHubDispatch('t', 'o', 'r');
		const expectation = expect(promise).rejects.toThrow(
			'GitHub API error: 503 Service Unavailable',
		);

		await vi.runAllTimersAsync();
		await expectation;
		expect(fetchMock).toHaveBeenCalledTimes(3);
	});

	it('fails fast on non-retryable statuses like 403', async () => {
		const fetchMock = stubFetchQueue([OK(403, 'Forbidden')]);
		const promise = triggerGitHubDispatch('t', 'o', 'r');
		const expectation = expect(promise).rejects.toThrow(
			'GitHub API error: 403 Forbidden',
		);

		await vi.runAllTimersAsync();
		await expectation;
		expect(fetchMock).toHaveBeenCalledTimes(1);
	});

	it('maps AbortError rejections onto a timeout message across attempts', async () => {
		const abort = new Error('The operation was aborted');
		abort.name = 'AbortError';
		const fetchMock = stubFetchQueue([
			abort,
			abort,
			abort,
		]);

		const captured = triggerGitHubDispatch('t', 'o', 'r').then(
			() => null,
			(err) => err,
		);
		await vi.runAllTimersAsync();
		const err = (await captured) as Error;

		expect(fetchMock).toHaveBeenCalledTimes(3);
		expect(err.message).toBe('GitHub API timeout after 10 seconds (attempt 3)');
	});

	it('re-throws non-abort network errors verbatim after exhausting retries', async () => {
		stubFetchQueue([
			new TypeError('fetch failed'),
			new TypeError('fetch failed'),
			new TypeError('fetch failed'),
		]);

		const captured = triggerGitHubDispatch('t', 'o', 'r').then(
			() => null,
			(err) => err,
		);
		await vi.runAllTimersAsync();
		const err = (await captured) as Error;

		expect(err).toBeInstanceOf(TypeError);
		expect(err.message).toBe('fetch failed');
	});
});
