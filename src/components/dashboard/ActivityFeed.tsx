import type { ActivityLog } from '@/types'
import { cn, relativeTime } from '@/lib/utils'
import { Avatar } from '@/components/ui/Avatar'

/** Compact activity feed used on the admin overview and activity log page. */
export function ActivityFeed({ items, className }: { items: ActivityLog[]; className?: string }) {
  return (
    <ol className={cn('space-y-4', className)}>
      {items.map((item) => (
        <li key={item.id} className="flex gap-3">
          <Avatar name={item.actorName} size="sm" />
          <div className="min-w-0 flex-1">
            <p className="text-sm text-ink">
              <span className="font-medium">{item.actorName}</span> {item.action.toLowerCase()}
            </p>
            <p className="mt-0.5 truncate text-xs text-ink-500">
              {item.entityLabel} · <span className="capitalize">{item.entityType}</span>
            </p>
          </div>
          <time dateTime={item.createdAt} className="shrink-0 text-xs text-ink-400">
            {relativeTime(item.createdAt)}
          </time>
        </li>
      ))}
    </ol>
  )
}
