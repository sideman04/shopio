import { cn } from '@/lib/utils'
import { Button } from './Button'

interface EmptyStateProps {
  icon?: React.ReactNode
  title: string
  description?: string
  action?: { label: string; to?: string; onClick?: () => void }
  secondaryAction?: { label: string; to?: string; onClick?: () => void }
  className?: string
  /** `sm` for inline/table empties, `md` for full sections. */
  size?: 'sm' | 'md'
}

/**
 * Consistent empty state. Used for empty carts, no search results, empty
 * inboxes and every dashboard list that can have zero rows.
 */
export function EmptyState({
  icon,
  title,
  description,
  action,
  secondaryAction,
  className,
  size = 'md',
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-card border border-dashed border-ink-200 bg-ink-50/50 text-center',
        size === 'sm' ? 'px-6 py-10' : 'px-6 py-16',
        className,
      )}
    >
      {icon && (
        <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-white text-ink-400 shadow-card">
          {icon}
        </span>
      )}
      <h3 className="text-base font-semibold text-ink">{title}</h3>
      {description && <p className="mt-1.5 max-w-md text-sm text-ink-500">{description}</p>}
      {(action || secondaryAction) && (
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          {action && (
            <Button
              to={action.to}
              onClick={action.onClick}
              variant="primary"
              size={size === 'sm' ? 'sm' : 'md'}
            >
              {action.label}
            </Button>
          )}
          {secondaryAction && (
            <Button
              to={secondaryAction.to}
              onClick={secondaryAction.onClick}
              variant="outline"
              size={size === 'sm' ? 'sm' : 'md'}
            >
              {secondaryAction.label}
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
