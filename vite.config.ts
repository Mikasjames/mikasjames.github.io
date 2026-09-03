import { sveltekit } from '@sveltejs/kit/vite';
import { SvelteKitPWA } from '@vite-pwa/sveltekit';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [
		tailwindcss(),
		sveltekit(),
		SvelteKitPWA({
			registerType: 'autoUpdate',
			scope: '/',
			start_url: '/admin/',
			display: 'standalone',
			theme_color: '#09090b',
			background_color: '#09090b',
			icons: [
				{
					src: '/icons/icon-192x192.png',
					sizes: '192x192',
					type: 'image/png'
				},
				{
					src: '/icons/icon-512x512.png',
					sizes: '512x512',
					type: 'image/png',
					purpose: 'any maskable'
				}
			],
			workbox: {
				globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
				navigateFallback: undefined
			},
			devOptions: {
				enabled: false
			}
		})
	]
});
