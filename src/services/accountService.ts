import type { Address, AppNotification, SupportMessage, User } from '@/types'
import { useAccountStore } from '@/context/accountStore'
import { useAuthStore } from '@/context/authStore'
import { useSystemStore } from '@/context/systemStore'
import { api } from './apiClient'
import { mapAddress, mapNotification, mapSupport, mapUser } from './mappers'

/** Customer account service — profile, addresses, notifications and support. */

export async function fetchProfile(): Promise<User> {
  const response = await api.get<Record<string, unknown>>('/customers/profile')
  const user = mapUser(response.data)
  useAuthStore.getState().setUser(user)
  return user
}

export interface AddressInput {
  label?: string | null
  recipientName: string
  phone: string
  cityId: number
  district?: string | null
  streetAddress: string
  postalCode?: string | null
  deliveryInstructions?: string | null
  isDefault?: boolean
}

function addressPayload(input: Partial<AddressInput>) {
  return {
    label: input.label ?? null,
    recipient_name: input.recipientName,
    phone: input.phone,
    city_id: input.cityId,
    district: input.district ?? null,
    street_address: input.streetAddress,
    postal_code: input.postalCode ?? null,
    delivery_instructions: input.deliveryInstructions ?? null,
    is_default: input.isDefault,
  }
}

export async function fetchAddresses(): Promise<Address[]> {
  const response = await api.get<Record<string, unknown>[]>('/customers/addresses')
  const addresses = (response.data ?? []).map(mapAddress)
  useAccountStore.getState().setAddresses(addresses)
  return addresses
}

export async function createAddress(input: AddressInput): Promise<Address> {
  const response = await api.post<Record<string, unknown>>('/customers/addresses', addressPayload(input))
  const address = mapAddress(response.data)
  useAccountStore.getState().upsertAddress(address)
  return address
}

export async function updateAddress(id: number, patch: Partial<AddressInput>): Promise<Address> {
  const payload = addressPayload(patch)
  const compact = Object.fromEntries(Object.entries(payload).filter(([, value]) => value !== undefined))
  const response = await api.patch<Record<string, unknown>>(`/customers/addresses/${id}`, compact)
  const address = mapAddress(response.data)
  useAccountStore.getState().upsertAddress(address)
  return address
}

export async function deleteAddress(id: number) {
  await api.delete<null>(`/customers/addresses/${id}`)
  useAccountStore.getState().removeAddress(id)
}

export async function setDefaultAddress(id: number): Promise<Address> {
  const response = await api.patch<Record<string, unknown>>(`/customers/addresses/${id}`, {
    is_default: true,
  })
  const address = mapAddress(response.data)
  useAccountStore.getState().upsertAddress(address)
  useAccountStore.getState().setDefault(id)
  return address
}

export async function fetchNotifications(): Promise<{ items: AppNotification[]; unread: number }> {
  const response = await api.get<Record<string, unknown>[]>('/customers/notifications', {
    query: { per_page: 100 },
  })
  const items = (response.data ?? []).map(mapNotification)
  useSystemStore.getState().setNotifications(items)
  return { items, unread: Number(response.meta?.unread ?? items.filter((n) => !n.readAt).length) }
}

export async function markNotificationRead(id: number) {
  await api.post<{ updated: boolean }>(`/customers/notifications/${id}/read`)
  useSystemStore.getState().markRead(id)
}

export async function markAllNotificationsRead() {
  await api.post<{ updated: number }>('/customers/notifications/read-all')
  useSystemStore.getState().markAllRead()
}

export async function submitSupport(input: {
  name: string
  email: string
  subject: string
  message: string
}): Promise<SupportMessage> {
  const response = await api.post<Record<string, unknown>>('/support', input)
  const ticket = mapSupport(response.data)
  useSystemStore.getState().upsertSupport(ticket)
  return ticket
}

/* ---------------------------- Security & devices --------------------------- */

export interface ActiveSession {
  id: number
  ipAddress: string | null
  userAgent: string | null
  lastUsedAt: string | null
  createdAt: string
  expiresAt: string
  current: boolean
}

export interface LoginActivityEntry {
  id: number
  ipAddress: string | null
  successful: boolean
  createdAt: string
}

/** Active server-side sessions for the signed-in account. */
export async function fetchSessions(): Promise<ActiveSession[]> {
  const response = await api.get<Record<string, unknown>[]>('/customers/sessions')
  return (response.data ?? []).map((row) => ({
    id: Number(row.id),
    ipAddress: row.ipAddress ? String(row.ipAddress) : null,
    userAgent: row.userAgent ? String(row.userAgent) : null,
    lastUsedAt: row.lastUsedAt ? String(row.lastUsedAt) : null,
    createdAt: String(row.createdAt ?? ''),
    expiresAt: String(row.expiresAt ?? ''),
    current: Boolean(row.current),
  }))
}

export async function revokeSession(id: number) {
  await api.delete<null>(`/customers/sessions/${id}`)
}

/** Revokes every session except the one making the request. */
export async function revokeOtherSessions(): Promise<number> {
  const response = await api.post<{ revoked: number }>('/customers/sessions/revoke-others')
  return Number(response.data?.revoked ?? 0)
}

/** Recent sign-in attempts (successful and failed) for the account. */
export async function fetchLoginActivity(): Promise<LoginActivityEntry[]> {
  const response = await api.get<Record<string, unknown>[]>('/customers/login-activity', {
    query: { per_page: 25 },
  })
  return (response.data ?? []).map((row) => ({
    id: Number(row.id),
    ipAddress: row.ipAddress ? String(row.ipAddress) : null,
    successful: Boolean(row.successful),
    createdAt: String(row.createdAt ?? ''),
  }))
}
