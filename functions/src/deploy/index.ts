import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { triggerGitHubDispatch } from '../shared/github.js';

export const deployOnPostChange = onDocumentWritten(
  {
    document: 'blogs/{docId}',
    secrets: ['GITHUB_PAT'],
  },
  async (event) => {
    try {
      const newStatus = event.data?.after?.data()?.status;
      const oldStatus = event.data?.before?.data()?.status;

      const isLive = (status?: string) => status === 'published' || status === 'unlisted';

      const wasLive = isLive(oldStatus);
      const isNowLive = isLive(newStatus);

      if (!event.data?.after?.exists) {
        console.log('Post deleted — triggering deploy to remove from site');
      } else if (!wasLive && !isNowLive) {
        console.log('Post is a draft — skipping deploy');
        return;
      } else if (wasLive && !isNowLive) {
        console.log('Post moved to draft — triggering deploy to remove from site');
      } else {
        console.log(`Post status is "${newStatus}" — triggering deploy`);
      }

      const token = process.env.GITHUB_PAT;
      const githubOwner = process.env.GITHUB_OWNER;
      const githubRepo = process.env.GITHUB_REPO;
      const projectId = process.env.GCLOUD_PROJECT;

      if (!token) throw new Error('GITHUB_PAT environment variable not set');
      if (!projectId) throw new Error('GCLOUD_PROJECT environment variable not set');
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
