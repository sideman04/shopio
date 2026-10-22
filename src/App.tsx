import { useEffect } from 'react'
import { BrowserRouter } from 'react-router-dom'
import { AppRoutes } from '@/app/router'
import { bootstrap } from '@/app/bootstrap'
import { InstallPrompt } from '@/components/pwa/InstallPrompt'
import { NetworkStatus } from '@/components/pwa/NetworkStatus'
import { useAuthStore } from '@/context/authStore'

/**
 * Application root. Bootstrap restores the cookie session and warms the public
 * catalogue before routes render, so pages never flash an empty state.
 */
export default function App() {
  const initialized = useAuthStore((s) => s.initialized)

  useEffect(() => {
    void bootstrap()
  }, [])

  if (!initialized) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white">
        <div className="text-center">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-ink-200 border-t-ink" />
          <p className="mt-4 text-sm text-ink-500">Loading Shopio…</p>
        </div>
      </div>
    )
  }

  return (
    <BrowserRouter>
      <NetworkStatus />
      <AppRoutes />
      <InstallPrompt />
    </BrowserRouter>
  )
}
