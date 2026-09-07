<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { page } from '$app/stores';
	import { pwaPromptRoutes } from '$lib/utils/pwa';

	let deferredPrompt: BeforeInstallPromptEvent | null = null;
	let showPrompt = $state(false);
	let isInstalled = $state(false);
	let isIOS = $state(false);

	function isStandalone() {
		if (typeof window === 'undefined') return false;
		return window.matchMedia('(display-mode: standalone)').matches
			|| (window.navigator as any).standalone === true;
	}

	function checkIOS() {
		if (typeof window === 'undefined') return false;
		return /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
	}

	function shouldShowForCurrentRoute() {
		const pathname = $page.url.pathname;
		return pwaPromptRoutes.some((route) => pathname.startsWith(route));
	}

	function handleBeforeInstallPrompt(e: Event) {
		e.preventDefault();
		deferredPrompt = e as BeforeInstallPromptEvent;
		if (!isInstalled && shouldShowForCurrentRoute()) {
			showPrompt = true;
		}
	}

	function handleAppInstalled() {
		isInstalled = true;
		showPrompt = false;
		deferredPrompt = null;
	}

	async function handleInstall() {
		if (!deferredPrompt) return;
		deferredPrompt.prompt();
		const { outcome } = await deferredPrompt.userChoice;
		if (outcome === 'accepted') {
			showPrompt = false;
			deferredPrompt = null;
		}
	}

	function handleDismiss() {
		showPrompt = false;
	}

	onMount(() => {
		if (typeof window === 'undefined') return;

		isInstalled = isStandalone();
		isIOS = checkIOS();

		window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
		window.addEventListener('appinstalled', handleAppInstalled);

		if (isInstalled || isIOS) {
			showPrompt = false;
		} else if (shouldShowForCurrentRoute()) {
			const savedDismiss = localStorage.getItem('pwa-install-dismissed');
			const savedDate = localStorage.getItem('pwa-install-dismissed-date');
			const today = new Date().toDateString();

			if (savedDismiss === 'true' && savedDate === today) {
				showPrompt = false;
			} else {
				showPrompt = true;
			}
		}

		return () => {
			window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
			window.removeEventListener('appinstalled', handleAppInstalled);
		};
	});

	$effect(() => {
		if (shouldShowForCurrentRoute() && deferredPrompt && !isInstalled && !isIOS) {
			const savedDismiss = localStorage.getItem('pwa-install-dismissed');
			const savedDate = localStorage.getItem('pwa-install-dismissed-date');
			const today = new Date().toDateString();

			if (savedDismiss !== 'true' || savedDate !== today) {
				showPrompt = true;
			}
		} else {
			showPrompt = false;
		}
	});
</script>

{#if showPrompt && !isInstalled && !isIOS}
<div
	class="fixed bottom-4 left-4 right-4 md:bottom-6 md:left-6 md:right-6 md:max-w-md z-50 animate-slide-up"
	role="dialog"
	aria-label="Install app prompt"
>
	<div class="bg-zinc-900/95 backdrop-blur-md border border-zinc-800 rounded-xl p-4 shadow-2xl shadow-black/40">
		<div class="flex items-start gap-3">
			<div class="flex-shrink-0 w-10 h-10 rounded-lg bg-accent-500/20 border border-accent-500/30 flex items-center justify-center">
				<svg class="w-5 h-5 text-accent-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
				</svg>
			</div>
			<div class="flex-1 min-w-0">
				<p class="text-sm font-semibold text-zinc-100">Install Mikas James App</p>
				<p class="text-xs text-zinc-400 mt-0.5">Add to home screen for quick access to Habits, Journal, and Admin.</p>
			</div>
			<div class="flex items-center gap-2">
				<button
					onclick={handleInstall}
					class="px-3 py-1.5 text-xs font-medium text-white bg-accent-500 rounded-lg hover:bg-accent-600 transition-colors"
				>
					Install
				</button>
				<button
					onclick={() => {
						localStorage.setItem('pwa-install-dismissed', 'true');
						localStorage.setItem('pwa-install-dismissed-date', new Date().toDateString());
						handleDismiss();
					}}
					class="p-1.5 text-zinc-500 hover:text-zinc-300 transition-colors"
					aria-label="Dismiss"
				>
					<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
					</svg>
				</button>
			</div>
		</div>
	</div>
</div>
{/if}

<style>
	@keyframes slide-up {
		from {
			opacity: 0;
			transform: translateY(20px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}
	.animate-slide-up {
		animation: slide-up 0.3s ease-out;
	}
</style>