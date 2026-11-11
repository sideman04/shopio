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
      <span className="relative block h-16 w-[84px] overflow-hidden" aria-hidden="true">
        <img
          src={logoUrl}
          alt=""
          className={cn(
            'absolute left-1/2 top-1/2 h-[88px] w-[132px] max-w-none -translate-x-1/2 -translate-y-1/2 object-contain',
            variant === 'light' && 'brightness-110',
          )}
        />
      </span>
    </Link>
  )
}
