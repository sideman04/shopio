import { cn } from '@/lib/utils'
import { titleCase } from '@/lib/utils'

type Tone = 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'gold' | 'dark'

const TONES: Record<Tone, string> = {
  neutral: 'bg-ink-100 text-ink-700',
  success: 'bg-success-50 text-success-700',
  warning: 'bg-gold-500/15 text-gold-600',
  danger: 'bg-danger-50 text-danger-700',
  info: 'bg-info-50 text-info-700',
  gold: 'bg-gold-500 text-ink',
  dark: 'bg-ink text-white',
}

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: Tone
  size?: 'sm' | 'md'
  icon?: React.ReactNode
}

export function Badge({ tone = 'neutral', size = 'md', icon, className, children, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-md font-medium',
        size === 'sm' ? 'px-1.5 py-0.5 text-[11px]' : 'px-2 py-0.5 text-xs',
        TONES[tone],
        className,
      )}
      {...props}
    >
      {icon}
      {children}
    </span>
  )
}

/* -------------------------------------------------------------------------- */
/* Domain status badges                                                        */
/* -------------------------------------------------------------------------- */

const ORDER_TONES: Record<string, Tone> = {
  pending: 'warning',
  confirmed: 'info',
  processing: 'info',
  partially_shipped: 'info',
  shipped: 'info',
  delivered: 'success',
  cancelled: 'danger',
  refunded: 'neutral',
}

const PAYMENT_TONES: Record<string, Tone> = {
  unpaid: 'neutral',
  pending: 'warning',
  paid: 'success',
  partially_refunded: 'warning',
  refunded: 'neutral',
  failed: 'danger',
  initiated: 'neutral',
  succeeded: 'success',
}

const PRODUCT_TONES: Record<string, Tone> = {
  draft: 'neutral',
  pending_review: 'warning',
  active: 'success',
  rejected: 'danger',
  archived: 'neutral',
}

const USER_TONES: Record<string, Tone> = {
  active: 'success',
  pending: 'warning',
  suspended: 'danger',
  disabled: 'neutral',
}

const VERIFICATION_TONES: Record<string, Tone> = {
  not_submitted: 'neutral',
  pending: 'warning',
  approved: 'success',
  rejected: 'danger',
}

const FULFILLMENT_TONES: Record<string, Tone> = {
  unfulfilled: 'neutral',
  partial: 'warning',
  fulfilled: 'success',
  returned: 'danger',
  processing: 'info',
  shipped: 'info',
  delivered: 'success',
  cancelled: 'danger',
}

export function StatusBadge({ status, kind = 'order' }: { status: string; kind?: 'order' | 'payment' | 'product' | 'user' | 'verification' | 'fulfillment' | 'payout' | 'generic' }) {
  const maps: Record<string, Record<string, Tone>> = {
    order: ORDER_TONES,
    payment: PAYMENT_TONES,
    product: PRODUCT_TONES,
    user: USER_TONES,
    verification: VERIFICATION_TONES,
    fulfillment: FULFILLMENT_TONES,
    payout: {
      requested: 'warning',
      pending: 'warning',
      processing: 'info',
      paid: 'success',
      rejected: 'danger',
      failed: 'danger',
    },
    generic: {},
  }
  const tone = maps[kind]?.[status] ?? 'neutral'
  return <Badge tone={tone}>{titleCase(status)}</Badge>
}
