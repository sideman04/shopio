import { create } from 'zustand'

/**
 * Install-prompt state for the PWA.
 *
 * Chrome/Edge/Android fire `beforeinstallprompt` when the app becomes
 * installable. iOS Safari never fires it, and insecure origins (for example a
 * phone opening the dev server over a LAN IP) cannot register a service worker
 * at all, so the UI falls back to explicit instructions in those cases.
 */

export interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[]
  prompt: () => Promise<void>
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

const DISMISS_KEY = 'shopio:pwa-install-dismissed-until'
const DISMISS_MS = 7 * 24 * 60 * 60 * 1000

function isStandaloneMode(): boolean {
  if (typeof window === 'undefined') return false
  const navigatorWithStandalone = window.navigator as Navigator & { standalone?: boolean }
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: minimal-ui)').matches ||
    navigatorWithStandalone.standalone === true
  )
}

function isIosDevice(): boolean {
  if (typeof navigator === 'undefined') return false
  const iPadOs = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1
  return /iphone|ipad|ipod/i.test(navigator.userAgent) || iPadOs
}

function isDismissed(): boolean {
  try {
    const until = Number(window.localStorage.getItem(DISMISS_KEY) ?? 0)
    return Number.isFinite(until) && Date.now() < until
  } catch {
    return false
  }
}

interface InstallState {
  initialized: boolean
  canInstall: boolean
  isIos: boolean
  isStandalone: boolean
  isSecure: boolean
  visible: boolean
  deferredPrompt: BeforeInstallPromptEvent | null
  init: () => void
  show: () => void
  dismiss: () => void
  install: () => Promise<'accepted' | 'dismissed' | 'unavailable'>
}

let listenersAttached = false
let revealTimer: ReturnType<typeof setTimeout> | null = null

function clearRevealTimer() {
  if (revealTimer) {
    clearTimeout(revealTimer)
    revealTimer = null
  }
}

export const useInstallStore = create<InstallState>((set, get) => ({
  initialized: false,
  canInstall: false,
  isIos: false,
  isStandalone: false,
  isSecure: true,
  visible: false,
  deferredPrompt: null,

  init: () => {
    if (typeof window === 'undefined' || get().initialized) return

    const standalone = isStandaloneMode()
    const ios = isIosDevice()
    const secure = window.isSecureContext

    set({
      initialized: true,
      isStandalone: standalone,
      isIos: ios,
      isSecure: secure,
      visible: false,
    })

    if (standalone || isDismissed()) return

    if (!listenersAttached) {
      listenersAttached = true

      window.addEventListener('beforeinstallprompt', (event) => {
        event.preventDefault()
        clearRevealTimer()
        set({
          canInstall: true,
          deferredPrompt: event as BeforeInstallPromptEvent,
          visible: true,
        })
      })

      window.addEventListener('appinstalled', () => {
        clearRevealTimer()
        set({
          visible: false,
          canInstall: false,
          isStandalone: true,
          deferredPrompt: null,
        })
        try {
          window.localStorage.removeItem(DISMISS_KEY)
        } catch {
          /* Storage can be unavailable in private mode. */
        }
      })
    }

    // iOS and insecure origins never receive `beforeinstallprompt`. Show the
    // instructions after a short delay instead of waiting for that event.
    if (ios || !secure) {
      revealTimer = setTimeout(() => {
        if (!isDismissed() && !isStandaloneMode()) set({ visible: true })
      }, 3000)
    }
  },

  show: () => {
    if (get().isStandalone) return
    clearRevealTimer()
    set({ visible: true })
  },

  dismiss: () => {
    clearRevealTimer()
    try {
      window.localStorage.setItem(DISMISS_KEY, String(Date.now() + DISMISS_MS))
    } catch {
      /* Storage can be unavailable in private mode. */
    }
    set({ visible: false })
  },

  install: async () => {
    const prompt = get().deferredPrompt
    if (!prompt) return 'unavailable'

    try {
      await prompt.prompt()
      const choice = await prompt.userChoice
      set({ deferredPrompt: null, canInstall: false })

      if (choice.outcome === 'accepted') {
        set({ visible: false })
      } else {
        get().dismiss()
      }

      return choice.outcome
    } catch {
      return 'unavailable'
    }
  },
}))
