import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { defineConfig } from 'vitest/config';

const root = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
	plugins: [svelte()],
	resolve: {
		alias: {
			$lib: resolve(root, './src/lib'),
			'$env/static/public': resolve(root, './tests/unit/stubs/env-static-public.ts'),
			'$env/dynamic/public': resolve(root, './tests/unit/stubs/env-dynamic-public.ts')
		},
		conditions: ['browser']
	},
	test: {
		environment: 'jsdom',
		globals: true,
		setupFiles: ['./tests/unit/setup.ts'],
		include: ['src/**/*.test.ts', 'tests/unit/**/*.test.ts']
	}
});
