import type { Product, ProductVariant } from '@/types'
import { cn, formatCurrency } from '@/lib/utils'
import { Badge } from '@/components/ui/Badge'

interface VariantSelectorProps {
  product: Product
  selectedVariant: ProductVariant
  onChange: (variant: ProductVariant) => void
  className?: string
}

/** Colour-ish option values render as swatches; everything else as pills. */
function isColorOption(name: string) {
  return /colou?r|shade|finish|dial|frame|upholstery|wash|print/i.test(name)
}

const SWATCHES: Record<string, string> = {
  'stone beige': '#E4D2BB',
  charcoal: '#36393B',
  sand: '#D7BE9E',
  'ivory boucle': '#F3EDE3',
  'forest velvet': '#2F4739',
  camel: '#C08A4E',
  oak: '#C79A62',
  walnut: '#7A5230',
  white: '#FFFFFF',
  black: '#111111',
  graphite: '#3B3F45',
  silver: '#D5D8DB',
  midnight: '#0E1113',
  'midnight black': '#0E1113',
  'cloud grey': '#C9CDD2',
  ocean: '#2A5C78',
  onyx: '#151719',
  'sky blue': '#8FB8D8',
  emerald: '#1F6B4F',
  ash: '#B9BCC0',
  oat: '#E7DCC8',
  forest: '#2C4636',
  navy: '#1B2A44',
  burgundy: '#6E2230',
  tortoise: '#6B4A2A',
  clear: '#EDEFF2',
  chestnut: '#6B3F22',
  tan: '#C08B57',
  coral: '#E2725B',
  indigo: '#2C3E70',
  palm: '#3F6B4A',
  sage: '#A8B5A0',
  grey: '#9AA0A6',
  'natural oak': '#D6B486',
  brown: '#6B4A2F',
  'indigo stripe': '#33436F',
  olive: '#5A6349',
  stone: '#CFC7BB',
}

function swatchColor(value: string) {
  return SWATCHES[value.toLowerCase()] ?? '#B4B4B4'
}

/**
 * Variant picker. Selects the variant whose options match the user's choices,
 * and disables combinations that are entirely out of stock.
 */
export function VariantSelector({ product, selectedVariant, onChange, className }: VariantSelectorProps) {
  const { optionTypes } = product
  if (optionTypes.length === 0) return null

  const findVariant = (options: Record<string, string>) =>
    product.variants.find((variant) =>
      Object.entries(options).every(([key, value]) => variant.options[key] === value),
    )

  const activeOptions = selectedVariant.options

  // A value is available if any variant carrying it (plus the other current
  // selections) still has stock.
  const isAvailable = (optionName: string, value: string) => {
    const candidateOptions = { ...activeOptions, [optionName]: value }
    return product.variants.some(
      (variant) =>
        Object.entries(candidateOptions).every(([key, val]) => variant.options[key] === val) &&
        variant.stock > 0,
    )
  }

  return (
    <div className={cn('space-y-4', className)}>
      {optionTypes.map((option) => {
        const asSwatch = isColorOption(option.name)
        return (
          <div key={option.name}>
            <div className="mb-2 flex items-baseline justify-between gap-3">
              <p className="text-sm font-medium text-ink">
                {option.name}
                <span className="ml-2 font-normal text-ink-500">{activeOptions[option.name]}</span>
              </p>
            </div>

            <div className="flex flex-wrap gap-2" role="group" aria-label={option.name}>
              {option.values.map((value) => {
                const selected = activeOptions[option.name] === value
                const available = isAvailable(option.name, value)
                return (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={selected}
                    disabled={!available}
                    onClick={() => {
                      const next = findVariant({ ...activeOptions, [option.name]: value })
                      if (next) onChange(next)
                    }}
                    className={cn(
                      'inline-flex items-center gap-2 rounded-lg border text-sm transition',
                      asSwatch ? 'h-9 px-2.5' : 'h-9 px-3',
                      selected
                        ? 'border-ink bg-ink text-white'
                        : 'border-ink-200 text-ink-700 hover:border-ink-400',
                      !available && 'cursor-not-allowed opacity-40 line-through',
                    )}
                  >
                    {asSwatch && (
                      <span
                        aria-hidden="true"
                        className="h-5 w-5 rounded-full border border-ink-200"
                        style={{ backgroundColor: swatchColor(value) }}
                      />
                    )}
                    {value}
                  </button>
                )
              })}
            </div>
          </div>
        )
      })}

      <div className="flex flex-wrap items-center gap-3 pt-1 text-sm">
        <span className="text-ink-500">
          Selected: <span className="font-medium text-ink">{selectedVariant.variantName}</span>
        </span>
        <span className="font-semibold text-ink">{formatCurrency(selectedVariant.price)}</span>
        {selectedVariant.stock <= 0 ? (
          <Badge tone="danger">Out of stock</Badge>
        ) : selectedVariant.stock <= 5 ? (
          <Badge tone="warning">Only {selectedVariant.stock} left</Badge>
        ) : (
          <Badge tone="success">In stock</Badge>
        )}
      </div>
    </div>
  )
}
