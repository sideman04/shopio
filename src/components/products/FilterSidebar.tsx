import { SlidersHorizontal, Star, X } from 'lucide-react'
import type { Category } from '@/types'
import { cn, formatCurrency } from '@/lib/utils'
import { Checkbox } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'

/** Filter state shared by the shop, category and search pages. */
export interface ProductFilters {
  categories: string[]
  colors: string[]
  brands: string[]
  minPrice: number
  maxPrice: number
  minRating: number | null
  inStockOnly: boolean
}

export const EMPTY_FILTERS: ProductFilters = {
  categories: [],
  colors: [],
  brands: [],
  minPrice: 0,
  maxPrice: 0,
  minRating: null,
  inStockOnly: false,
}

export interface FilterFacets {
  colors: string[]
  brands: string[]
  priceMin: number
  priceMax: number
}

interface FilterSidebarProps {
  filters: ProductFilters
  facets: FilterFacets
  categories: Category[]
  onChange: (next: ProductFilters) => void
  onClear: () => void
  /** Hide the category block on a category page (already scoped). */
  showCategories?: boolean
  activeCount: number
  className?: string
}

const RATING_OPTIONS = [4, 3, 2]

function FilterSection({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section className="border-b border-ink-200 py-5 last:border-b-0">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-ink">{title}</h3>
        {action}
      </div>
      {children}
    </section>
  )
}

/**
 * Catalog filter sidebar. Rendered inline on desktop and inside the mobile
 * filter drawer, from the same controlled state so results match exactly.
 */
export function FilterSidebar({
  filters,
  facets,
  categories,
  onChange,
  onClear,
  showCategories = true,
  activeCount,
  className,
}: FilterSidebarProps) {
  const toggle = <K extends 'categories' | 'colors' | 'brands'>(key: K, value: string) => {
    const list = filters[key]
    const next = list.includes(value) ? list.filter((v) => v !== value) : [...list, value]
    onChange({ ...filters, [key]: next } as ProductFilters)
  }

  const priceStep = 50_000
  const bounds = {
    min: facets.priceMin || 0,
    max: facets.priceMax || 5_000_000,
  }

  return (
    <div className={cn('w-full', className)}>
      <div className="flex items-center justify-between gap-3 pb-4">
        <p className="inline-flex items-center gap-2 text-sm font-semibold text-ink">
          <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
          Filters
          {activeCount > 0 && (
            <span className="rounded-full bg-ink px-1.5 py-0.5 text-[11px] font-semibold text-white">
              {activeCount}
            </span>
          )}
        </p>
        {activeCount > 0 && (
          <button
            type="button"
            onClick={onClear}
            className="inline-flex items-center gap-1 rounded text-xs font-medium text-ink-500 transition hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/70"
          >
            <X className="h-3.5 w-3.5" />
            Clear all
          </button>
        )}
      </div>

      {showCategories && (
        <FilterSection title="Category">
          <ul className="space-y-2.5">
            {categories.map((category) => (
              <li key={category.id}>
                <Checkbox
                  label={
                    <span className="flex w-full items-center justify-between gap-2">
                      <span>{category.name}</span>
                      {category.productCount != null && (
                        <span className="text-xs text-ink-400">{category.productCount}</span>
                      )}
                    </span>
                  }
                  checked={filters.categories.includes(category.slug)}
                  onChange={() => toggle('categories', category.slug)}
                />
              </li>
            ))}
          </ul>
        </FilterSection>
      )}

      <FilterSection title="Price (TZS)">
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <label className="sr-only" htmlFor="filter-min-price">
              Minimum price
            </label>
            <input
              id="filter-min-price"
              type="number"
              min={bounds.min}
              max={filters.maxPrice || bounds.max}
              step={priceStep}
              value={filters.minPrice}
              onChange={(e) => onChange({ ...filters, minPrice: Number(e.target.value) || 0 })}
              className="h-9 w-full rounded-lg border border-ink-200 px-2.5 text-sm focus:border-ink focus:outline-none focus:ring-2 focus:ring-ink/60"
            />
            <span className="text-ink-400">–</span>
            <label className="sr-only" htmlFor="filter-max-price">
              Maximum price
            </label>
            <input
              id="filter-max-price"
              type="number"
              min={filters.minPrice || bounds.min}
              max={bounds.max}
              step={priceStep}
              value={filters.maxPrice}
              onChange={(e) => onChange({ ...filters, maxPrice: Number(e.target.value) || 0 })}
              className="h-9 w-full rounded-lg border border-ink-200 px-2.5 text-sm focus:border-ink focus:outline-none focus:ring-2 focus:ring-ink/60"
            />
          </div>

          <input
            type="range"
            aria-label="Maximum price"
            min={bounds.min}
            max={bounds.max}
            step={priceStep}
            value={filters.maxPrice || bounds.max}
            onChange={(e) => onChange({ ...filters, maxPrice: Number(e.target.value) })}
            className="w-full accent-ink"
          />
          <p className="text-xs text-ink-500">
            Up to <span className="font-medium text-ink">{formatCurrency(filters.maxPrice || bounds.max)}</span>
          </p>
        </div>
      </FilterSection>

      {facets.colors.length > 0 && (
        <FilterSection title="Colour / finish">
          <ul className="space-y-2.5">
            {facets.colors.slice(0, 12).map((color) => (
              <li key={color}>
                <Checkbox
                  label={color}
                  checked={filters.colors.includes(color)}
                  onChange={() => toggle('colors', color)}
                />
              </li>
            ))}
          </ul>
        </FilterSection>
      )}

      <FilterSection title="Customer rating">
        <ul className="space-y-2">
          {RATING_OPTIONS.map((rating) => {
            const selected = filters.minRating === rating
            return (
              <li key={rating}>
                <button
                  type="button"
                  aria-pressed={selected}
                  onClick={() => onChange({ ...filters, minRating: selected ? null : rating })}
                  className={cn(
                    'flex w-full items-center gap-2 rounded-lg border px-2.5 py-2 text-sm transition',
                    selected ? 'border-ink bg-ink-50' : 'border-ink-200 hover:border-ink-400',
                  )}
                >
                  <span className="flex items-center gap-0.5" aria-hidden="true">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star
                        key={i}
                        className={cn('h-3.5 w-3.5', i < rating ? 'fill-gold-500 text-gold-500' : 'text-ink-200')}
                      />
                    ))}
                  </span>
                  <span className="text-ink-600">& up</span>
                </button>
              </li>
            )
          })}
        </ul>
      </FilterSection>

      <FilterSection title="Availability">
        <Checkbox
          label="In stock only"
          checked={filters.inStockOnly}
          onChange={() => onChange({ ...filters, inStockOnly: !filters.inStockOnly })}
        />
      </FilterSection>
    </div>
  )
}

/** Wraps the sidebar for the mobile drawer with an apply action. */
export function FilterDrawerFooter({ onApply, onClear, activeCount }: { onApply: () => void; onClear: () => void; activeCount: number }) {
  return (
    <div className="flex items-center gap-3">
      <Button variant="outline" onClick={onClear} disabled={activeCount === 0} fullWidth>
        Clear all
      </Button>
      <Button variant="primary" onClick={onApply} fullWidth>
        Show results
      </Button>
    </div>
  )
}
