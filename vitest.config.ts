import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { defineConfig } from 'vitest/config';

const root = fileURLToPath(new URL('.', import.meta.url));

const CRITICAL_PATHS = [
	'src/lib/utils/admin-session.ts',
	'src/lib/components/AdminNav.svelte',
	'src/lib/components/BlogPostContent.svelte',
	'src/routes/blogs/drafts/[slug]/+page.svelte',
];

export default defineConfig({
	plugins: [svelte()],
	resolve: {
		alias: {
			$lib: resolve(root, './src/lib'),
			$app: resolve(root, './tests/unit/stubs/app'),
			'$env/static/public': resolve(root, './tests/unit/stubs/env-static-public.ts'),
			'$env/dynamic/public': resolve(root, './tests/unit/stubs/env-dynamic-public.ts')
		},
		conditions: ['browser']
	},
	test: {
		environment: 'jsdom',
		globals: true,
		setupFiles: ['./tests/unit/setup.ts'],
		include: ['src/**/*.test.ts', 'tests/unit/**/*.test.ts'],
		coverage: {
			provider: 'v8',
			reporter: ['text', 'json', 'html'],
			thresholds: {
				lines: 80,
				branches: 75,
				functions: 80,
				statements: 80,
			},
			thresholdsAutoUpdate: false,
		},
	},
});
