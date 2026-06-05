// Firebase Functions Setup Instructions

## Prerequisites
- Firebase CLI: `npm install -g firebase-tools`
- Google Cloud CLI: https://cloud.google.com/sdk/docs/install
- Node 20+

## Setup Steps

1. **Create GitHub Personal Access Token (PAT)**
   - Go to https://github.com/settings/tokens
   - Create a new token with `repo` (or `public_repo` for public repos) scope
   - Copy the token

2. **Store Token in Firebase Secret Manager**
   ```bash
   echo "YOUR_GITHUB_PAT_HERE" | gcloud secrets create github-pat --data-file=-
   ```
   Or add to existing secret:
   ```bash
   gcloud secrets versions add github-pat --data-file=-
   ```

3. **Set Firebase Project**
   ```bash
   firebase use YOUR_FIREBASE_PROJECT_ID
   ```

4. **Update Environment Variables**
   Edit `functions/.env.yaml`:
   ```yaml
   deployOnPostChange.GITHUB_OWNER: your-github-username
   deployOnPostChange.GITHUB_REPO: your-repo-name
   ```

5. **Install Dependencies**
   ```bash
   cd functions
   npm install
   cd ..
   ```

6. **Deploy**
   ```bash
   firebase deploy --only functions
   ```

## How It Works

- When a Firestore document is created/updated/deleted in the `posts` collection
- The Cloud Function triggers and reads the GitHub PAT from Secret Manager
- It sends an authenticated HTTP request to GitHub's Repository Dispatch API
- This triggers the `deploy-blog` event
- GitHub Actions workflow listens for this event and builds/deploys the site

## Testing

Emulate locally:
```bash
npm run serve --prefix functions
```

Trigger manually via Firestore console or CLI:
```bash
firebase firestore:set posts/test-post --data '{"title":"Test","content":"test"}'
```

## Troubleshooting

- Check Cloud Functions logs: `firebase functions:log`
- Verify Secret Manager access: `gcloud secrets versions access latest --secret="github-pat"`
- Ensure function has Secret Manager Secret Accessor role
- Verify GitHub PAT has correct scopes and hasn't expired
