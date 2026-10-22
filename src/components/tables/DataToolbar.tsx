import { Search } from 'lucide-react'
import { cn } from '@/lib/utils'

interface DataToolbarProps {
  searchValue?: string
  onSearchChange?: (value: string) => void
  searchPlaceholder?: string
  /** Filter controls (selects, buttons) rendered to the right. */
  children?: React.ReactNode
  className?: string
}

/**
 * Standard dashboard list toolbar: a labelled search box followed by filters.
 * Stacks on small screens so tables stay usable.
 */
export function DataToolbar({
  searchValue,
  onSearchChange,
  searchPlaceholder = 'Search…',
  children,
  className,
}: DataToolbarProps) {
  return (
    <div className={cn('flex flex-col gap-3 border-b border-ink-200 p-4 lg:flex-row lg:items-center lg:justify-between', className)}>
      {onSearchChange && (
        <div className="relative w-full lg:max-w-xs">
          <label htmlFor="data-toolbar-search" className="sr-only">
            {searchPlaceholder}
          </label>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" aria-hidden="true" />
          <input
            id="data-toolbar-search"
            type="search"
            value={searchValue}
            placeholder={searchPlaceholder}
            onChange={(event) => onSearchChange(event.target.value)}
            className="h-10 w-full rounded-lg border border-ink-200 pl-9 pr-3 text-sm text-ink placeholder:text-ink-400 focus:border-ink focus:outline-none focus:ring-2 focus:ring-ink/60"
          />
        </div>
      )}
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  )
}
