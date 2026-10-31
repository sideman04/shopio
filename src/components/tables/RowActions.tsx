import { MoreHorizontal } from 'lucide-react'
import { Dropdown, type DropdownItem } from '@/components/ui'

export interface RowActionsProps {
  items: DropdownItem[]
  label?: string
  /** Show the word “Actions” on wider screens. */
  showLabel?: boolean
}

/**
 * Consistent row-action menu used across admin tables. The trigger is a real
 * button (keyboard focusable) rather than a bare icon, and the menu carries an
 * accessible label.
 */
export function RowActions({ items, label = 'Row actions', showLabel = true }: RowActionsProps) {
  return (
    <Dropdown
      label={label}
      align="right"
      trigger={
        <span className="inline-flex h-8 cursor-pointer select-none items-center gap-1.5 rounded-lg border border-ink-200 bg-white px-2.5 text-sm font-medium text-ink shadow-sm transition hover:bg-ink-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-300">
          <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
          {showLabel && <span className="hidden sm:inline">Actions</span>}
        </span>
      }
      items={items}
    />
  )
}
