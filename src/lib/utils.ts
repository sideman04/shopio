import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

/** Merge conditional class names with Tailwind conflict resolution. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/* -------------------------------------------------------------------------- */
/* Currency & numbers                                                          */
/* -------------------------------------------------------------------------- */

/**
 * Shopio trades primarily in Tanzanian Shillings (TZS) — see the backend
 * `products.currency` / `orders.currency` columns. The symbol is configurable
 * so a future multi-currency backend can switch presentation without a rewrite.
 */
export const CURRENCY = {
  code: 'TZS',
  symbol: 'TSh',
}

export function formatCurrency(value: number, opts: { compact?: boolean } = {}) {
  const { compact = false } = opts
  if (!Number.isFinite(value)) return `${CURRENCY.symbol} 0`
  const amount = compact
    ? new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(value)
    : new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(value)
  return `${CURRENCY.symbol} ${amount}`
}

export function formatNumber(value: number, compact = false) {
  if (!Number.isFinite(value)) return '0'
  return new Intl.NumberFormat('en-US', {
    notation: compact ? 'compact' : 'standard',
    maximumFractionDigits: compact ? 1 : 0,
  }).format(value)
}

export function formatPercent(value: number, digits = 1) {
  return `${value > 0 ? '+' : ''}${value.toFixed(digits)}%`
}

/** Percentage discount between a compare-at price and the current price. */
export function discountPercent(price: number, compareAt?: number | null) {
  if (!compareAt || compareAt <= price) return 0
  return Math.round(((compareAt - price) / compareAt) * 100)
}

/* -------------------------------------------------------------------------- */
/* Dates                                                                       */
/* -------------------------------------------------------------------------- */

export function formatDate(input: string | number | Date, style: 'short' | 'long' | 'time' = 'short') {
  const date = input instanceof Date ? input : new Date(input)
  if (Number.isNaN(date.getTime())) return '—'
  if (style === 'time') {
    return new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' }).format(date)
  }
  return new Intl.DateTimeFormat('en-GB', {
    dateStyle: style === 'long' ? 'long' : 'medium',
  }).format(date)
}

export function relativeTime(input: string | number | Date) {
  const date = input instanceof Date ? input : new Date(input)
  if (Number.isNaN(date.getTime())) return '—'
  const diff = Date.now() - date.getTime()
  const minutes = Math.round(diff / 60000)
  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })
  if (Math.abs(minutes) < 60) return rtf.format(-minutes, 'minute')
  const hours = Math.round(minutes / 60)
  if (Math.abs(hours) < 24) return rtf.format(-hours, 'hour')
  const days = Math.round(hours / 24)
  if (Math.abs(days) < 30) return rtf.format(-days, 'day')
  const months = Math.round(days / 30)
  return rtf.format(-months, 'month')
}

/* -------------------------------------------------------------------------- */
/* Strings & ids                                                               */
/* -------------------------------------------------------------------------- */

export function slugify(input: string) {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')
}

export function titleCase(input: string) {
  return input
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

export function truncate(input: string, max = 120) {
  if (input.length <= max) return input
  return `${input.slice(0, max).trimEnd()}…`
}

/** Human-friendly order number, matching the backend `order_number` column. */
export function generateOrderNumber() {
  const stamp = Date.now().toString().slice(-8)
  const rand = Math.floor(Math.random() * 900 + 100)
  return `SHP-${stamp}-${rand}`
}

export function uid(prefix = 'id') {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`
}

/* -------------------------------------------------------------------------- */
/* Arrays & misc                                                               */
/* -------------------------------------------------------------------------- */

export function unique<T>(items: T[]) {
  return Array.from(new Set(items))
}

export function groupBy<T, K extends string | number>(items: T[], key: (item: T) => K) {
  return items.reduce<Record<K, T[]>>(
    (acc, item) => {
      const k = key(item)
      ;(acc[k] ||= []).push(item)
      return acc
    },
    {} as Record<K, T[]>,
  )
}

export function sum(values: number[]) {
  return values.reduce((a, b) => a + b, 0)
}

export function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

/** Debounce for search inputs. */
export function debounce<T extends (...args: never[]) => void>(fn: T, delay = 300) {
  let timer: ReturnType<typeof setTimeout>
  return (...args: Parameters<T>) => {
    clearTimeout(timer)
    timer = setTimeout(() => fn(...args), delay)
  }
}

/** Pause execution for a short UI transition. */
export function sleep(ms = 350) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms))
}

export function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value)
}
