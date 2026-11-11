import { Link } from 'react-router-dom'
import { cn } from '@/lib/utils'

const logoUrl = new URL('../../logo.png', import.meta.url).href

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
      className={cn(
        'inline-flex shrink-0 items-center rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/70 focus-visible:ring-offset-2',
        className,
      )}
      aria-label="RAGIZE — home"
    >
      <span className="relative block h-12 w-16 overflow-hidden sm:h-16 sm:w-[84px]" aria-hidden="true">
        <img
          src={logoUrl}
          alt=""
          className={cn(
            'absolute left-1/2 top-1/2 h-16 w-24 max-w-none -translate-x-1/2 -translate-y-1/2 object-contain sm:h-[88px] sm:w-[132px]',
            variant === 'light' && 'brightness-110',
          )}
        />
      </span>
    </Link>
  )
}
