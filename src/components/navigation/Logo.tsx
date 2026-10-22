import { Link } from 'react-router-dom'
import { cn } from '@/lib/utils'

/** Wordmark. The glyph echoes the dark rounded square used in the favicon. */
export function Logo({
  className,
  variant = 'default',
  to = '/',
}: {
  className?: string
  variant?: 'default' | 'light'
  to?: string
}) {
  return (
    <Link
      to={to}
      className={cn('inline-flex items-center gap-2 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/70 focus-visible:ring-offset-2', className)}
      aria-label="Shopio — home"
    >
      <span
        className={cn(
          'flex h-8 w-8 items-center justify-center rounded-lg text-base font-bold leading-none',
          variant === 'light' ? 'bg-white text-ink' : 'bg-ink text-white',
        )}
        aria-hidden="true"
      >
        S
      </span>
      <span
        className={cn(
          'text-xl font-bold tracking-tight',
          variant === 'light' ? 'text-white' : 'text-ink',
        )}
      >
        Shopio
      </span>
    </Link>
  )
}
