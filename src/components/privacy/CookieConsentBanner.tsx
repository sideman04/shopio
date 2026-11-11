import { Link } from 'react-router-dom'
import { Cookie } from 'lucide-react'
import { useCookieConsent } from '@/context/CookieConsentContext'

export function CookieConsentBanner() {
  const { consent, preferencesOpen, saveError, openPreferences, acceptAll, rejectOptional } = useCookieConsent()
  if (consent || preferencesOpen) return null

  return (
    <section
      role="dialog"
      aria-modal="false"
      aria-labelledby="cookie-consent-title"
      aria-describedby="cookie-consent-description"
      className="fixed inset-x-0 bottom-0 z-[80] border-t border-ink-200 bg-white px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-5 shadow-[0_-8px_32px_rgba(17,17,17,0.12)] animate-slide-up sm:inset-x-5 sm:bottom-5 sm:mx-auto sm:max-w-4xl sm:rounded-xl sm:border sm:p-6 sm:shadow-lift"
    >
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-sand-100 text-ink" aria-hidden="true">
          <Cookie className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 id="cookie-consent-title" className="text-base font-semibold tracking-tight text-ink sm:text-lg">
            Your Privacy Matters
          </h2>
          <p id="cookie-consent-description" className="mt-1.5 text-sm leading-relaxed text-ink-600">
            RAGIZE uses cookies to improve your shopping experience, understand how our website performs,
            and personalise content. Essential cookies are always on; you choose whether to allow optional
            cookies.
          </p>
          <p className="mt-2 text-xs text-ink-500">
            Read our{' '}
            <Link to="/privacy-policy" className="font-medium text-ink underline underline-offset-2 hover:text-ink-600">
              Privacy Policy
            </Link>{' '}
            and{' '}
            <Link to="/cookie-policy" className="font-medium text-ink underline underline-offset-2 hover:text-ink-600">
              Cookie Policy
            </Link>
            .
          </p>
        </div>
      </div>

      {saveError && (
        <p role="status" className="mt-3 rounded-lg bg-danger-50 px-3 py-2 text-xs text-danger-700">
          {saveError}
        </p>
      )}

      <div className="mt-5 grid gap-2 sm:grid-cols-3">
        <button
          type="button"
          onClick={acceptAll}
          className="min-h-11 rounded-lg bg-ink px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-ink-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2"
        >
          Accept all
        </button>
        <button
          type="button"
          onClick={rejectOptional}
          className="min-h-11 rounded-lg border border-ink-300 bg-white px-4 py-2.5 text-sm font-semibold text-ink transition-colors hover:border-ink hover:bg-ink-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2"
        >
          Reject optional cookies
        </button>
        <button
          type="button"
          onClick={openPreferences}
          className="min-h-11 rounded-lg px-4 py-2.5 text-sm font-semibold text-ink-600 transition-colors hover:bg-ink-50 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2"
        >
          Customize preferences
        </button>
      </div>
    </section>
  )
}
