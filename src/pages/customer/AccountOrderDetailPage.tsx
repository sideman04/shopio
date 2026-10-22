import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Download, LifeBuoy, Package, RotateCcw, Star, XCircle } from 'lucide-react'
import type { Order } from '@/types'
import {
  Alert,
  Breadcrumbs,
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  ConfirmDialog,
  DataList,
  EmptyState,
  PageHeader,
  SmartImage,
  StatusBadge,
  Table,
  TBody,
  TD,
  TH,
  THead,
  TR,
} from '@/components/ui'
import { OrderStatusTimeline } from '@/components/dashboard/OrderStatusTimeline'
import { toast, useAuthStore, useCartStore, useCatalogStore, useOrderById } from '@/context'
import { orderService } from '@/services'
import { formatCurrency, formatDate } from '@/lib/utils'

/**
 * Full detail for a single order. Access is limited to the signed-in customer
 * so one account cannot inspect another's order by guessing an id.
 */
export default function AccountOrderDetailPage() {
  const { id } = useParams<{ id: string }>()
  const user = useAuthStore((s) => s.session?.user)
  const order = useOrderById(id ? Number(id) : undefined)
  const products = useCatalogStore((s) => s.products)

  useEffect(() => {
    if (!id) return
    void orderService.getOrder(Number(id), 'customer')
  }, [id])

  const [cancelOpen, setCancelOpen] = useState(false)
  const [cancelling, setCancelling] = useState(false)

  const notFound = (
    <EmptyState
      icon={<Package className="h-5 w-5" />}
      title="Order not found"
      description="This order does not exist, or it does not belong to your account."
      action={{ label: 'Back to orders', to: '/account/orders' }}
    />
  )

  if (!order || order.userId !== user?.id) {
    return (
      <div className="space-y-6">
        <PageHeader title="Order detail" />
        {notFound}
      </div>
    )
  }

  const canCancel = order.status === 'pending' || order.status === 'confirmed'

  const handleBuyAgain = () => {
    let added = 0
    let skipped = 0

    order.items.forEach((item) => {
      const product = products.find((p) => p.id === item.productId)
      const variant =
        product?.variants.find((v) => v.id === item.variantId) ??
        product?.variants.find((v) => v.isDefault) ??
        product?.variants[0]

      if (!product || !variant || variant.stock <= 0) {
        skipped += 1
        return
      }
      useCartStore.getState().addItem(product, variant, item.quantity)
      added += 1
    })

    if (added > 0) {
      toast.success(
        'Added to cart',
        `${added} ${added === 1 ? 'item' : 'items'} added from ${order.orderNumber}.`,
        { label: 'View cart', href: '/cart' },
      )
    }
    if (skipped > 0) {
      toast.warning(
        'Some items unavailable',
        `${skipped} ${skipped === 1 ? 'item is' : 'items are'} out of stock and were skipped.`,
      )
    }
  }

  const confirmCancel = async () => {
    setCancelling(true)
    try {
      await orderService.updateOrderStatus(order.id, 'cancelled', 'Cancelled by customer')
      toast.success('Order cancelled', 'The order has been marked as cancelled.')
    } finally {
      setCancelling(false)
      setCancelOpen(false)
    }
  }

  const lineTotal = (item: Order['items'][number]) => item.unitPrice * item.quantity

  return (
    <div className="space-y-6">
      <PageHeader
        variant="dashboard"
        breadcrumbs={
          <Breadcrumbs
            items={[
              { label: 'My account', to: '/account' },
              { label: 'Orders', to: '/account/orders' },
              { label: order.orderNumber },
            ]}
          />
        }
        title={order.orderNumber}
        description={`Placed ${formatDate(order.placedAt, 'long')} · ${order.items.length} ${
          order.items.length === 1 ? 'item' : 'items'
        }`}
        actions={
          <>
            <Button variant="secondary" onClick={handleBuyAgain}>
              <RotateCcw className="h-4 w-4" /> Buy again
            </Button>
            <Button
              variant="outline"
              onClick={() =>
                toast.info(
                  'Request an invoice',
                  'Contact support with your order number and we will email a VAT invoice.',
                )
              }
            >
              <Download className="h-4 w-4" /> Download invoice
            </Button>
            {canCancel && (
              <Button variant="danger" onClick={() => setCancelOpen(true)}>
                <XCircle className="h-4 w-4" /> Cancel order
              </Button>
            )}
          </>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>Order status</CardTitle>
          <StatusBadge status={order.status} kind="order" />
        </CardHeader>
        <CardBody>
          <OrderStatusTimeline order={order} />
        </CardBody>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Items</CardTitle>
            </CardHeader>
            <Table>
              <THead>
                <TR>
                  <TH>Product</TH>
                  <TH>SKU</TH>
                  <TH className="text-right">Unit price</TH>
                  <TH className="text-center">Qty</TH>
                  <TH className="text-right">Line total</TH>
                  <TH>Fulfilment</TH>
                </TR>
              </THead>
              <TBody>
                {order.items.map((item) => (
                  <TR key={item.id}>
                    <TD>
                      <div className="flex items-center gap-3">
                        <SmartImage
                          src={item.imageUrl ?? undefined}
                          alt={item.productName}
                          wrapperClassName="h-12 w-12 shrink-0 rounded-lg"
                        />
                        <div className="min-w-0">
                          <Link
                            to={`/product/${item.productSlug}`}
                            className="line-clamp-1 font-medium text-ink hover:underline"
                          >
                            {item.productName}
                          </Link>
                          <p className="truncate text-xs text-ink-500">{item.variantName}</p>
                        </div>
                      </div>
                    </TD>
                    <TD className="whitespace-nowrap text-xs text-ink-500">{item.sku}</TD>
                    <TD className="whitespace-nowrap text-right">{formatCurrency(item.unitPrice)}</TD>
                    <TD className="text-center">{item.quantity}</TD>
                    <TD className="whitespace-nowrap text-right font-semibold text-ink">
                      {formatCurrency(lineTotal(item))}
                    </TD>
                    <TD>
                      <StatusBadge status={item.fulfillmentStatus} kind="fulfillment" />
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Shipping address</CardTitle>
            </CardHeader>
            <CardBody>
              <DataList
                items={[
                  { label: 'Recipient', value: order.customerName },
                  { label: 'Phone', value: order.customerPhone },
                  {
                    label: 'Address',
                    value: (
                      <>
                        {order.shippingAddressLine}
                        {order.shippingDistrict ? `, ${order.shippingDistrict}` : ''}
                      </>
                    ),
                  },
                  {
                    label: 'City / region',
                    value: `${order.shippingCity}, ${order.shippingRegion}`,
                  },
                  { label: 'Postal code', value: order.shippingPostalCode ?? '—' },
                  { label: 'Delivery instructions', value: order.shippingInstructions ?? '—' },
                  { label: 'Customer note', value: order.customerNote ?? '—' },
                ]}
              />
            </CardBody>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Order summary</CardTitle>
            </CardHeader>
            <CardBody className="space-y-4">
              <dl className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <dt className="text-ink-600">Subtotal</dt>
                  <dd className="text-ink">{formatCurrency(order.itemsSubtotal)}</dd>
                </div>
                {order.itemsDiscount > 0 && (
                  <div className="flex items-center justify-between">
                    <dt className="text-ink-600">Discount</dt>
                    <dd className="text-success-700">−{formatCurrency(order.itemsDiscount)}</dd>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <dt className="text-ink-600">Delivery</dt>
                  <dd className="text-ink">
                    {order.shippingTotal === 0 ? 'Free' : formatCurrency(order.shippingTotal)}
                  </dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="text-ink-600">VAT (18%)</dt>
                  <dd className="text-ink">{formatCurrency(order.taxTotal)}</dd>
                </div>
                <div className="flex items-center justify-between border-t border-ink-200 pt-2 text-base font-semibold text-ink">
                  <dt>Total</dt>
                  <dd>{formatCurrency(order.grandTotal)}</dd>
                </div>
              </dl>

              <DataList
                items={[
                  { label: 'Payment method', value: order.paymentMethod ?? '—' },
                  {
                    label: 'Payment status',
                    value: <StatusBadge status={order.paymentStatus} kind="payment" />,
                  },
                ]}
              />
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Need help with this order?</CardTitle>
            </CardHeader>
            <CardBody className="space-y-3">
              <Button to="/contact" variant="outline" fullWidth>
                <LifeBuoy className="h-4 w-4" /> Contact support
              </Button>
              <Button to="/shipping-returns" variant="outline" fullWidth>
                Shipping &amp; returns
              </Button>
              {order.status === 'delivered' && (
                <Button to="/account/reviews" variant="primary" fullWidth>
                  <Star className="h-4 w-4" /> Leave a review
                </Button>
              )}
            </CardBody>
          </Card>
        </div>
      </div>

      <Alert tone="info" title="Need an invoice?">
        Contact support with your order number and we'll send a VAT invoice for this order.
      </Alert>

      <ConfirmDialog
        open={cancelOpen}
        onClose={() => setCancelOpen(false)}
        onConfirm={confirmCancel}
        title="Cancel this order?"
        description="The order will be marked as cancelled and reserved stock will be released."
        confirmLabel="Cancel order"
        cancelLabel="Keep order"
        tone="danger"
        loading={cancelling}
      />
    </div>
  )
}
