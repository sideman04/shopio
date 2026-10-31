import { cloneElement, isValidElement, useEffect, useRef, useState } from 'react'
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

/**
 * Accessible menu for row actions, account menus and bulk operations.
 *
 * The supplied trigger is cloned and receives the menu ARIA wiring instead of
 * being nested inside another `<button>`, which would produce invalid nested
 * interactive controls when the trigger is already a Button.
 */
export function Dropdown({ trigger, items, align = 'right', className, menuClassName, label }: DropdownProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

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

    // Move focus into the menu so keyboard users can act immediately.
    const first = menuRef.current?.querySelector<HTMLElement>('[role="menuitem"]')
    first?.focus()

    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const toggle = () => setOpen((value) => !value)

  const triggerProps = {
    'aria-haspopup': 'menu' as const,
    'aria-expanded': open,
    'aria-label': label,
    onClick: (event: React.MouseEvent) => {
      event.preventDefault()
      toggle()
    },
    onKeyDown: (event: React.KeyboardEvent) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault()
        toggle()
      }
    },
  }

  return (
    <div ref={ref} className={cn('relative inline-block', className)}>
      {isValidElement(trigger) ? (
        cloneElement(
          trigger as React.ReactElement<Record<string, unknown>>,
          {
            ...triggerProps,
            ...(typeof (trigger as React.ReactElement<Record<string, unknown>>).type === 'string'
              ? { role: 'button', tabIndex: 0 }
              : {}),
          },
        )
      ) : (
        <button type="button" {...triggerProps}>
          {trigger}
        </button>
      )}

      {open && (
        <div
          ref={menuRef}
          role="menu"
          onKeyDown={(event) => {
            const items = Array.from(
              menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]:not([aria-disabled="true"])') ?? [],
            )
            if (items.length === 0) return
            const index = items.indexOf(document.activeElement as HTMLElement)
            if (event.key === 'ArrowDown') {
              event.preventDefault()
              items[(index + 1) % items.length]?.focus()
            } else if (event.key === 'ArrowUp') {
              event.preventDefault()
              items[(index - 1 + items.length) % items.length]?.focus()
            } else if (event.key === 'Home') {
              event.preventDefault()
              items[0]?.focus()
            } else if (event.key === 'End') {
              event.preventDefault()
              items[items.length - 1]?.focus()
            }
          }}
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
              'flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm transition-colors focus:outline-none focus-visible:bg-ink-100',
              item.tone === 'danger' ? 'text-danger-700 hover:bg-danger-50' : 'text-ink hover:bg-ink-50',
              item.disabled && 'pointer-events-none opacity-50',
            )

            return (
              <div key={`${item.label}-${index}`}>
                {item.divider && <div className="my-1 h-px bg-ink-100" role="separator" />}
                {item.to ? (
                  <Link
                    to={item.to}
                    role="menuitem"
                    aria-disabled={item.disabled || undefined}
                    tabIndex={item.disabled ? -1 : undefined}
                    className={classes}
                    onClick={(event) => {
                      if (item.disabled) {
                        event.preventDefault()
                        return
                      }
                      setOpen(false)
                    }}
                  >
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
