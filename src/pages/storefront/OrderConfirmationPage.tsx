import { Link, useParams } from 'react-router-dom'
import { CheckCircle2, Mail, Package, Truck } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { SmartImage } from '@/components/ui/SmartImage'
import { StatusBadge } from '@/components/ui/Badge'
import { OrderStatusTimeline } from '@/components/dashboard/OrderStatusTimeline'
import { formatCurrency, formatDate } from '@/lib/utils'
import { useOrderById } from '@/context/orderStore'

/** Post-checkout confirmation with the order summary. */
export default function OrderConfirmationPage() {
  const { orderId } = useParams()
  const order = useOrderById(Number(orderId))

  if (!order) {
    return (
      <div className="container-page py-20">
        <EmptyState
          icon={<Package className="h-5 w-5" />}
          title="Order not found"
          description="We could not find that order. It may have been placed in a different session."
          action={{ label: 'Continue shopping', to: '/shop' }}
          secondaryAction={{ label: 'View your orders', to: '/account/orders' }}
        />
      </div>
    )
  }

  return (
    <div className="container-page py-12">
      <div className="mx-auto max-w-3xl">
        <div className="text-center">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-success-50 text-success-700">
            <CheckCircle2 className="h-7 w-7" aria-hidden="true" />
          </span>
          <h1 className="mt-5 text-2xl font-bold tracking-tight sm:text-3xl">Thank you for your order</h1>
          <p className="mt-2 text-sm text-ink-600">
            Your order <span className="font-semibold text-ink">{order.orderNumber}</span> was recorded on{' '}
            {formatDate(order.placedAt, 'long')}. You can track its progress from your account.
          </p>
        </div>

        <div className="mt-8 rounded-card border border-ink-200 bg-white p-6 shadow-card">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-wide text-ink-400">Order number</p>
              <p className="text-lg font-bold text-ink">{order.orderNumber}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={order.status} kind="order" />
              <StatusBadge status={order.paymentStatus} kind="payment" />
            </div>
          </div>

          <div className="mt-6">
            <OrderStatusTimeline order={order} />
          </div>
        </div>

        {/* Items */}
        <div className="mt-6 rounded-card border border-ink-200 bg-white p-6 shadow-card">
          <h2 className="text-base font-semibold text-ink">Items in this order</h2>
          <ul className="mt-4 divide-y divide-ink-100">
            {order.items.map((item) => (
              <li key={item.id} className="flex items-center gap-4 py-3">
                <SmartImage
                  src={item.imageUrl ?? undefined}
                  alt={item.productName}
                  wrapperClassName="h-14 w-14 shrink-0 rounded-lg"
                  fallbackLabel={item.productName}
                />
                <div className="min-w-0 flex-1">
                  <Link to={`/product/${item.productSlug}`} className="truncate text-sm font-medium text-ink hover:underline">
                    {item.productName}
                  </Link>
                  <p className="text-xs text-ink-500">
                    {item.variantName} · SKU {item.sku} · ×{item.quantity}
                  </p>
                </div>
                <span className="text-sm font-semibold text-ink">
                  {formatCurrency(item.unitPrice * item.quantity)}
                </span>
              </li>
            ))}
          </ul>

          <dl className="mt-4 space-y-2 border-t border-ink-200 pt-4 text-sm">
            <div className="flex justify-between">
              <dt className="text-ink-500">Subtotal</dt>
              <dd className="font-medium text-ink">{formatCurrency(order.itemsSubtotal)}</dd>
            </div>
            {order.itemsDiscount > 0 && (
              <div className="flex justify-between">
                <dt className="text-ink-500">Discount</dt>
                <dd className="font-medium text-success-700">−{formatCurrency(order.itemsDiscount)}</dd>
              </div>
            )}
            <div className="flex justify-between">
              <dt className="text-ink-500">Delivery</dt>
              <dd className="font-medium text-ink">
                {order.shippingTotal === 0 ? 'Free' : formatCurrency(order.shippingTotal)}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-ink-500">VAT (18%)</dt>
              <dd className="font-medium text-ink">{formatCurrency(order.taxTotal)}</dd>
            </div>
            <div className="flex justify-between border-t border-ink-200 pt-3 text-base">
              <dt className="font-semibold text-ink">Total</dt>
              <dd className="font-bold text-ink">{formatCurrency(order.grandTotal)}</dd>
            </div>
          </dl>
        </div>

        {/* Delivery + next steps */}
        <div className="mt-6 grid gap-6 sm:grid-cols-2">
          <div className="rounded-card border border-ink-200 bg-white p-6 shadow-card">
            <h2 className="flex items-center gap-2 text-base font-semibold text-ink">
              <Truck className="h-4 w-4 text-ink-400" aria-hidden="true" />
              Delivery details
            </h2>
            <address className="mt-3 space-y-0.5 text-sm not-italic text-ink-600">
              <p className="font-medium text-ink">{order.customerName}</p>
              <p>{order.shippingAddressLine}</p>
              <p>
                {order.shippingCity}, {order.shippingRegion}
              </p>
              {order.shippingPostalCode && <p>{order.shippingPostalCode}</p>}
              <p className="pt-1">{order.customerPhone}</p>
            </address>
            {order.shippingInstructions && (
              <p className="mt-3 rounded-lg bg-sand-100 p-3 text-xs text-ink-600">
                {order.shippingInstructions}
              </p>
            )}
          </div>

          <div className="rounded-card border border-ink-200 bg-white p-6 shadow-card">
            <h2 className="flex items-center gap-2 text-base font-semibold text-ink">
              <Mail className="h-4 w-4 text-ink-400" aria-hidden="true" />
              What happens next
            </h2>
            <ol className="mt-3 space-y-3 text-sm text-ink-600">
              <li className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-ink text-xs font-semibold text-white">1</span>
                The seller confirms your order and prepares it for dispatch.
              </li>
              <li className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-ink text-xs font-semibold text-white">2</span>
                You receive a delivery estimate by SMS and email.
              </li>
              <li className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-ink text-xs font-semibold text-white">3</span>
                Track progress any time from your account.
              </li>
            </ol>
          </div>
        </div>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Button to="/shop" size="lg">
            Continue shopping
          </Button>
          <Button to="/account/orders" variant="outline" size="lg">
            View my orders
          </Button>
        </div>
      </div>
    </div>
  )
}
