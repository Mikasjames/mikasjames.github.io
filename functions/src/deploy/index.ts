import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { triggerGitHubDispatch } from '../shared/github.js';
import { decideDeploy } from './decide.js';

export const deployOnPostChange = onDocumentWritten(
  {
    document: 'blogs/{docId}',
    secrets: ['GITHUB_PAT'],
  },
  async (event) => {
    try {
      const newStatus = event.data?.after?.data()?.status;
      const oldStatus = event.data?.before?.data()?.status;
      const deleted = !event.data?.after?.exists;

      const decision = decideDeploy(oldStatus, newStatus, deleted);
      console.log(decision.reason);
      if (!decision.trigger) return;

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
