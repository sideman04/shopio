/**
 * Shopio API client.
 *
 * Every network call in the storefront, seller workspace and admin console goes
 * through this module. It targets the versioned PHP API (`/api/v1`) and speaks
 * the documented response envelope:
 *
 *   success: { success: true,  message, data, meta }
 *   failure: { success: false, message, errors, request_id }
 *
 * Authentication is cookie-first: the PHP API sets an HttpOnly session cookie
 * and a readable `shopio_csrf` cookie. Unsafe cookie-authenticated writes carry
 * the CSRF token in `X-CSRF-Token` (double-submit). The bearer token returned by
 * login/registration is kept in memory only — never in localStorage — and is
 * sent as `Authorization: Bearer …` when present. Tokens are never persisted.
 */

export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? '/api/v1').replace(/\/$/, '')

export type QueryValue = string | number | boolean | null | undefined | Array<string | number>

export interface RequestOptions extends Omit<RequestInit, 'body' | 'method'> {
  query?: Record<string, QueryValue>
  body?: unknown
  /** Skip attaching the bearer token (public catalogue reads). */
  anonymous?: boolean
  /** Request timeout in milliseconds (default 30s). */
  timeout?: number
}

export interface PaginationMeta {
  total: number
  page: number
  per_page: number
  total_pages: number
  has_more: boolean
}

export interface ApiMeta {
  pagination?: PaginationMeta
  [key: string]: unknown
}

export interface ApiEnvelope<T> {
  success: boolean
  message: string
  data: T
  meta: ApiMeta
  request_id?: string
}

export class ApiError extends Error {
  readonly status: number
  readonly errors: Record<string, string[]>
  readonly requestId: string | null
  readonly payload: unknown

  constructor(
    message: string,
    status: number,
    errors: Record<string, string[]> = {},
    requestId: string | null = null,
    payload: unknown = null,
  ) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.errors = errors
    this.requestId = requestId
    this.payload = payload
  }

  /** First validation message, useful for inline form feedback. */
  get firstError(): string | null {
    for (const messages of Object.values(this.errors)) {
      if (messages.length > 0) return messages[0]
    }
    return null
  }
}

/* -------------------------------------------------------------------------- */
/* Session token (memory only)                                                 */
/* -------------------------------------------------------------------------- */

let authToken: string | null = null
let unauthorizedHandler: (() => void) | null = null

export function setAuthToken(token: string | null): void {
  authToken = token
}

export function getAuthToken(): string | null {
  return authToken
}

/** Register the session-expiry handler (called by the auth store). */
export function onUnauthorized(handler: (() => void) | null): void {
  unauthorizedHandler = handler
}

/* -------------------------------------------------------------------------- */
/* Helpers                                                                     */
/* -------------------------------------------------------------------------- */

function readCookie(name: string): string | null {
  if (typeof document === 'undefined') return null
  const prefix = `${name}=`
  for (const part of document.cookie.split(';')) {
    const entry = part.trim()
    if (entry.startsWith(prefix)) {
      return decodeURIComponent(entry.slice(prefix.length))
    }
  }
  return null
}

function buildQuery(query: Record<string, QueryValue> | undefined): string {
  if (!query) return ''
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null) continue
    if (Array.isArray(value)) {
      value.forEach((item) => params.append(`${key}[]`, String(item)))
    } else {
      params.append(key, String(value))
    }
  }
  const encoded = params.toString()
  return encoded ? `?${encoded}` : ''
}

function isUnsafe(method: string): boolean {
  return !['GET', 'HEAD', 'OPTIONS'].includes(method.toUpperCase())
}

function isAuthEndpoint(path: string): boolean {
  return /^\/auth\/(login|register)/.test(path)
}

