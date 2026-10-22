import { useId, useState } from 'react'
import { Link } from 'react-router-dom'
import { cn } from '@/lib/utils'

export interface TabItem {
  id: string
  label: string
  badge?: React.ReactNode
  disabled?: boolean
}

interface TabsProps {
  items: TabItem[]
  value?: string
  onChange?: (id: string) => void
  className?: string
  /** Optional content rendered per tab id. */
  panels?: Record<string, React.ReactNode>
}

/**
 * Tabs with proper ARIA wiring: roving focus is not required for a click-driven
 * tablist, but roles, `aria-selected` and `aria-controls` are all set.
 */
export function Tabs({ items, value, onChange, className, panels }: TabsProps) {
  const [internal, setInternal] = useState(items[0]?.id)
  const active = value ?? internal
  const baseId = useId()

  const select = (id: string) => {
    setInternal(id)
    onChange?.(id)
  }

  return (
    <div className={className}>
      <div className="border-b border-ink-200">
        <div role="tablist" aria-label="Sections" className="-mb-px flex gap-1 overflow-x-auto no-scrollbar">
          {items.map((item) => {
            const selected = active === item.id
            return (
              <button
                key={item.id}
                id={`${baseId}-tab-${item.id}`}
                role="tab"
                type="button"
                aria-selected={selected}
                aria-controls={`${baseId}-panel-${item.id}`}
                disabled={item.disabled}
                onClick={() => select(item.id)}
                className={cn(
                  'inline-flex shrink-0 items-center gap-2 whitespace-nowrap border-b-2 px-4 py-3 text-sm font-medium transition-colors',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/70 focus-visible:ring-offset-1',
                  selected
                    ? 'border-ink text-ink'
                    : 'border-transparent text-ink-500 hover:border-ink-200 hover:text-ink',
                  item.disabled && 'cursor-not-allowed opacity-50',
                )}
              >
                {item.label}
                {item.badge}
              </button>
            )
          })}
        </div>
      </div>

      {panels && (
        <div
          id={`${baseId}-panel-${active}`}
          role="tabpanel"
          aria-labelledby={`${baseId}-tab-${active}`}
          tabIndex={0}
          className="focus-visible:outline-none"
        >
          {panels[active]}
        </div>
      )}
    </div>
  )
}

export interface TabLinkItem {
  label: string
  to: string
  end?: boolean
}

/** Route-driven tabs (used where tab state should be shareable via URL). */
export function TabLinks({
  items,
  className,
  activeTo,
}: {
  items: TabLinkItem[]
  className?: string
  activeTo: string
}) {
  return (
    <div className={cn('border-b border-ink-200', className)}>
      <div className="-mb-px flex gap-1 overflow-x-auto no-scrollbar">
        {items.map((item) => {
          const selected = activeTo === item.to
          return (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                'inline-flex shrink-0 items-center whitespace-nowrap border-b-2 px-4 py-3 text-sm font-medium transition-colors',
                selected
                  ? 'border-ink text-ink'
                  : 'border-transparent text-ink-500 hover:border-ink-200 hover:text-ink',
              )}
            >
              {item.label}
            </Link>
          )
        })}
      </div>
    </div>
  )
}
