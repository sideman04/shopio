import type { CookiePreferences } from '@/services/cookieConsentService'

type CookieCategory = keyof CookiePreferences

interface CookieCategoryToggleProps {
  category: CookieCategory
  title: string
  description: string
  checked: boolean
  disabled?: boolean
  onChange?: (checked: boolean) => void
}

export function CookieCategoryToggle({
  category,
  title,
  description,
  checked,
  disabled = false,
  onChange,
}: CookieCategoryToggleProps) {
  const descriptionId = `cookie-category-${category}-description`

  return (
    <div className="flex items-start justify-between gap-5 border-b border-ink-100 py-4 last:border-b-0">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <h3 className="text-sm font-semibold text-ink">{title}</h3>
          {disabled && (
            <span className="rounded-full bg-ink-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-ink-500">
              Always on
            </span>
          )}
        </div>
        <p id={descriptionId} className="mt-1 max-w-xl text-xs leading-relaxed text-ink-500 sm:text-sm">
          {description}
        </p>
      </div>

      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={`${title}${disabled ? ', always enabled' : ''}`}
        aria-describedby={descriptionId}
        disabled={disabled}
        onClick={() => onChange?.(!checked)}
        className={`relative mt-0.5 inline-flex h-6 w-11 shrink-0 items-center rounded-full border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 ${
          checked ? 'border-ink bg-ink' : 'border-ink-300 bg-ink-200'
        } ${disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer hover:border-ink'}`}
      >
        <span
          aria-hidden="true"
          className={`inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${
            checked ? 'translate-x-5' : 'translate-x-1'
          }`}
        />
      </button>
    </div>
  )
}
