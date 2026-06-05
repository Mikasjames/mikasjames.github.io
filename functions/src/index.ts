import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { SecretManagerServiceClient } from '@google-cloud/secret-manager';
import { initializeApp } from 'firebase-admin/app';

initializeApp();

const secretManager = new SecretManagerServiceClient();

async function getGitHubToken(projectId: string): Promise<string> {
  const secretName = `projects/${projectId}/secrets/github-pat/versions/latest`;
  const [version] = await secretManager.accessSecretVersion({ name: secretName });
  return version.payload?.data?.toString() || '';
}

async function triggerGitHubDispatch(
  token: string,
  owner: string,
  repo: string,
): Promise<void> {
  const response = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/dispatches`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'X-GitHub-Api-Version': '2022-11-28',
        Accept: 'application/vnd.github.v3+json',
      },
      body: JSON.stringify({
        event_type: 'deploy-blog',
      }),
    },
  );

  if (!response.ok) {
    throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
  }
}

export const deployOnPostChange = onDocumentWritten(
  {
    document: 'posts/{docId}',
    secrets: ['GITHUB_PAT'],
  },
  async (event) => {
    try {
      const token = process.env.GITHUB_PAT;
      const githubOwner = process.env.GITHUB_OWNER;
      const githubRepo = process.env.GITHUB_REPO;
      const projectId = process.env.GCLOUD_PROJECT;

      if (!token) {
        throw new Error('GITHUB_PAT environment variable not set');
      }
      if (!projectId) {
        throw new Error('GCLOUD_PROJECT environment variable not set');
      }

      
      if (!githubOwner || !githubRepo) {
        throw new Error('GITHUB_OWNER or GITHUB_REPO environment variable not set');
      }

      await triggerGitHubDispatch(token, githubOwner, githubRepo);

      console.log('Repository dispatch triggered successfully');
    } catch (error) {
      console.error('Error triggering deployment:', error);
      throw error;
    }
  },
);
