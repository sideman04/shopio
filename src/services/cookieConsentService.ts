export const COOKIE_CONSENT_POLICY_VERSION = '2026-11-07'
export const COOKIE_CONSENT_STORAGE_KEY = 'shopio.cookie-consent'

export interface CookiePreferences {
  necessary: true
  functional: boolean
  analytics: boolean
  marketing: boolean
}

export type ConsentStatus = 'accepted' | 'rejected' | 'customized'

export interface CookieConsentRecord extends CookiePreferences {
  status: ConsentStatus
  timestamp: string
  policyVersion: string
}

export const DEFAULT_COOKIE_PREFERENCES: CookiePreferences = {
  necessary: true,
  functional: false,
  analytics: false,
  marketing: false,
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isConsentStatus(value: unknown): value is ConsentStatus {
  return value === 'accepted' || value === 'rejected' || value === 'customized'
}

export function readCookieConsent(): CookieConsentRecord | null {
  try {
    const stored = window.localStorage.getItem(COOKIE_CONSENT_STORAGE_KEY)
    if (!stored) return null

    const value: unknown = JSON.parse(stored)
    if (
      !isRecord(value) ||
      value.policyVersion !== COOKIE_CONSENT_POLICY_VERSION ||
      value.necessary !== true ||
      typeof value.functional !== 'boolean' ||
      typeof value.analytics !== 'boolean' ||
      typeof value.marketing !== 'boolean' ||
      !isConsentStatus(value.status) ||
      typeof value.timestamp !== 'string' ||
      !Number.isFinite(Date.parse(value.timestamp))
    ) {
      return null
    }

    return {
      necessary: true,
      functional: value.functional,
      analytics: value.analytics,
      marketing: value.marketing,
      status: value.status,
      timestamp: value.timestamp,
      policyVersion: COOKIE_CONSENT_POLICY_VERSION,
    }
  } catch {
    return null
  }
}

export function writeCookieConsent(
  preferences: CookiePreferences,
  status: ConsentStatus,
): CookieConsentRecord {
  const record: CookieConsentRecord = {
    necessary: true,
    functional: preferences.functional,
    analytics: preferences.analytics,
    marketing: preferences.marketing,
    status,
    timestamp: new Date().toISOString(),
    policyVersion: COOKIE_CONSENT_POLICY_VERSION,
  }

  window.localStorage.setItem(COOKIE_CONSENT_STORAGE_KEY, JSON.stringify(record))
  return record
}
