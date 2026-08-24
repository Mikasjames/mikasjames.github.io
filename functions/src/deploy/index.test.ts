import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../shared/github.js', () => ({ triggerGitHubDispatch: vi.fn(async () => {}) }));

import { deployOnPostChange } from './index.js';
import { triggerGitHubDispatch } from '../shared/github.js';

const mockedDispatch = vi.mocked(triggerGitHubDispatch);
const run = (deployOnPostChange as unknown as { run: (event: unknown) => Promise<void> }).run;

const ENV_KEYS = ['GITHUB_PAT', 'GCLOUD_PROJECT', 'GITHUB_OWNER', 'GITHUB_REPO'] as const;
const originalEnv: Record<string, string | undefined> = Object.fromEntries(
	ENV_KEYS.map((k) => [k, process.env[k]]),
);

function event(beforeStatus?: string, afterStatus?: string) {
	return {
		id: 'evt-1',
		data: {
			before: { exists: beforeStatus !== undefined, data: () => ({ status: beforeStatus }) },
			after: {
				exists: true,
				data: () => (afterStatus === undefined ? undefined : { status: afterStatus }),
			},
		},
	};
}

function deletedEvent(beforeStatus?: string) {
	return {
		id: 'evt-2',
		data: {
			before: { exists: beforeStatus !== undefined, data: () => ({ status: beforeStatus }) },
			after: { exists: false, data: () => undefined },
		},
	};
}

function setFullEnv() {
	process.env.GITHUB_PAT = 'pat-123';
	process.env.GCLOUD_PROJECT = 'proj';
	process.env.GITHUB_OWNER = 'octo';
	process.env.GITHUB_REPO = 'repo';
}

beforeEach(() => {
	mockedDispatch.mockClear();
	for (const k of ENV_KEYS) delete process.env[k];
});

describe('deployOnPostChange handler', () => {
	it('skips drafts without touching env vars or dispatching', async () => {
		await run(event('draft', 'draft'));
		expect(mockedDispatch).not.toHaveBeenCalled();
	});

	it('dispatches for a live-status change when all env vars are set', async () => {
		setFullEnv();
		await run(event('published', 'unlisted'));

		expect(mockedDispatch).toHaveBeenCalledTimes(1);
		expect(mockedDispatch).toHaveBeenCalledWith('pat-123', 'octo', 'repo');
	});

	it('triggers on deletion even from a live status', async () => {
		setFullEnv();
		await run(deletedEvent('published'));
		expect(mockedDispatch).toHaveBeenCalledTimes(1);
	});

	it('validates env guards in order: PAT -> project -> owner/repo', async () => {
		process.env.GCLOUD_PROJECT = 'proj';
		process.env.GITHUB_OWNER = 'octo';
		process.env.GITHUB_REPO = 'repo';
		await expect(run(event('draft', 'published'))).rejects.toThrow(
			'GITHUB_PAT environment variable not set',
		);

		process.env.GITHUB_PAT = 'pat';
		delete process.env.GCLOUD_PROJECT;
		await expect(run(event('draft', 'published'))).rejects.toThrow(
			'GCLOUD_PROJECT environment variable not set',
		);

		process.env.GCLOUD_PROJECT = 'proj';
		delete process.env.GITHUB_OWNER;
		await expect(run(event('draft', 'published'))).rejects.toThrow(
			'GITHUB_OWNER or GITHUB_REPO environment variable not set',
		);

		process.env.GITHUB_OWNER = 'octo';
		await run(event('draft', 'published'));
		expect(mockedDispatch).toHaveBeenCalledTimes(1);
	});

	it('propagates dispatch failures', async () => {
		setFullEnv();
		mockedDispatch.mockRejectedValueOnce(new Error('GitHub down'));
		await expect(run(event('draft', 'published'))).rejects.toThrow('GitHub down');
	});
});
