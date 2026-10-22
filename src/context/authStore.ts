import { create } from 'zustand'
import type { AuthSession, RoleCode, User } from '@/types'
import { api, onUnauthorized, setAuthToken } from '@/services/apiClient'
import { useAccountStore } from './accountStore'
import { useCartStore } from './cartStore'
import { useOrderStore } from './orderStore'
import { usePeopleStore } from './peopleStore'
import { useSystemStore } from './systemStore'
import { useWishlistStore } from './wishlistStore'

/**
 * Authentication store.
 *
 * The authoritative session lives in an HttpOnly cookie managed by the PHP API.
 * This store only mirrors the current user for rendering and route guards. The
 * bearer token is held in memory by `apiClient` and is never written to
 * localStorage or sessionStorage.
 */

interface AuthState {
  session: AuthSession | null
  /** Role currently being exercised (a user may hold several roles). */
  actingRole: RoleCode | null
  loading: boolean
  error: string | null
  /** True once the cookie session has been checked at boot. */
  initialized: boolean
  setSession: (user: User, token?: string | null, expiresAt?: string | null) => void
  setUser: (user: User) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  clearSession: () => void
  logout: () => Promise<void>
  switchRole: (role: RoleCode) => void
  updateProfile: (patch: Partial<User>) => void
  clearError: () => void
  markInitialized: () => void
  isAuthenticated: () => boolean
}

export interface RegisterInput {
  fullName: string
  email: string
  password: string
  passwordConfirmation: string
  acceptTerms: boolean
  phone?: string
  /** Optional — when present the backend also creates a seller store. */
  storeName?: string
  businessCategory?: string
}

const DEFAULT_TTL = 1000 * 60 * 60 * 8

function expiresToMs(value: string | null | undefined): number {
  if (!value) return Date.now() + DEFAULT_TTL
  const parsed = Date.parse(value)
  return Number.isFinite(parsed) ? parsed : Date.now() + DEFAULT_TTL
}

export const useAuthStore = create<AuthState>((set, get) => ({
  session: null,
  actingRole: null,
  loading: false,
  error: null,
  initialized: false,

  setSession(user, token = null, expiresAt = null) {
    set({
      session: {
        user,
        token: token ?? '',
        expiresAt: expiresToMs(expiresAt),
      },
      actingRole: user.roles[0] ?? null,
      loading: false,
      error: null,
    })
  },

  setUser(user) {
    const { session } = get()
    if (!session) return
    set({ session: { ...session, user }, actingRole: get().actingRole ?? user.roles[0] ?? null })
  },

  setLoading(loading) {
    set({ loading })
  },

  setError(error) {
    set({ error })
  },

  clearSession() {
    set({ session: null, actingRole: null, loading: false, error: null })
  },

  async logout() {
    try {
      await api.post<null>('/auth/logout')
    } catch {
      // An expired cookie is already unusable; never trap the user in the app.
    } finally {
      setAuthToken(null)
      set({ session: null, actingRole: null, loading: false, error: null })
      useCartStore.getState().clear()
      useWishlistStore.getState().clear()
      useAccountStore.getState().setAddresses([])
      useSystemStore.getState().setNotifications([])
      useOrderStore.getState().setOrders([])
      usePeopleStore.getState().setSellers([])
    }
  },

  switchRole(role) {
    const { session } = get()
    if (!session?.user.roles.includes(role)) return
    set({ actingRole: role })
  },

  updateProfile(patch) {
    const { session } = get()
    if (!session) return
    set({ session: { ...session, user: { ...session.user, ...patch } } })
  },

  clearError() {
    set({ error: null })
  },

  markInitialized() {
    set({ initialized: true })
  },

  isAuthenticated() {
    return get().session !== null
  },
}))

// A 401 from any protected endpoint means the server-side session expired or was
// revoked. Drop the mirrored session so the UI can redirect to sign-in.
onUnauthorized(() => {
  useAuthStore.getState().clearSession()
})

/* -------------------------------------------------------------------------- */
/* Selectors & helpers                                                         */
/* -------------------------------------------------------------------------- */

export function useCurrentUser() {
  return useAuthStore((s) => s.session?.user ?? null)
}

/** The role the user is currently acting as (defaults to their first role). */
export function useActiveRole(): RoleCode | null {
  return useAuthStore((s) => s.actingRole ?? s.session?.user.roles[0] ?? null)
}

export function useIsAuthenticated() {
  return useAuthStore((s) => !!s.session)
}

/** Landing route for a given role after login. */
export function homeRouteForRole(role: RoleCode | null) {
  switch (role) {
    case 'admin':
      return '/admin'
    case 'seller':
      return '/seller/dashboard'
    case 'customer':
      return '/account'
    default:
      return '/'
  }
}

/** Seller profile id attached to the signed-in account, if any. */
export function useActingSellerId() {
  return useAuthStore((s) => s.session?.user.sellerId ?? null)
}
