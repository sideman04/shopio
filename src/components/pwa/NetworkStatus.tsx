import { useEffect, useState } from 'react'
import { RefreshCw, WifiOff } from 'lucide-react'

/**
 * Slim global offline indicator.
 *
 * Public catalogue pages keep working from the service-worker cache, so the
 * user needs a clear signal that prices/stock may be stale and that checkout,
 * cart and account actions require a connection.
 */
export function NetworkStatus() {
  const [online, setOnline] = useState(() =>
    typeof navigator === 'undefined' ? true : navigator.onLine,
  )

  useEffect(() => {
    const handleOnline = () => setOnline(true)
    const handleOffline = () => setOnline(false)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  if (online) return null

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-x-0 top-0 z-[95] flex items-center justify-center gap-2 bg-ink px-3 py-2 text-xs font-medium text-white"
      style={{ paddingTop: 'max(0.5rem, env(safe-area-inset-top))' }}
    >
      <WifiOff className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span className="truncate">
        You’re offline — showing saved catalogue content.
      </span>
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="inline-flex shrink-0 items-center gap-1 rounded-full border border-white/25 px-2 py-0.5 text-[11px] font-semibold transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
      >
        <RefreshCw className="h-3 w-3" aria-hidden="true" />
        Retry
      </button>
    </div>
  )
}
