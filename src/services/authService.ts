import type { AuthSession, User } from '@/types'
import { useAuthStore, type RegisterInput } from '@/context/authStore'
import { api, errorMessage, setAuthToken } from './apiClient'
import { mapUser } from './mappers'

/**
 * Authentication service.
 *
 * Talks to the real `/auth` API. The server owns credentials, hashing, rate
 * limiting and session revocation; nothing here validates a password locally.
 * A successful sign-in sets an HttpOnly cookie *and* returns a short-lived
 * bearer token, which is kept in memory only.
 */

interface AuthPayload {
  user: User
  token?: string | null
  csrfToken?: string | null
  expiresAt?: string | null
  verificationRequired?: boolean
}

export interface LoginResult {
  session: AuthSession
  user: User
}

function applyAuthPayload(payload: AuthPayload): LoginResult {
  const user = mapUser(payload.user as unknown as Record<string, unknown>)
  setAuthToken(payload.token ?? null)
  useAuthStore.getState().setSession(user, payload.token ?? null, payload.expiresAt ?? null)
  const session = useAuthStore.getState().session
  if (!session) throw new Error('The server did not return a session.')
  return { session, user }
}

export async function login(email: string, password: string): Promise<LoginResult> {
  const store = useAuthStore.getState()
  store.setLoading(true)
  store.clearError()

  try {
    const response = await api.post<AuthPayload>('/auth/login', { email, password })
    return applyAuthPayload(response.data)
  } catch (error) {
    const message = errorMessage(error, 'Unable to sign in. Please try again.')
    useAuthStore.getState().setLoading(false)
    useAuthStore.getState().setError(message)
    throw error
  }
}

export async function register(input: RegisterInput) {
  const store = useAuthStore.getState()
  store.setLoading(true)
  store.clearError()

  try {
    const response = await api.post<AuthPayload>('/auth/register', {
      full_name: input.fullName,
      email: input.email,
      password: input.password,
      password_confirmation: input.passwordConfirmation,
      accept_terms: 1,
      phone: input.phone || null,
      store_name: input.storeName || null,
      business_category: input.businessCategory || null,
    })

    if (response.data?.user) {
      return applyAuthPayload(response.data)
    }

    // Registration succeeded but the account may require verification before a
    // session is issued. Return the user without pretending to be signed in.
    useAuthStore.getState().setLoading(false)
    return { user: mapUser(response.data?.user as unknown as Record<string, unknown>), session: null }
  } catch (error) {
    useAuthStore.getState().setLoading(false)
    useAuthStore.getState().setError(errorMessage(error, 'We could not create your account.'))
    throw error
  }
}

export async function logout() {
  try {
    await api.post<null>('/auth/logout')
  } catch {
    // The local session is cleared regardless: an expired cookie is already
    // unusable, and a network failure must not trap the user in the app.
  } finally {
    setAuthToken(null)
    useAuthStore.getState().clearSession()
  }
}

/** The server sets a readable CSRF cookie alongside the HttpOnly session. */
function hasSessionCookieHint(): boolean {
  if (typeof document === 'undefined') return false
  return document.cookie.split(';').some((part) => part.trim().startsWith('shopio_csrf='))
}

/** Restore the cookie-backed session at application boot. */
export async function me(): Promise<User | null> {
  // Anonymous visitors have no session cookie. Skipping the probe avoids a
  // needless 401 (and an offline request) on every first load.
  if (!hasSessionCookieHint()) {
    useAuthStore.getState().clearSession()
    useAuthStore.getState().markInitialized()
    return null
  }

  try {
    const response = await api.get<Record<string, unknown>>('/auth/me')
    const user = mapUser(response.data)
    const current = useAuthStore.getState().session
    useAuthStore.getState().setSession(user, current?.token ?? null, null)
    return user
  } catch {
    useAuthStore.getState().clearSession()
    return null
  } finally {
    useAuthStore.getState().markInitialized()
  }
}

export async function updateProfile(patch: { fullName?: string; phone?: string | null }): Promise<User> {
  const response = await api.patch<Record<string, unknown>>('/customers/profile', {
    full_name: patch.fullName,
    phone: patch.phone,
  })
  const user = mapUser(response.data)
  useAuthStore.getState().setUser(user)
  return user
}

export async function requestPasswordReset(email: string) {
  const response = await api.post<null>('/auth/forgot-password', { email })
  return { email, message: response.message }
}

export async function resetPassword(token: string, password: string, passwordConfirmation: string) {
  const response = await api.post<null>('/auth/reset-password', {
    token,
    password,
    password_confirmation: passwordConfirmation,
  })
  setAuthToken(null)
  useAuthStore.getState().clearSession()
  return { message: response.message }
}

export async function changePassword(
  currentPassword: string,
  password: string,
  passwordConfirmation: string,
) {
  const response = await api.post<null>('/auth/change-password', {
    current_password: currentPassword,
    password,
    password_confirmation: passwordConfirmation,
  })
  return { message: response.message }
}

export async function verifyEmail(token: string) {
  const response = await api.post<Record<string, unknown>>('/auth/verify-email', { token })
  return mapUser(response.data)
}

export async function resendVerification(email: string) {
  const response = await api.post<null>('/auth/resend-verification', { email })
  return { message: response.message }
}

export function currentUser() {
  return useAuthStore.getState().session?.user ?? null
}

export function isAuthenticated() {
  return useAuthStore.getState().isAuthenticated()
}
