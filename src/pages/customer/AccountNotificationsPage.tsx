import { useMemo, useState } from 'react'
import {
  Bell,
  Boxes,
  Check,
  Package,
  ShieldCheck,
  Star,
  Tag,
  TrendingDown,
  type LucideIcon,
} from 'lucide-react'
import type { AppNotification } from '@/types'
import { Button, Card, EmptyState, PageHeader, Select } from '@/components/ui'
import { toast, useAuthStore, useNotificationsFor } from '@/context'
import { accountService } from '@/services'
import { errorMessage } from '@/services/apiClient'
import { cn, relativeTime } from '@/lib/utils'

function iconFor(type: string): LucideIcon {
  switch (type) {
    case 'order':
      return Package
    case 'promotion':
      return Tag
    case 'price':
      return TrendingDown
    case 'account':
      return ShieldCheck
    case 'inventory':
      return Boxes
    case 'review':
      return Star
    default:
      return Bell
  }
}

const FILTER_OPTIONS = [
  { label: 'All notifications', value: 'all' },
  { label: 'Unread only', value: 'unread' },
]

/** Account notification inbox backed by the customer API. */
export default function AccountNotificationsPage() {
  const user = useAuthStore((s) => s.session?.user)
  const notifications = useNotificationsFor(user?.id)

  const [filter, setFilter] = useState('all')

  const sorted = useMemo(
    () => [...notifications].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [notifications],
  )

  const unreadCount = sorted.filter((n) => !n.readAt).length
  const visible = filter === 'unread' ? sorted.filter((n) => !n.readAt) : sorted

  const handleMarkRead = async (notification: AppNotification) => {
    try {
      await accountService.markNotificationRead(notification.id)
      toast.success('Marked as read', notification.title)
    } catch (error) {
      toast.error('Could not mark as read', errorMessage(error))
    }
  }

  const handleMarkAllRead = async () => {
    try {
      await accountService.markAllNotificationsRead()
      toast.success('All caught up', 'Every notification has been marked as read.')
    } catch (error) {
      toast.error('Could not update notifications', errorMessage(error))
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Notifications"
        description="Order updates, price drops and account alerts."
        actions={
          <>
            <Select
              aria-label="Filter notifications"
              className="w-44"
              options={FILTER_OPTIONS}
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
            />
            <Button variant="outline" onClick={handleMarkAllRead} disabled={unreadCount === 0}>
              <Check className="h-4 w-4" /> Mark all as read
            </Button>
          </>
        }
      />

      {sorted.length === 0 ? (
        <EmptyState
          icon={<Bell className="h-5 w-5" />}
          title="No notifications"
          description="When something happens on your account, you will see it here."
          action={{ label: 'Browse products', to: '/shop' }}
        />
      ) : visible.length === 0 ? (
        <EmptyState
          size="sm"
          icon={<Check className="h-5 w-5" />}
          title="No unread notifications"
          description="You have read everything. Switch back to 'All' to see your history."
          action={{ label: 'Show all', onClick: () => setFilter('all') }}
        />
      ) : (
        <Card>
          <ul className="divide-y divide-ink-100">
            {visible.map((notification) => {
              const Icon = iconFor(notification.type)
              const unread = !notification.readAt
              return (
                <li
                  key={notification.id}
                  className={cn('flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:gap-4', unread && 'bg-sand-50/50')}
                >
                  <span
                    className={cn(
                      'flex h-10 w-10 shrink-0 items-center justify-center rounded-full',
                      unread ? 'bg-ink text-white' : 'bg-ink-100 text-ink-400',
                    )}
                    aria-hidden="true"
                  >
                    <Icon className="h-4 w-4" />
                  </span>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-start gap-2">
                      <p className={cn('text-sm', unread ? 'font-semibold text-ink' : 'text-ink-600')}>
                        {notification.title}
                      </p>
                      {unread && (
                        <span
                          className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-ink"
                          aria-label="Unread"
                        />
                      )}
                    </div>
                    <p className="mt-0.5 text-sm text-ink-500">{notification.message}</p>
                    <p className="mt-1 text-xs text-ink-400">{relativeTime(notification.createdAt)}</p>
                  </div>

                  <div className="flex shrink-0 flex-wrap items-center gap-1.5 sm:justify-end">
                    {unread && (
                      <Button variant="ghost" size="sm" onClick={() => handleMarkRead(notification)}>
                        Mark read
                      </Button>
                    )}
                    {notification.targetUrl && (
                      <Button variant="outline" size="sm" to={notification.targetUrl}>
                        Open
                      </Button>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        </Card>
      )}

      <p className="text-xs text-ink-500">
        Notifications are delivered by Shopio and kept in your account.
      </p>
    </div>
  )
}
