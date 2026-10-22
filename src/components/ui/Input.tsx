import { forwardRef, useId } from 'react'
import { AlertCircle, Check } from 'lucide-react'
import { cn } from '@/lib/utils'

/* -------------------------------------------------------------------------- */
/* Shared field scaffolding                                                    */
/* -------------------------------------------------------------------------- */

interface FieldProps {
  label?: string
  hint?: string
  error?: string
  required?: boolean
  className?: string
  children: (props: { id: string; describedBy: string | undefined; invalid: boolean }) => React.ReactNode
}

/**
 * Wraps a control with an accessible label, hint and error message. The label
 * is always linked via `htmlFor`, and errors are announced with `role="alert"`.
 */
export function Field({ label, hint, error, required, className, children }: FieldProps) {
  const id = useId()
  const hintId = hint ? `${id}-hint` : undefined
  const errorId = error ? `${id}-error` : undefined
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined

  return (
    <div className={cn('w-full', className)}>
      {label && (
        <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-ink">
          {label}
          {required && (
            <span className="ml-0.5 text-danger-600" aria-hidden="true">
              *
            </span>
          )}
        </label>
      )}
      {children({ id, describedBy, invalid: !!error })}
      {hint && !error && (
        <p id={hintId} className="mt-1.5 text-xs text-ink-500">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} role="alert" className="mt-1.5 flex items-center gap-1 text-xs font-medium text-danger-600">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          {error}
        </p>
      )}
    </div>
  )
}

const controlBase =
  'w-full rounded-lg border bg-white px-3 text-sm text-ink placeholder:text-ink-400 transition-colors ' +
  'focus:outline-none focus:ring-2 focus:ring-ink/70 focus:ring-offset-0 disabled:cursor-not-allowed disabled:bg-ink-50'

const stateClasses = (invalid?: boolean) =>
  invalid
    ? 'border-danger-600 focus:border-danger-600 focus:ring-danger-600/40'
    : 'border-ink-200 hover:border-ink-300 focus:border-ink'

/* -------------------------------------------------------------------------- */
/* Input                                                                       */
/* -------------------------------------------------------------------------- */

export interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label?: string
  hint?: string
  error?: string
  leadingIcon?: React.ReactNode
  trailingIcon?: React.ReactNode
  /** Right-aligned addon, e.g. a "Show" password toggle. */
  trailingAddon?: React.ReactNode
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, hint, error, required, leadingIcon, trailingIcon, trailingAddon, className, id, ...props },
  ref,
) {
  return (
    <Field label={label} hint={hint} error={error} required={required} className={className}>
      {({ id: fieldId, describedBy, invalid }) => (
        <div className="relative">
          {leadingIcon && (
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-400">
              {leadingIcon}
            </span>
          )}
          <input
            ref={ref}
            id={id ?? fieldId}
            aria-invalid={invalid || undefined}
            aria-describedby={describedBy}
            required={required}
            className={cn(
              controlBase,
              stateClasses(invalid),
              'h-10',
              leadingIcon && 'pl-9',
              (trailingIcon || trailingAddon) && 'pr-10',
            )}
            {...props}
          />
          {(trailingIcon || trailingAddon) && (
            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-ink-400">
              {trailingAddon ?? trailingIcon}
            </span>
          )}
        </div>
      )}
    </Field>
  )
})

/* -------------------------------------------------------------------------- */
/* Textarea                                                                    */
/* -------------------------------------------------------------------------- */

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
  hint?: string
  error?: string
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { label, hint, error, required, className, id, rows = 4, ...props },
  ref,
) {
  return (
    <Field label={label} hint={hint} error={error} required={required} className={className}>
      {({ id: fieldId, describedBy, invalid }) => (
        <textarea
          ref={ref}
          id={id ?? fieldId}
          rows={rows}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          required={required}
          className={cn(controlBase, stateClasses(invalid), 'py-2 leading-relaxed')}
          {...props}
        />
      )}
    </Field>
  )
})

