import { Check, Clock, PackageCheck, Truck, XCircle } from 'lucide-react'
import type { Order, OrderStatus } from '@/types'
import { cn, formatDate } from '@/lib/utils'

const STEPS: Array<{ status: OrderStatus; label: string; icon: typeof Check }> = [
  { status: 'pending', label: 'Order placed', icon: Clock },
  { status: 'confirmed', label: 'Confirmed', icon: Check },
  { status: 'processing', label: 'Processing', icon: PackageCheck },
  { status: 'shipped', label: 'Shipped', icon: Truck },
  { status: 'delivered', label: 'Delivered', icon: Check },
]

/**
 * Horizontal order progress timeline. Cancelled and refunded orders are shown
 * as a terminal state rather than a broken progress bar.
 */
export function OrderStatusTimeline({ order, className }: { order: Order; className?: string }) {
  const terminal = order.status === 'cancelled' || order.status === 'refunded'
  const currentIndex = STEPS.findIndex((step) => step.status === order.status)

  if (terminal) {
    return (
      <div className={cn('flex items-center gap-3 rounded-lg border border-danger-100 bg-danger-50 p-4', className)}>
        <XCircle className="h-5 w-5 shrink-0 text-danger-600" aria-hidden="true" />
        <div>
          <p className="text-sm font-medium text-danger-700">
            {order.status === 'cancelled' ? 'Order cancelled' : 'Order refunded'}
          </p>
          <p className="mt-0.5 text-xs text-danger-700/80">
            {order.history[order.history.length - 1]?.note ?? 'The order did not complete.'}
          </p>
        </div>
      </div>
    )
  }

  return (
    <ol className={cn('flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-0', className)}>
      {STEPS.map((step, index) => {
        const done = currentIndex >= index
        const active = currentIndex === index
        const event = order.history.find((h) => h.newStatus === step.status)
        return (
          <li key={step.status} className="relative flex flex-1 gap-3 sm:flex-col sm:gap-2">
            {/* Connector */}
            {index < STEPS.length - 1 && (
              <span
                aria-hidden="true"
                className={cn(
                  'absolute left-[15px] top-8 h-[calc(100%-8px)] w-px sm:left-1/2 sm:top-4 sm:h-px sm:w-full',
                  currentIndex > index ? 'bg-ink' : 'bg-ink-200',
                )}
              />
            )}
            <span
              className={cn(
                'relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2',
                done ? 'border-ink bg-ink text-white' : 'border-ink-200 bg-white text-ink-300',
              )}
            >
              <step.icon className="h-4 w-4" aria-hidden="true" />
            </span>
            <div className="sm:pr-4">
              <p className={cn('text-sm font-medium', active ? 'text-ink' : done ? 'text-ink-700' : 'text-ink-400')}>
                {step.label}
              </p>
              <p className="mt-0.5 text-xs text-ink-400">
                {event ? formatDate(event.createdAt, 'time') : 'Pending'}
              </p>
            </div>
          </li>
        )
      })}
    </ol>
  )
}
