import { defineConfig } from 'vitest/config';

// Own config so vitest never walks up and inherits the SvelteKit app's
// root configuration (aliases/jsdom/setup do not apply to this package).
export default defineConfig({
	test: {
		environment: 'node',
		globals: false,
		include: ['src/**/*.test.ts']
	}
});
