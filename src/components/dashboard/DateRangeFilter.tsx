import { CalendarRange } from 'lucide-react'
import { cn } from '@/lib/utils'

export type RangeKey = '7d' | '30d' | '90d' | '12m'

const RANGES: Array<{ key: RangeKey; label: string; long: string }> = [
  { key: '7d', label: '7D', long: 'Last 7 days' },
  { key: '30d', label: '30D', long: 'Last 30 days' },
  { key: '90d', label: '90D', long: 'Last 90 days' },
  { key: '12m', label: '12M', long: 'Last 12 months' },
]

/**
 * Date-range switcher used by dashboard charts. Purely presentational: the
 * chosen range maps to the `days` query parameter on the analytics endpoints.
 */
export function DateRangeFilter({
  value,
  onChange,
  className,
}: {
  value: RangeKey
  onChange: (value: RangeKey) => void
  className?: string
}) {
  return (
    <div className={cn('inline-flex items-center gap-2', className)}>
      <span className="hidden items-center gap-1.5 text-xs text-ink-500 sm:inline-flex">
        <CalendarRange className="h-3.5 w-3.5" aria-hidden="true" />
        {RANGES.find((r) => r.key === value)?.long}
      </span>
      <div role="group" aria-label="Date range" className="inline-flex rounded-lg border border-ink-200 bg-white p-0.5">
        {RANGES.map((range) => (
          <button
            key={range.key}
            type="button"
            aria-pressed={value === range.key}
            title={range.long}
            onClick={() => onChange(range.key)}
            className={cn(
              'rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/70',
              value === range.key ? 'bg-ink text-white' : 'text-ink-600 hover:bg-ink-50',
            )}
          >
            {range.label}
          </button>
        ))}
      </div>
    </div>
  )
}
