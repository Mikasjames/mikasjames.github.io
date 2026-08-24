import { createTimeoutSignal, sleep } from './util.js';

export async function triggerGitHubDispatch(
  token: string,
  owner: string,
  repo: string,
): Promise<void> {
  const maxAttempts = 3;
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const timeout = createTimeoutSignal(10_000);

    try {
      const response = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/dispatches`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'X-GitHub-Api-Version': '2022-11-28',
            Accept: 'application/vnd.github.v3+json',
          },
          body: JSON.stringify({ event_type: 'deploy-blog' }),
          signal: timeout.signal,
        },
      );

      timeout.cancel();

      if (response.ok) return;

      lastError = new Error(`GitHub API error: ${response.status} ${response.statusText}`);
      const shouldRetry = response.status === 429 || response.status >= 500;
      if (!shouldRetry || attempt === maxAttempts) break;

      await sleep(1000 * attempt);
    } catch (error) {
      timeout.cancel();

      if ((error as Error).name === 'AbortError') {
        lastError = new Error(`GitHub API timeout after 10 seconds (attempt ${attempt})`);
      } else {
        lastError = error as Error;
      }

      if (attempt < maxAttempts) {
        await sleep(1000 * attempt);
      } else {
        break;
      }
    }
  }

  throw lastError ?? new Error('GitHub API error: dispatch failed');
}
