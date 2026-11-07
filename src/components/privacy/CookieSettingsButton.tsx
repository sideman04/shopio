import { useCookieConsent } from '@/context/CookieConsentContext'

interface CookieSettingsButtonProps {
  className?: string
}

export function CookieSettingsButton({ className }: CookieSettingsButtonProps) {
  const { openPreferences } = useCookieConsent()

  return (
    <button
      type="button"
      onClick={openPreferences}
      className={className ?? 'rounded text-sm text-ink-500 transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/70'}
    >
      Cookie Settings
    </button>
  )
}
