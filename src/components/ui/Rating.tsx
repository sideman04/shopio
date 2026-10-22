import { useState } from 'react'
import { Star } from 'lucide-react'
import { cn, formatNumber } from '@/lib/utils'

interface StarsProps {
  rating: number
  size?: 'sm' | 'md' | 'lg'
  className?: string
  /** Show the numeric value next to the stars. */
  showValue?: boolean
  reviewCount?: number
}

const SIZES = { sm: 'h-3.5 w-3.5', md: 'h-4 w-4', lg: 'h-5 w-5' } as const

/**
 * Star rating display. Uses a clipped overlay for fractional values so a 4.5
 * rating renders as a genuine half star. The whole group is exposed to
 * assistive tech as a single accessible label.
 */
export function Stars({ rating, size = 'md', className, showValue = false, reviewCount }: StarsProps) {
  const clamped = Math.max(0, Math.min(5, rating))
  const percent = (clamped / 5) * 100

  return (
    <span className={cn('inline-flex items-center gap-1.5', className)}>
      <span
        className="relative inline-flex"
        role="img"
        aria-label={`Rated ${clamped.toFixed(1)} out of 5${reviewCount != null ? ` from ${reviewCount} reviews` : ''}`}
      >
        <span className="inline-flex gap-0.5 text-ink-200" aria-hidden="true">
          {Array.from({ length: 5 }).map((_, i) => (
            <Star key={i} className={cn(SIZES[size], 'fill-current')} strokeWidth={0} />
          ))}
        </span>
        <span
          className="absolute inset-0 inline-flex gap-0.5 overflow-hidden text-gold-500"
          style={{ width: `${percent}%` }}
          aria-hidden="true"
        >
          {Array.from({ length: 5 }).map((_, i) => (
            <Star key={i} className={cn(SIZES[size], 'shrink-0 fill-current')} strokeWidth={0} />
          ))}
        </span>
      </span>
      {showValue && (
        <span className={cn('font-medium text-ink', size === 'sm' ? 'text-xs' : 'text-sm')}>
          {clamped.toFixed(1)}
        </span>
      )}
      {reviewCount != null && (
        <span className={cn('text-ink-500', size === 'sm' ? 'text-xs' : 'text-sm')}>
          ({formatNumber(reviewCount)})
        </span>
      )}
    </span>
  )
}

interface RatingInputProps {
  value: number
  onChange: (value: number) => void
  disabled?: boolean
}

/** Interactive 1–5 star picker used by the review form. */
export function RatingInput({ value, onChange, disabled }: RatingInputProps) {
  const [hover, setHover] = useState<number | undefined>(undefined)
  const shown = hover ?? value

  return (
    <div className="inline-flex items-center gap-1" role="radiogroup" aria-label="Rating">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          role="radio"
          aria-checked={value === star}
          aria-label={`${star} star${star > 1 ? 's' : ''}`}
          disabled={disabled}
          onClick={() => onChange(star)}
          onMouseEnter={() => setHover(star)}
          onMouseLeave={() => setHover(undefined)}
          className="rounded p-0.5 transition-colors hover:bg-ink-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/70 disabled:cursor-not-allowed"
        >
          <Star className={cn('h-5 w-5', star <= shown ? 'fill-gold-500 text-gold-500' : 'text-ink-300')} />
        </button>
      ))}
    </div>
  )
}
