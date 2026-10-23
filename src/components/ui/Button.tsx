import { forwardRef } from 'react'
import { Link } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

type Variant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'gold' | 'link'
type Size = 'sm' | 'md' | 'lg' | 'icon' | 'icon-sm'

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-ink text-white hover:bg-ink-800 active:bg-ink-900 disabled:bg-ink-300',
  secondary: 'bg-ink-50 text-ink hover:bg-ink-100 border border-ink-200',
  outline: 'bg-white text-ink border border-ink-200 hover:border-ink-400 hover:bg-ink-50',
  ghost: 'bg-transparent text-ink-600 hover:bg-ink-100 hover:text-ink',
  danger: 'bg-danger-600 text-white hover:bg-danger-700',
  gold: 'bg-gold-500 text-ink hover:bg-gold-400',
  link: 'bg-transparent text-ink underline-offset-4 hover:underline p-0 h-auto',
}

const SIZES: Record<Size, string> = {
  sm: 'h-8 px-3 text-xs gap-1.5',
  md: 'h-10 px-4 text-sm gap-2',
  lg: 'h-12 px-6 text-sm gap-2',
  icon: 'h-10 w-10',
  'icon-sm': 'h-8 w-8',
}

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  loading?: boolean
  /** Render as a router link while keeping button styling. */
  to?: string
  /** Render as an anchor (external links, downloads). */
  href?: string
  fullWidth?: boolean
}

/**
 * The single button primitive for Shopio. Prefer this over ad-hoc button
 * styling so focus, hover, disabled and loading states stay consistent.
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = 'primary',
    size = 'md',
    loading = false,
    to,
    href,
    fullWidth,
    className,
    children,
    disabled,
    type = 'button',
    ...props
  },
  ref,
) {
  const classes = cn(
    'inline-flex items-center justify-center rounded-lg font-medium transition-all duration-200 ease-out',
    'hover:-translate-y-0.5 hover:shadow-lift active:translate-y-0 active:shadow-none',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/70 focus-visible:ring-offset-2',
    'disabled:cursor-not-allowed disabled:opacity-60',
    VARIANTS[variant],
    SIZES[size],
    fullWidth && 'w-full',
    variant === 'link' && 'h-auto',
    className,
  )

  const content = (
    <>
      {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
      {children}
    </>
  )

  if (to && !disabled && !loading) {
    return (
      <Link to={to} className={classes} {...(props as Record<string, unknown>)}>
        {content}
      </Link>
    )
  }

  if (href && !disabled && !loading) {
    return (
      <a href={href} className={classes} {...(props as Record<string, unknown>)}>
        {content}
      </a>
    )
  }

  return (
    <button
      ref={ref}
      type={type}
      className={classes}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {content}
    </button>
  )
})
