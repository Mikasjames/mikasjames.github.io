import { onMount } from 'svelte'
import { registerSW } from 'virtual:pwa-register'

onMount(() => {
  const registration = registerSW({ immediate: true })

  // Handle online/offline state changes - sync queue on reconnect
  window.addEventListener('online', () => {
    // Sync will be triggered when user clicks "Sync now" or via periodic check
    // No automatic queue processing to avoid race conditions
  })

  window.addEventListener('offline', () => {
    // UI will show offline banner via +layout.svelte
  })
})