/* -------------------------------------------------------------------------- */
/* Select                                                                      */
/* -------------------------------------------------------------------------- */

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  hint?: string
  error?: string
  options: Array<{ label: string; value: string | number; disabled?: boolean }>
  placeholder?: string
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { label, hint, error, required, options, placeholder, className, id, ...props },
  ref,
) {
  return (
    <Field label={label} hint={hint} error={error} required={required} className={className}>
      {({ id: fieldId, describedBy, invalid }) => (
        <div className="relative">
          <select
            ref={ref}
            id={id ?? fieldId}
            aria-invalid={invalid || undefined}
            aria-describedby={describedBy}
            required={required}
            className={cn(
              controlBase,
              stateClasses(invalid),
              'h-10 cursor-pointer appearance-none bg-none pr-9',
            )}
            {...props}
          >
            {placeholder && <option value="">{placeholder}</option>}
            {options.map((option) => (
              <option key={option.value} value={option.value} disabled={option.disabled}>
                {option.label}
              </option>
            ))}
          </select>
          <svg
            className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-500"
            viewBox="0 0 20 20"
            fill="none"
            aria-hidden="true"
          >
            <path d="M6 8l4 4 4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      )}
    </Field>
  )
})

/* -------------------------------------------------------------------------- */
/* Checkbox / Radio / Switch                                                   */
/* -------------------------------------------------------------------------- */

export interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: React.ReactNode
  description?: string
  error?: string
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox(
  { label, description, error, className, id, ...props },
  ref,
) {
  const generated = useId()
  const fieldId = id ?? generated
  return (
    <div className={cn('flex items-start gap-2.5', className)}>
      <span className="relative mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center">
        <input
          ref={ref}
          id={fieldId}
          type="checkbox"
          className="peer h-4 w-4 cursor-pointer appearance-none rounded border border-ink-300 bg-white transition-colors checked:border-ink checked:bg-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/70 focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50"
          aria-invalid={!!error || undefined}
          {...props}
        />
        <Check
          className="pointer-events-none absolute h-3 w-3 text-white opacity-0 peer-checked:opacity-100"
          strokeWidth={3}
          aria-hidden="true"
        />
      </span>
      {(label || description) && (
        <span className="text-sm leading-snug">
          {label && (
            <label htmlFor={fieldId} className="cursor-pointer text-ink">
              {label}
            </label>
          )}
          {description && <span className="mt-0.5 block text-xs text-ink-500">{description}</span>}
          {error && (
            <span role="alert" className="mt-1 block text-xs font-medium text-danger-600">
              {error}
            </span>
          )}
        </span>
      )}
    </div>
  )
})

export interface RadioProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: React.ReactNode
  description?: string
}

export const Radio = forwardRef<HTMLInputElement, RadioProps>(function Radio(
  { label, description, className, id, ...props },
  ref,
) {
  const generated = useId()
  const fieldId = id ?? generated
  return (
    <div className={cn('flex items-start gap-2.5', className)}>
      <span className="relative mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center">
        <input
          ref={ref}
          id={fieldId}
          type="radio"
          className="peer h-4 w-4 cursor-pointer appearance-none rounded-full border border-ink-300 bg-white transition-colors checked:border-[5px] checked:border-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/70 focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50"
          {...props}
        />
      </span>
      {(label || description) && (
        <span className="text-sm leading-snug">
          {label && (
            <label htmlFor={fieldId} className="cursor-pointer text-ink">
              {label}
            </label>
          )}
          {description && <span className="mt-0.5 block text-xs text-ink-500">{description}</span>}
        </span>
      )}
    </div>
  )
})

export interface SwitchProps {
  checked: boolean
  onChange: (checked: boolean) => void
  label?: string
  description?: string
  disabled?: boolean
  id?: string
  className?: string
}

export function Switch({ checked, onChange, label, description, disabled, id, className }: SwitchProps) {
  const generated = useId()
  const fieldId = id ?? generated
  return (
    <div className={cn('flex items-start justify-between gap-4', className)}>
      {(label || description) && (
        <span className="text-sm">
          {label && (
            <label htmlFor={fieldId} className="font-medium text-ink">
              {label}
            </label>
          )}
          {description && <span className="mt-0.5 block text-xs text-ink-500">{description}</span>}
        </span>
      )}
      <button
        id={fieldId}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/70 focus-visible:ring-offset-2',
          checked ? 'bg-ink' : 'bg-ink-200',
          disabled && 'cursor-not-allowed opacity-50',
        )}
      >
        <span
          className={cn(
            'inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform',
            checked ? 'translate-x-6' : 'translate-x-1',
          )}
        />
      </button>
    </div>
  )
}
