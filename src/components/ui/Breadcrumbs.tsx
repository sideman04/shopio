import { Link } from 'react-router-dom'
import { ChevronRight, Home } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface Crumb {
  label: string
  to?: string
}

/**
 * Breadcrumb trail. The final crumb is rendered as plain text and marked
 * `aria-current="page"`. A Home crumb is prepended automatically.
 */
export function Breadcrumbs({ items, className }: { items: Crumb[]; className?: string }) {
  const all: Crumb[] = [{ label: 'Home', to: '/' }, ...items]

  return (
    <nav aria-label="Breadcrumb" className={cn('text-sm', className)}>
      <ol className="flex flex-wrap items-center gap-1.5 text-ink-500">
        {all.map((crumb, index) => {
          const isLast = index === all.length - 1
          return (
            <li key={`${crumb.label}-${index}`} className="flex items-center gap-1.5">
              {index > 0 && <ChevronRight className="h-3.5 w-3.5 text-ink-300" aria-hidden="true" />}
              {isLast || !crumb.to ? (
                <span aria-current={isLast ? 'page' : undefined} className="font-medium text-ink">
                  {index === 0 ? (
                    <span className="inline-flex items-center gap-1.5">
                      <Home className="h-3.5 w-3.5" aria-hidden="true" />
                      <span className="sr-only sm:not-sr-only">{crumb.label}</span>
                    </span>
                  ) : (
                    crumb.label
                  )}
                </span>
              ) : (
                <Link
                  to={crumb.to}
                  className="rounded transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/70"
                >
                  {index === 0 ? (
                    <span className="inline-flex items-center gap-1.5">
                      <Home className="h-3.5 w-3.5" aria-hidden="true" />
                      <span className="sr-only sm:not-sr-only">{crumb.label}</span>
                    </span>
                  ) : (
                    crumb.label
                  )}
                </Link>
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
