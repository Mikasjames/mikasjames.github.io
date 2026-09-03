import { onMount } from 'svelte'
import { registerSW } from 'virtual:pwa-register'
import { initOnlineStatus } from '$lib/offline/store.svelte'

onMount(() => {
  const registration = registerSW({ immediate: true })

  // Initialize offline store
  initOnlineStatus()

  // Handle online/offline state changes
  window.addEventListener('online', () => {
    // Sync will be triggered when user clicks "Sync now" or via periodic check
  })

  window.addEventListener('offline', () => {
    // UI will show offline banner via +layout.svelte
  })
})