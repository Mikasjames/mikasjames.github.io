# mikasjames.com

Personal portfolio and blog built with [SvelteKit](https://svelte.dev/docs/kit), powered by a Firebase-backed CMS with admin dashboard, analytics, and automated CI/CD deploying to GitHub Pages.

## Tech Stack

| Layer          | Technology                                                                  |
| -------------- | --------------------------------------------------------------------------- |
| Framework      | [SvelteKit 2](https://svelte.dev/docs/kit) (runes mode)                     |
| Language       | [TypeScript](https://www.typescriptlang.org/)                               |
| Styling        | [Tailwind CSS v4](https://tailwindcss.com/)                                 |
| CMS / Database | [Firebase Firestore](https://firebase.google.com/products/firestore)        |
| Auth           | [Firebase Auth](https://firebase.google.com/products/auth) (email/password) |
| Storage        | [Firebase Storage](https://firebase.google.com/products/storage)            |
| Analytics      | [Firebase Analytics](https://firebase.google.com/products/analytics)        |
| Functions      | [Firebase Cloud Functions](https://firebase.google.com/products/functions)  |
| Adapter        | [`@sveltejs/adapter-static`](https://svelte.dev/docs/kit/adapter-static)    |
| Hosting        | [GitHub Pages](https://pages.github.com/)                                   |
| CI/CD          | [GitHub Actions](https://github.com/features/actions)                       |
| Testing        | [Playwright](https://playwright.dev/)                                       |
| Fonts          | Inter Variable, JetBrains Mono                                              |

## Features

- **Portfolio** — Project showcase with live demos, tech stacks, and feature highlights
- **Blog** — Full CRUD blog with Firestore-backed content, draft system, markdown rendering, reading time estimates
- **Admin Dashboard** — Authenticated CMS for creating, editing, and publishing blog posts and journal entries
- **SEO** — Dynamic OG meta tags, auto-generated sitemap, robots.txt, canonical URLs
- **Performance** — Static prerendering, hover preloads, optimized fonts, lazy-loaded images with placeholders
- **PWA-ready** — Offline-capable architecture via service worker
- **Dark mode** — System-preference-aware dark theme with grid background
- **Analytics** — Firebase-powered page view and event tracking
- **Media** — Image compression on upload, markdown-compatible media embedding

## Getting Started

### Prerequisites

- Node.js 20+
- A Firebase project with Firestore, Auth (email/password), Storage, and Analytics enabled
- Firebase Admin SDK private key (for Cloud Functions)

### Setup

```bash
# Clone the repo
git clone https://github.com/mikasjames/mikasjames.github.io.git
cd mikasjames.github.io

# Install dependencies
pnpm install

# Set up environment variables
cp .env.example .env
# Fill in your Firebase config values (see Firebase Console → Project Settings → General → Your apps → Web app)
```

### Environment Variables

| Variable                              | Description                                            |
| ------------------------------------- | ------------------------------------------------------ |
| `PUBLIC_SITE_URL`                     | Canonical site URL (default: `https://mikasjames.com`) |
| `PUBLIC_FIREBASE_API_KEY`             | Firebase Web API key                                   |
| `PUBLIC_FIREBASE_AUTH_DOMAIN`         | Firebase Auth domain                                   |
| `PUBLIC_FIREBASE_PROJECT_ID`          | Firebase project ID                                    |
| `PUBLIC_FIREBASE_STORAGE_BUCKET`      | Firebase Storage bucket                                |
| `PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | Firebase messaging sender ID                           |
| `PUBLIC_FIREBASE_APP_ID`              | Firebase app ID                                        |
| `PUBLIC_FIREBASE_MEASUREMENT_ID`      | Firebase measurement ID                                |

### Development

```bash
pnpm run dev
# or open in browser
pnpm run dev -- --open
```

### Build

```bash
pnpm run build
pnpm run preview   # preview the production build locally
```

### Run Tests

```bash
pnpm run test            # App and Cloud Function unit tests
pnpm run test:app        # SvelteKit/Vitest unit tests
pnpm run test:coverage   # Unit tests with coverage thresholds
pnpm run test:functions  # Cloud Function tests
pnpm run test:e2e        # Playwright end-to-end tests
```

### Code Quality

```bash
pnpm run check         # Type-check with svelte-check
pnpm run check:watch   # Watch mode
pnpm run format        # Format with Prettier
pnpm run format:check  # Verify formatting without writing
```

## Project Structure

```
src/
├── app.html               # HTML shell
├── app.css                # Global styles
├── app.d.ts               # Type declarations
├── lib/
│   ├── components/        # Reusable Svelte components
│   ├── firebase/          # Firebase client (Firestore, Auth, Storage, Analytics)
│   ├── stores/            # Svelte stores (toast notifications)
│   ├── utils/             # Utilities (date formatting, markdown rendering, image meta, media)
│   ├── assets/            # Static assets (favicon SVG)
│   ├── site.ts            # Site configuration
│   └── index.ts           # Barrel exports
├── routes/
│   ├── +layout.svelte     # Root layout (loader, nav, footer, page transitions)
│   ├── +layout.js         # Layout load function
│   ├── +page.svelte       # Home page (portfolio)
│   ├── +error.svelte      # Error page
│   ├── blogs/
│   │   ├── +page.svelte   # Blog listing
│   │   ├── +page.server.ts # Blog list data loader
│   │   ├── [slug]/
│   │   │   ├── +page.svelte     # Blog post page
│   │   │   └── +page.server.ts  # Blog post data loader
│   │   └── drafts/
│   │       ├── +page.svelte     # Drafts listing
│   │       ├── +page.js         # Drafts loader
│   │       └── [slug]/
│   │           ├── +page.svelte # Draft editor
│   │           └── +page.js     # Draft loader
│   ├── journal/
│   │   ├── +page.svelte   # Journal entries
│   │   └── +page.js       # Journal loader
│   ├── admin/
│   │   ├── +page.svelte   # Admin dashboard
│   │   ├── +page.js       # Admin loader
│   │   ├── login/
│   │   │   ├── +page.svelte # Login page
│   │   │   └── +page.js     # Login loader
│   │   ├── BlogPostForm.svelte   # Blog post editor form
│   │   ├── JournalEntryForm.svelte # Journal entry form
│   │   ├── EntryList.svelte      # List management
│   │   └── InsightsDashboard.svelte # Insights dashboard
│   ├── sitemap.xml/
│   │   └── +server.ts     # Dynamic sitemap generation
│   └── robots.txt/
│       └── +server.ts     # robots.txt generation
functions/
├── src/
│   ├── deploy/            # Blog rebuild dispatch
│   ├── insights/          # Habit and journal insight generation
│   └── olj/               # Online journal endpoints
└── .env                   # Firebase Admin SDK credentials
tests/
├── e2e/                   # Playwright specs
└── unit/                  # Vitest route and utility tests
.github/workflows/
├── ci.yml                 # Pull request quality checks
└── deploy.yml             # Build and GitHub Pages deployment
```

## Deployment

The site is deployed to **GitHub Pages** via GitHub Actions. Every pull request runs the `CI` workflow (formatting, type checking, unit tests with coverage, Cloud Function tests, the production build, and Playwright). On every push to `main` (or via `repository_dispatch` / manual trigger), the `Deploy to GitHub Pages` workflow:

1. Installs dependencies (`pnpm install --frozen-lockfile`)
2. Builds the site with full Firebase environment variables from repository secrets
3. Uploads the `build/` directory as a Pages artifact
4. Deploys the artifact to GitHub Pages

### Manual Deployment

Push to `main`:

```bash
git push origin main
```

Or trigger from the Actions tab in GitHub.

## License

The code under this repository is licensed under the [MIT License](LICENSE).

However, all personal content, project copy, writing, images, and branding assets are reserved under copyright and may not be used, republished, or redistributed without explicit permission. Feel free to use the underlying SvelteKit engine, CMS setup, and GitHub Actions pipelines for your own projects!
