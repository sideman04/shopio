import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

interface PaginationProps {
  page: number
  totalPages: number
  onPageChange: (page: number) => void
  /** Number of sibling pages to show either side of the current page. */
  siblingCount?: number
  className?: string
  totalItems?: number
  pageSize?: number
}

function range(start: number, end: number) {
  return Array.from({ length: end - start + 1 }, (_, i) => start + i)
}

/** Build a compact page list: 1 … 4 5 6 … 20 */
function buildPages(page: number, totalPages: number, siblingCount: number): Array<number | 'gap'> {
  const totalNumbers = siblingCount * 2 + 5
  if (totalPages <= totalNumbers) return range(1, totalPages)

  const left = Math.max(2, page - siblingCount)
  const right = Math.min(totalPages - 1, page + siblingCount)
  const items: Array<number | 'gap'> = [1]

  if (left > 2) items.push('gap')
  items.push(...range(left, right))
  if (right < totalPages - 1) items.push('gap')
  items.push(totalPages)

  return items
}

export function Pagination({
  page,
  totalPages,
  onPageChange,
  siblingCount = 1,
  className,
  totalItems,
  pageSize,
}: PaginationProps) {
  if (totalPages <= 1) return null

  const pages = buildPages(page, totalPages, siblingCount)
  const from = pageSize ? (page - 1) * pageSize + 1 : undefined
  const to = pageSize && totalItems ? Math.min(page * pageSize, totalItems) : undefined

  return (
    <nav className={cn('flex flex-wrap items-center justify-between gap-4', className)} aria-label="Pagination">
      {totalItems != null && (
        <p className="text-sm text-ink-500">
          Showing <span className="font-medium text-ink">{from}</span>–
          <span className="font-medium text-ink">{to}</span> of{' '}
          <span className="font-medium text-ink">{totalItems}</span>
        </p>
      )}

      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          aria-label="Previous page"
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-ink-200 text-ink transition hover:border-ink-400 hover:bg-ink-50 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-ink-200 disabled:hover:bg-transparent"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>

        <ul className="flex items-center gap-1">
          {pages.map((item, index) => (
            <li key={item === 'gap' ? `gap-${index}` : item}>
              {item === 'gap' ? (
                <span className="inline-flex h-9 w-9 items-center justify-center text-sm text-ink-400">…</span>
              ) : (
                <button
                  type="button"
                  onClick={() => onPageChange(item)}
                  aria-current={item === page ? 'page' : undefined}
                  aria-label={`Page ${item}`}
                  className={cn(
                    'inline-flex h-9 min-w-9 items-center justify-center rounded-lg px-2 text-sm font-medium transition',
                    item === page
                      ? 'bg-ink text-white'
                      : 'border border-ink-200 text-ink hover:border-ink-400 hover:bg-ink-50',
                  )}
                >
                  {item}
                </button>
              )}
            </li>
          ))}
        </ul>

        <button
          type="button"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          aria-label="Next page"
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-ink-200 text-ink transition hover:border-ink-400 hover:bg-ink-50 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-ink-200 disabled:hover:bg-transparent"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </nav>
  )
}
