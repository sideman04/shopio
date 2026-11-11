import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { api } from '@/services/apiClient'
import { LOCAL_DEMO } from '@/services/localDemo'
import {
  COOKIE_CONSENT_POLICY_VERSION,
  DEFAULT_COOKIE_PREFERENCES,
  readCookieConsent,
  writeCookieConsent,
  type ConsentStatus,
  type CookieConsentRecord,
  type CookiePreferences,
} from '@/services/cookieConsentService'

type OptionalCookieCategory = Exclude<keyof CookiePreferences, 'necessary'>

interface CookieConsentContextValue {
  consent: CookieConsentRecord | null
  preferences: CookiePreferences
  preferencesOpen: boolean
  saveError: string | null
  hasConsent: (category: keyof CookiePreferences) => boolean
  openPreferences: () => void
  closePreferences: () => void
  updatePreference: (category: OptionalCookieCategory, enabled: boolean) => void
  acceptAll: () => void
  rejectOptional: () => void
  savePreferences: () => void
}

const CookieConsentContext = createContext<CookieConsentContextValue | null>(null)

function preferencesFromConsent(consent: CookieConsentRecord | null): CookiePreferences {
  if (!consent) return DEFAULT_COOKIE_PREFERENCES
  return {
    necessary: true,
    functional: consent.functional,
    analytics: consent.analytics,
    marketing: consent.marketing,
  }
}

function saveStatus(preferences: CookiePreferences): ConsentStatus {
  if (preferences.functional && preferences.analytics && preferences.marketing) return 'accepted'
  if (!preferences.functional && !preferences.analytics && !preferences.marketing) return 'rejected'
  return 'customized'
}

export function CookieConsentProvider({ children }: { children: React.ReactNode }) {
  const [consent, setConsent] = useState<CookieConsentRecord | null>(() => readCookieConsent())
  const [preferences, setPreferences] = useState<CookiePreferences>(() =>
    preferencesFromConsent(readCookieConsent()),
  )
  const [preferencesOpen, setPreferencesOpen] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key !== 'shopio.cookie-consent' && event.key !== null) return
      const current = readCookieConsent()
      setConsent(current)
      setPreferences(preferencesFromConsent(current))
    }

    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const openPreferences = useCallback(() => {
    setPreferences(preferencesFromConsent(readCookieConsent()))
    setSaveError(null)
    setPreferencesOpen(true)
  }, [])

  const closePreferences = useCallback(() => {
    setPreferencesOpen(false)
  }, [])

  const updatePreference = useCallback((category: OptionalCookieCategory, enabled: boolean) => {
    setPreferences((current) => ({ ...current, [category]: enabled }))
  }, [])

  const save = useCallback((next: CookiePreferences, status: ConsentStatus) => {
    try {
      const record = writeCookieConsent(next, status)
      setConsent(record)
      setPreferences(preferencesFromConsent(record))
      setSaveError(null)
      setPreferencesOpen(false)

      if (!LOCAL_DEMO) {
        void api
          .post('/cookie-consents', {
            necessary: true,
            functional: record.functional,
            analytics: record.analytics,
            marketing: record.marketing,
            consent_status: record.status,
            policy_version: COOKIE_CONSENT_POLICY_VERSION,
          })
          .catch((error: unknown) => {
            console.error('Unable to sync cookie preferences with RAGIZE.', error)
            setSaveError('Your preferences are saved on this device, but could not be synced to RAGIZE.')
          })
      }
    } catch (error) {
      console.error('Unable to save cookie preferences in this browser.', error)
      setSaveError('We could not save your preferences. Please check your browser storage settings and try again.')
    }
  }, [])

  const acceptAll = useCallback(() => {
    save({ necessary: true, functional: true, analytics: true, marketing: true }, 'accepted')
  }, [save])

  const rejectOptional = useCallback(() => {
    save(DEFAULT_COOKIE_PREFERENCES, 'rejected')
  }, [save])

  const savePreferences = useCallback(() => {
    save(preferences, saveStatus(preferences))
  }, [preferences, save])

  const hasConsent = useCallback(
    (category: keyof CookiePreferences) => {
      if (category === 'necessary') return true
      return consent?.[category] === true
    },
    [consent],
  )

  const value = useMemo<CookieConsentContextValue>(
    () => ({
      consent,
      preferences,
      preferencesOpen,
      saveError,
      hasConsent,
      openPreferences,
      closePreferences,
      updatePreference,
      acceptAll,
      rejectOptional,
      savePreferences,
    }),
    [
      consent,
      preferences,
      preferencesOpen,
      saveError,
      hasConsent,
      openPreferences,
      closePreferences,
      updatePreference,
      acceptAll,
      rejectOptional,
      savePreferences,
    ],
  )

  return <CookieConsentContext.Provider value={value}>{children}</CookieConsentContext.Provider>
}

export function useCookieConsent() {
  const context = useContext(CookieConsentContext)
  if (!context) throw new Error('useCookieConsent must be used within CookieConsentProvider')
  return context
}
