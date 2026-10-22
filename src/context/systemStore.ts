import { create } from 'zustand'
import { useShallow } from 'zustand/react/shallow'
import type { ActivityLog, AppNotification, SupportMessage } from '@/types'

/**
 * System cache — notifications, support inbox and the admin audit feed.
 * Every collection is hydrated from the API by the service layer.
 */

interface SystemState {
  notifications: AppNotification[]
  supportMessages: SupportMessage[]
  activity: ActivityLog[]

  setNotifications: (notifications: AppNotification[]) => void
  setSupportMessages: (messages: SupportMessage[]) => void
  setActivity: (activity: ActivityLog[]) => void
  upsertNotification: (notification: AppNotification) => void
  upsertSupport: (message: SupportMessage) => void

  markRead: (id: number) => void
  markAllRead: (userId?: number) => void
  deleteNotification: (id: number) => void

  setSupportStatus: (id: number, status: SupportMessage['status']) => void
}

function upsertById<T extends { id: number }>(items: T[], next: T): T[] {
  const index = items.findIndex((item) => item.id === next.id)
  if (index === -1) return [next, ...items]
  const copy = [...items]
  copy[index] = next
  return copy
}

export const useSystemStore = create<SystemState>((set, get) => ({
  notifications: [],
  supportMessages: [],
  activity: [],

  setNotifications(notifications) {
    set({ notifications })
  },

  setSupportMessages(supportMessages) {
    set({ supportMessages })
  },

  setActivity(activity) {
    set({ activity })
  },

  upsertNotification(notification) {
    set({ notifications: upsertById(get().notifications, notification) })
  },

  upsertSupport(message) {
    set({ supportMessages: upsertById(get().supportMessages, message) })
  },

  markRead(id) {
    set({
      notifications: get().notifications.map((notification) =>
        notification.id === id ? { ...notification, readAt: new Date().toISOString() } : notification,
      ),
    })
  },

  markAllRead(userId) {
    set({
      notifications: get().notifications.map((notification) =>
        userId === undefined || notification.userId === userId
          ? { ...notification, readAt: new Date().toISOString() }
          : notification,
      ),
    })
  },

  deleteNotification(id) {
    set({ notifications: get().notifications.filter((notification) => notification.id !== id) })
  },

  setSupportStatus(id, status) {
    set({
      supportMessages: get().supportMessages.map((message) =>
        message.id === id ? { ...message, status } : message,
      ),
    })
  },
}))

export function useNotificationsFor(userId: number | null | undefined) {
  return useSystemStore(
    useShallow((s) => (userId == null ? [] : s.notifications.filter((n) => n.userId === userId))),
  )
}

export function useUnreadCount(userId: number | null | undefined) {
  return useSystemStore((s) =>
    userId == null ? 0 : s.notifications.filter((n) => n.userId === userId && !n.readAt).length,
  )
}
