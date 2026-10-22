import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { cn } from '@/lib/utils'

export interface DropdownItem {
  label: string
  to?: string
  onClick?: () => void
  icon?: React.ReactNode
  tone?: 'default' | 'danger'
  disabled?: boolean
  /** Optional separator above this item. */
  divider?: boolean
}

interface DropdownProps {
  trigger: React.ReactNode
  items: DropdownItem[]
  align?: 'left' | 'right'
  className?: string
  menuClassName?: string
  label?: string
}

/** Accessible menu for row actions, account menus and bulk operations. */
export function Dropdown({ trigger, items, align = 'right', className, menuClassName, label }: DropdownProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onClick = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div ref={ref} className={cn('relative inline-block', className)}>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={label}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/70 focus-visible:ring-offset-1 rounded-lg"
      >
        {trigger}
      </button>

      {open && (
        <div
          role="menu"
          className={cn(
            'absolute z-50 mt-2 min-w-[12rem] overflow-hidden rounded-card border border-ink-200 bg-white py-1 shadow-lift animate-fade-in',
            align === 'right' ? 'right-0' : 'left-0',
            menuClassName,
          )}
        >
          {items.map((item, index) => {
            const content = (
              <>
                {item.icon && <span className="shrink-0 text-ink-400">{item.icon}</span>}
                <span className="truncate">{item.label}</span>
              </>
            )
            const classes = cn(
              'flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm transition-colors',
              item.tone === 'danger' ? 'text-danger-700 hover:bg-danger-50' : 'text-ink hover:bg-ink-50',
              item.disabled && 'pointer-events-none opacity-50',
            )

            return (
              <div key={`${item.label}-${index}`}>
                {item.divider && <div className="my-1 h-px bg-ink-100" role="separator" />}
                {item.to ? (
                  <Link to={item.to} role="menuitem" className={classes} onClick={() => setOpen(false)}>
                    {content}
                  </Link>
                ) : (
                  <button
                    type="button"
                    role="menuitem"
                    className={classes}
                    disabled={item.disabled}
                    onClick={() => {
                      item.onClick?.()
                      setOpen(false)
                    }}
                  >
                    {content}
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
