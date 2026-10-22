import { cn } from '@/lib/utils'

interface PageHeaderProps {
  title: string
  description?: string
  breadcrumbs?: React.ReactNode
  actions?: React.ReactNode
  className?: string
  /** `storefront` adds vertical rhythm; `dashboard` is compact. */
  variant?: 'storefront' | 'dashboard'
}

/** Consistent page title block used by every page. */
export function PageHeader({
  title,
  description,
  breadcrumbs,
  actions,
  className,
  variant = 'dashboard',
}: PageHeaderProps) {
  if (variant === 'storefront') {
    return (
      <div className={cn('border-b border-ink-200 bg-sand-50', className)}>
        <div className="container-page py-8 sm:py-10">
          {breadcrumbs && <div className="mb-4">{breadcrumbs}</div>}
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{title}</h1>
              {description && <p className="mt-2 max-w-2xl text-sm text-ink-600">{description}</p>}
            </div>
            {actions && <div className="flex flex-wrap items-center gap-3">{actions}</div>}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={cn('flex flex-wrap items-end justify-between gap-4', className)}>
      <div className="min-w-0">
        {breadcrumbs && <div className="mb-2">{breadcrumbs}</div>}
        <h1 className="truncate text-xl font-bold tracking-tight sm:text-2xl">{title}</h1>
        {description && <p className="mt-1 text-sm text-ink-500">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}
