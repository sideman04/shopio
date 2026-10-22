import { Minus, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'

interface QuantitySelectorProps {
  value: number
  onChange: (value: number) => void
  min?: number
  max?: number
  size?: 'sm' | 'md'
  disabled?: boolean
  className?: string
  label?: string
}

/** Accessible quantity stepper used by the cart, PDP and product forms. */
export function QuantitySelector({
  value,
  onChange,
  min = 1,
  max = 99,
  size = 'md',
  disabled,
  className,
  label = 'Quantity',
}: QuantitySelectorProps) {
  const clamp = (next: number) => Math.max(min, Math.min(max, next))
  const atMax = value >= max

  return (
    <div
      className={cn(
        'inline-flex items-center rounded-lg border border-ink-200 bg-white',
        size === 'sm' ? 'h-8' : 'h-10',
        disabled && 'opacity-60',
        className,
      )}
    >
      <button
        type="button"
        onClick={() => onChange(clamp(value - 1))}
        disabled={disabled || value <= min}
        aria-label={`Decrease ${label.toLowerCase()}`}
        className={cn(
          'inline-flex items-center justify-center text-ink transition hover:bg-ink-50 disabled:cursor-not-allowed disabled:text-ink-300',
          size === 'sm' ? 'h-8 w-8' : 'h-10 w-10',
        )}
      >
        <Minus className={size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4'} />
      </button>
      <input
        type="number"
        inputMode="numeric"
        value={value}
        min={min}
        max={max}
        disabled={disabled}
        aria-label={label}
        onChange={(e) => {
          const next = Number(e.target.value)
          if (Number.isNaN(next)) return
          onChange(clamp(next))
        }}
        className={cn(
          'border-x border-ink-200 bg-transparent text-center text-sm font-medium text-ink focus:outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none',
          size === 'sm' ? 'h-8 w-10' : 'h-10 w-12',
        )}
      />
      <button
        type="button"
        onClick={() => onChange(clamp(value + 1))}
        disabled={disabled || atMax}
        aria-label={`Increase ${label.toLowerCase()}`}
        className={cn(
          'inline-flex items-center justify-center text-ink transition hover:bg-ink-50 disabled:cursor-not-allowed disabled:text-ink-300',
          size === 'sm' ? 'h-8 w-8' : 'h-10 w-10',
        )}
      >
        <Plus className={size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4'} />
      </button>
    </div>
  )
}
