import { useEffect } from 'react'
import { Download, Lock, Share, X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { useInstallStore } from '@/context/installStore'

/**
 * Small, dismissible install banner.
 *
 * Android/Chrome show a native install sheet through `beforeinstallprompt`.
 * iOS and insecure origins (such as opening the dev server over a phone's LAN
 * IP) cannot use that event, so the banner shows the appropriate steps instead.
 */
export function InstallPrompt() {
  const initialized = useInstallStore((s) => s.initialized)
  const visible = useInstallStore((s) => s.visible)
  const canInstall = useInstallStore((s) => s.canInstall)
  const isIos = useInstallStore((s) => s.isIos)
  const isSecure = useInstallStore((s) => s.isSecure)
  const init = useInstallStore((s) => s.init)
  const dismiss = useInstallStore((s) => s.dismiss)
  const install = useInstallStore((s) => s.install)

  useEffect(() => {
    init()
  }, [init])

  if (!initialized || !visible) return null

  const description = !isSecure ? (
    <>
      Installation needs a secure connection. Open Shopio over <strong>HTTPS</strong> on your phone,
      then add it to your home screen.
    </>
  ) : isIos ? (
    <>
      Tap <Share className="inline h-3.5 w-3.5 align-[-2px]" aria-hidden="true" /> in Safari, then
      choose <strong>Add to Home Screen</strong>.
    </>
  ) : canInstall ? (
    <>Add Shopio to your home screen for faster access and offline browsing.</>
  ) : (
    <>Open your browser menu and choose “Install app” or “Add to Home Screen”.</>
  )

  const useNativePrompt = canInstall && isSecure && !isIos

  return (
    <div
      className="fixed inset-x-3 z-[85] sm:inset-x-auto sm:right-4 sm:w-[380px]"
      style={{ bottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
    >
      <div
        role="region"
        aria-label="Install Shopio"
        aria-live="polite"
        className="relative flex items-start gap-3 rounded-xl border border-ink-200 bg-white p-4 pr-10 shadow-lift animate-slide-up"
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-ink text-white">
          {isSecure ? (
            <Download className="h-5 w-5" aria-hidden="true" />
          ) : (
            <Lock className="h-5 w-5" aria-hidden="true" />
          )}
        </span>

        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-ink">Install Shopio</p>
          <p className="mt-1 text-xs leading-relaxed text-ink-500">{description}</p>

          <div className="mt-3 flex items-center gap-2">
            {useNativePrompt ? (
              <>
                <Button size="sm" onClick={() => void install()}>
                  <Download className="h-3.5 w-3.5" aria-hidden="true" />
                  Install app
                </Button>
                <Button size="sm" variant="ghost" onClick={dismiss}>
                  Not now
                </Button>
              </>
            ) : (
              <Button size="sm" variant="secondary" onClick={dismiss}>
                Got it
              </Button>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss install prompt"
          className="absolute right-2 top-2 rounded p-1.5 text-ink-400 transition hover:bg-ink-100 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/70"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  )
}
