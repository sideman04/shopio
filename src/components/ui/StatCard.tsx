import { ArrowDownRight, ArrowUpRight } from 'lucide-react'
import { cn, formatPercent } from '@/lib/utils'

interface StatCardProps {
  label: string
  value: string
  /** Percentage change vs the previous period. Omit to hide the delta. */
  change?: number
  /** Set true when a decrease is the desirable direction (e.g. refunds). */
  invertTrend?: boolean
  icon?: React.ReactNode
  hint?: string
  className?: string
  loading?: boolean
}

/**
 * Headline metric tile used across all three dashboards. Deliberately plain —
 * no gradients — to match the Shopio visual language.
 */
export function StatCard({
  label,
  value,
  change,
  invertTrend,
  icon,
  hint,
  className,
  loading,
}: StatCardProps) {
  const positive = change != null && change >= 0
  const good = invertTrend ? !positive : positive

  return (
    <div className={cn('rounded-card border border-ink-200 bg-white p-5 shadow-card', className)}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-ink-500">{label}</p>
        {icon && (
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-ink-50 text-ink-600">
            {icon}
          </span>
        )}
      </div>

      {loading ? (
        <div className="mt-3 h-8 w-28 skeleton rounded-md" aria-hidden="true" />
      ) : (
        <p className="mt-3 text-2xl font-bold tracking-tight text-ink">{value}</p>
      )}

      <div className="mt-2 flex items-center gap-2 text-xs">
        {change != null && (
          <span
            className={cn(
              'inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 font-medium',
              good ? 'bg-success-50 text-success-700' : 'bg-danger-50 text-danger-700',
            )}
          >
            {positive ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
            {formatPercent(Math.abs(change))}
          </span>
        )}
        {hint && <span className="text-ink-500">{hint}</span>}
      </div>
    </div>
  )
}