async function request<T>(
  method: string,
  path: string,
  options: RequestOptions = {},
): Promise<ApiEnvelope<T>> {
  const headers = new Headers(options.headers)
  const methodUpper = method.toUpperCase()

  if (!headers.has('Accept')) headers.set('Accept', 'application/json')

  const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData
  if (options.body !== undefined && !isFormData && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }

  if (!options.anonymous && authToken) {
    headers.set('Authorization', `Bearer ${authToken}`)
  }

  if (isUnsafe(method) && !headers.has('X-CSRF-Token')) {
    const csrf = readCookie('shopio_csrf')
    if (csrf) headers.set('X-CSRF-Token', csrf)
  }

  const controller = new AbortController()
  const timeout = options.timeout ?? 30_000
  const timer = setTimeout(() => controller.abort(), timeout)
  const externalSignal = options.signal
  if (externalSignal) {
    if (externalSignal.aborted) controller.abort()
    else externalSignal.addEventListener('abort', () => controller.abort(), { once: true })
  }

  let response: Response
  try {
    response = await fetch(`${API_BASE_URL}${path}${buildQuery(options.query)}`, {
      ...options,
      method: methodUpper,
      headers,
      credentials: 'include',
      signal: controller.signal,
      body:
        options.body === undefined
          ? undefined
          : isFormData
            ? (options.body as FormData)
            : JSON.stringify(options.body),
    })
  } catch (error) {
    clearTimeout(timer)
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new ApiError('The request timed out. Please try again.', 0)
    }
    throw new ApiError(
      'We could not reach Shopio. Check your connection and try again.',
      0,
      {},
      null,
      error,
    )
  } finally {
    clearTimeout(timer)
  }

  const requestId = response.headers.get('x-request-id')
  const contentType = response.headers.get('content-type') ?? ''
  const payload: unknown = contentType.includes('application/json')
    ? await response.json().catch(() => null)
    : await response.text().catch(() => null)

  if (!response.ok) {
    const body = (payload ?? {}) as {
      message?: unknown
      errors?: unknown
      request_id?: unknown
    }
    const errors =
      body.errors && typeof body.errors === 'object'
        ? (body.errors as Record<string, string[]>)
        : {}
    const message =
      typeof body.message === 'string' && body.message.trim() !== ''
        ? body.message
        : defaultMessage(response.status)

    if (response.status === 401 && !isAuthEndpoint(path) && unauthorizedHandler) {
      unauthorizedHandler()
    }

    throw new ApiError(
      message,
      response.status,
      errors,
      (typeof body.request_id === 'string' ? body.request_id : null) ?? requestId,
      payload,
    )
  }

  const body = (payload ?? {}) as Partial<ApiEnvelope<T>>
  return {
    success: body.success ?? true,
    message: typeof body.message === 'string' ? body.message : '',
    data: (body.data ?? null) as T,
    meta: body.meta && typeof body.meta === 'object' ? (body.meta as ApiMeta) : {},
    request_id: typeof body.request_id === 'string' ? body.request_id : undefined,
  }
}

function defaultMessage(status: number): string {
  switch (status) {
    case 400:
      return 'The request could not be processed.'
    case 401:
      return 'Please sign in to continue.'
    case 403:
      return 'You do not have permission to do that.'
    case 404:
      return 'The requested resource was not found.'
    case 409:
      return 'That action conflicts with the current state.'
    case 422:
      return 'Please check the highlighted fields.'
    case 429:
      return 'Too many requests. Please slow down and try again.'
    default:
      return 'Something went wrong. Please try again.'
  }
}

/* -------------------------------------------------------------------------- */
/* Public API                                                                  */
/* -------------------------------------------------------------------------- */

export const api = {
  get<T>(path: string, options?: RequestOptions) {
    return request<T>('GET', path, options)
  },
  post<T>(path: string, body?: unknown, options?: RequestOptions) {
    return request<T>('POST', path, { ...options, body })
  },
  put<T>(path: string, body?: unknown, options?: RequestOptions) {
    return request<T>('PUT', path, { ...options, body })
  },
  patch<T>(path: string, body?: unknown, options?: RequestOptions) {
    return request<T>('PATCH', path, { ...options, body })
  },
  delete<T>(path: string, options?: RequestOptions) {
    return request<T>('DELETE', path, options)
  },
  upload<T>(path: string, formData: FormData, options?: RequestOptions) {
    return request<T>('POST', path, { ...options, body: formData })
  },
}

/** Translate an unknown thrown value into a human-friendly message. */
export function errorMessage(error: unknown, fallback = 'Something went wrong. Please try again.'): string {
  if (error instanceof ApiError) return error.firstError ?? error.message
  if (error instanceof Error && error.message) return error.message
  return fallback
}
