import { Select } from '@/components/ui/Input'
import type { SortKey } from '@/types'

export const SORT_OPTIONS: Array<{ label: string; value: SortKey }> = [
  { label: 'Popularity', value: 'popularity' },
  { label: 'Newest', value: 'newest' },
  { label: 'Price: low to high', value: 'price-asc' },
  { label: 'Price: high to low', value: 'price-desc' },
  { label: 'Highest rated', value: 'rating' },
  { label: 'Name: A–Z', value: 'name-asc' },
]

interface SortDropdownProps {
  value: SortKey
  onChange: (value: SortKey) => void
  className?: string
  /** Renders inline (grid header) or as a bare select for toolbars. */
  hideLabel?: boolean
}

/** Sort control shared by the shop, category and search pages. */
export function SortDropdown({ value, onChange, className, hideLabel }: SortDropdownProps) {
  return (
    <Select
      className={className}
      label={hideLabel ? undefined : 'Sort by'}
      aria-label="Sort products by"
      value={value}
      options={SORT_OPTIONS}
      onChange={(event) => onChange(event.target.value as SortKey)}
    />
  )
}
