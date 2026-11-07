import { CookieConsentBanner } from './CookieConsentBanner'
import { CookiePreferenceModal } from './CookiePreferenceModal'
import { useCookieConsent } from '@/context/CookieConsentContext'

export function CookieConsentManager() {
  const { saveError } = useCookieConsent()

  return (
    <>
      <CookieConsentBanner />
      <CookiePreferenceModal />
      {saveError && (
        <p
          role="status"
          className="fixed bottom-4 right-4 z-[90] max-w-sm rounded-lg border border-danger-100 bg-white px-4 py-3 text-sm text-danger-700 shadow-card"
        >
          {saveError}
        </p>
      )}
    </>
  )
}
