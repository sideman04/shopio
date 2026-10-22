import { useEffect, useId, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getSearchSuggestions, type SearchSuggestion } from '@/services/productService'
import { useBrowseStore } from '@/context/uiStore'

interface SearchBarProps {
  className?: string
  inputClassName?: string
  autoFocus?: boolean
  onSubmitted?: () => void
  /** Compact variant used inside the dashboard top bars. */
  size?: 'md' | 'sm'
}

/**
 * Search input with a suggestion listbox. Suggestions come from the product
 * service. Supports keyboard
 * navigation with the arrow keys and Escape to dismiss.
 */
export function SearchBar({ className, inputClassName, autoFocus, onSubmitted, size = 'md' }: SearchBarProps) {
  const [term, setTerm] = useState('')
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([])
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const navigate = useNavigate()
  const containerRef = useRef<HTMLDivElement>(null)
  const listId = useId()

  const recentSearches = useBrowseStore((s) => s.recentSearches)

  // Debounced suggestion lookup.
  useEffect(() => {
    const q = term.trim()
    if (q.length < 2) {
      setSuggestions([])
      return
    }
    let cancelled = false
    const timer = window.setTimeout(async () => {
      const results = await getSearchSuggestions(q)
      if (!cancelled) {
        setSuggestions(results)
        setActiveIndex(-1)
      }
    }, 180)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [term])

  useEffect(() => {
    const onClickOutside = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  const submit = (value: string) => {
    const q = value.trim()
    if (!q) return
    useBrowseStore.getState().addSearch(q)
    setOpen(false)
    onSubmitted?.()
    navigate(`/search?q=${encodeURIComponent(q)}`)
  }

  const choose = (suggestion: SearchSuggestion) => {
    setOpen(false)
    setTerm('')
    onSubmitted?.()
    navigate(suggestion.href)
  }

  const items: SearchSuggestion[] = suggestions.length
    ? suggestions
    : recentSearches.map((s) => ({ type: 'term' as const, label: s, sublabel: 'Recent search', href: `/search?q=${encodeURIComponent(s)}` }))

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault()
      if (activeIndex >= 0 && items[activeIndex]) choose(items[activeIndex])
      else submit(term)
      return
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setOpen(true)
      setActiveIndex((i) => Math.min(i + 1, items.length - 1))
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActiveIndex((i) => Math.max(i - 1, -1))
    }
    if (event.key === 'Escape') setOpen(false)
  }

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      <form
        role="search"
        onSubmit={(e) => {
          e.preventDefault()
          submit(term)
        }}
      >
        <label htmlFor={`search-${listId}`} className="sr-only">
          Search products
        </label>
        <div className="relative">
          <Search
            className={cn(
              'pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-400',
              size === 'sm' ? 'h-4 w-4' : 'h-4 w-4',
            )}
            aria-hidden="true"
          />
          <input
            id={`search-${listId}`}
            type="search"
            value={term}
            autoFocus={autoFocus}
            placeholder="Search for sofas, phones, shoes…"
            autoComplete="off"
            role="combobox"
            aria-expanded={open && items.length > 0}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={activeIndex >= 0 ? `${listId}-option-${activeIndex}` : undefined}
            onChange={(e) => {
              setTerm(e.target.value)
              setOpen(true)
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={onKeyDown}
            className={cn(
              'w-full rounded-lg border border-ink-200 bg-white pl-9 pr-9 text-sm text-ink placeholder:text-ink-400 transition-colors hover:border-ink-300 focus:border-ink focus:outline-none focus:ring-2 focus:ring-ink/60',
              size === 'sm' ? 'h-9' : 'h-10',
              inputClassName,
            )}
          />
          {term && (
            <button
              type="button"
              onClick={() => {
                setTerm('')
                setSuggestions([])
              }}
              aria-label="Clear search"
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-ink-400 transition hover:bg-ink-100 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/70"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </form>

      {open && items.length > 0 && (
        <ul
          id={listId}
          role="listbox"
          aria-label="Search suggestions"
          className="absolute z-50 mt-2 max-h-96 w-full overflow-y-auto rounded-card border border-ink-200 bg-white py-1 shadow-lift animate-fade-in"
        >
          {suggestions.length === 0 && (
            <li className="px-3 py-1.5 text-xs font-medium uppercase tracking-wide text-ink-400">Recent searches</li>
          )}
          {items.map((item, index) => (
            <li key={`${item.label}-${index}`} role="presentation">
              <button
                type="button"
                id={`${listId}-option-${index}`}
                role="option"
                aria-selected={index === activeIndex}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => choose(item)}
                className={cn(
                  'flex w-full items-center gap-3 px-3 py-2 text-left transition-colors',
                  index === activeIndex ? 'bg-ink-50' : 'hover:bg-ink-50',
                )}
              >
                {item.imageUrl ? (
                  <img src={item.imageUrl} alt="" className="h-9 w-9 shrink-0 rounded-md object-cover" />
                ) : (
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-ink-100 text-ink-500">
                    <Search className="h-4 w-4" aria-hidden="true" />
                  </span>
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-ink">{item.label}</span>
                  {item.sublabel && <span className="block text-xs text-ink-500">{item.sublabel}</span>}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
