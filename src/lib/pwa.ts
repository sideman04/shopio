/**
 * Registers the Shopio service worker.
 *
 * Production builds cache the app shell and static assets for offline use.
 * Development registers the same worker with `?dev=1`, which stays
 * network-only: the app remains installable on localhost without stale
 * caches interfering with Vite's hot module replacement.
 */
export function registerServiceWorker(): void {
  if (!('serviceWorker' in navigator)) {
    return
  }

  if (!window.isSecureContext) {
    console.warn(
      '[Shopio PWA] Service workers require HTTPS or localhost. Install prompts are unavailable on this origin.',
    )
    return
  }

  const register = () => {
    const swUrl = import.meta.env.DEV ? '/sw.js?dev=1' : '/sw.js'

    navigator.serviceWorker
      .register(swUrl, { scope: '/' })
      .then((registration) => {
        console.info('[Shopio PWA] Service worker registered:', registration.scope)

        registration.addEventListener('updatefound', () => {
          const installing = registration.installing
          if (!installing) return

          installing.addEventListener('statechange', () => {
            if (installing.state === 'installed' && navigator.serviceWorker.controller) {
              console.info('[Shopio PWA] A new version is ready. Reload to update.')
            }
          })
        })
      })
      .catch((error: unknown) => {
        console.error('[Shopio PWA] Service worker registration failed:', error)
      })
  }

  if (document.readyState === 'complete') {
    register()
  } else {
    window.addEventListener('load', register, { once: true })
  }
}
