import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import {
  CheckCircle2,
  MoreHorizontal,
  Package,
  Printer,
  StickyNote,
  Truck,
  XCircle,
} from 'lucide-react'
import {
  Alert,
  Breadcrumbs,
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  ConfirmDialog,
  Dropdown,
  EmptyState,
  Modal,
  PageHeader,
  Select,
  StatusBadge,
  Table,
  TBody,
  TD,
  Textarea,
  TH,
  THead,
  TR,
} from '@/components/ui'
import { OrderStatusTimeline } from '@/components/dashboard/OrderStatusTimeline'
import { useAuthStore, useOrderById, useOrderStore } from '@/context'
import { toast } from '@/context/uiStore'
import { orderService } from '@/services'
import type { OrderItem } from '@/types'
import { formatCurrency, formatDate, relativeTime } from '@/lib/utils'

const FULFILMENT_OPTIONS = [
  { label: 'Unfulfilled', value: 'unfulfilled' },
  { label: 'Processing', value: 'processing' },
  { label: 'Shipped', value: 'shipped' },
  { label: 'Delivered', value: 'delivered' },
  { label: 'Cancelled', value: 'cancelled' },
]

export default function SellerOrderDetailPage() {
  const { id } = useParams<{ id: string }>()
  const user = useAuthStore((s) => s.session?.user)
  const sellerId = user?.sellerId ?? null
  const order = useOrderById(id ? Number(id) : null)

  useEffect(() => {
    if (!id) return
    void orderService.getSellerOrder(Number(id)).catch(() => undefined)
  }, [id])

  const [noteOpen, setNoteOpen] = useState(false)
  const [noteText, setNoteText] = useState('')
  const [cancelOpen, setCancelOpen] = useState(false)

  const items = useMemo(
    () => (order ? order.items.filter((item) => item.sellerId === sellerId) : []),
    [order, sellerId],
  )

  const otherSellerItems = useMemo(
    () => (order ? order.items.filter((item) => item.sellerId !== sellerId) : []),
    [order, sellerId],
  )

  if (!order) {
    return (
      <div className="space-y-6">
        <PageHeader title="Order" />
        <EmptyState
          icon={<Package className="h-5 w-5" />}
          title="Order not found"
          description="This order does not exist or is no longer available."
          action={{ label: 'Back to orders', to: '/seller/orders' }}
        />
      </div>
    )
  }

  const subtotal = items.reduce((total, item) => total + item.unitPrice * item.quantity, 0)
  const commission = items.reduce(
    (total, item) => total + (item.unitPrice * item.quantity * item.sellerCommissionRate) / 100,
    0,
  )
  const netPayout = subtotal - commission

  const updateOrderStatus = async (next: 'shipped' | 'delivered') => {
    await orderService.updateOrderStatus(order.id, next, `Seller marked order as ${next}`)
    toast.success(next === 'shipped' ? 'Marked as shipped' : 'Marked as delivered', order.orderNumber)
  }

  const updateItemStatus = async (itemId: number, status: OrderItem['fulfillmentStatus']) => {
    await orderService.updateItemFulfillment(order.id, itemId, status)
    toast.success('Fulfilment updated', `Item marked as ${status}.`)
  }

  const saveNote = () => {
    if (!noteText.trim()) {
      toast.error('Note required', 'Write a short internal note before saving.')
      return
    }
    useOrderStore.getState().addNote(order.id, noteText.trim())
    toast.success('Note added', 'The internal note was appended to the order history.')
    setNoteText('')
    setNoteOpen(false)
  }

  const cancelOrder = async () => {
    await orderService.updateOrderStatus(order.id, 'cancelled', 'Cancelled by seller')
    toast.success('Order cancelled', order.orderNumber)
    setCancelOpen(false)
  }

  const canCancel = order.status === 'pending' || order.status === 'confirmed'
  const canShip = order.status !== 'shipped' && order.status !== 'delivered' && order.status !== 'cancelled'
  const canDeliver = order.status !== 'delivered' && order.status !== 'cancelled'

  return (
    <div className="space-y-6">
      <PageHeader
        title={order.orderNumber}
        description={`Placed ${formatDate(order.placedAt, 'long')} · ${order.customerName}`}
        breadcrumbs={<Breadcrumbs items={[{ label: 'Orders', to: '/seller/orders' }, { label: order.orderNumber }]} />}
        actions={
          <>
            <StatusBadge status={order.status} kind="order" />
            <StatusBadge status={order.paymentStatus} kind="payment" />
            {canShip && (
              <Button variant="outline" onClick={() => updateOrderStatus('shipped')}>
                <Truck className="h-4 w-4" aria-hidden="true" />
                Mark as shipped
              </Button>
            )}
            {canDeliver && (
              <Button variant="outline" onClick={() => updateOrderStatus('delivered')}>
                <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                Mark as delivered
              </Button>
            )}
            <Dropdown
              align="right"
              label="More order actions"
              trigger={
                <span className="inline-flex h-10 items-center gap-2 rounded-lg border border-ink-200 px-4 text-sm font-medium text-ink transition hover:bg-ink-50">
                  <MoreHorizontal className="h-4 w-4" />
                  More
                </span>
              }
              items={[
                { label: 'Add internal note', icon: <StickyNote className="h-4 w-4" />, onClick: () => setNoteOpen(true) },
                { label: 'Print packing slip', icon: <Printer className="h-4 w-4" />, onClick: () => window.print() },
                ...(canCancel
                  ? [
                      {
                        label: 'Cancel order',
                        icon: <XCircle className="h-4 w-4" />,
                        tone: 'danger' as const,
                        divider: true,
                        onClick: () => setCancelOpen(true),
                      },
                    ]
                  : []),
              ]}
            />
          </>
        }
      />

      <Alert tone="info" title="You fulfil only your own items">
        This order contains {items.length} item{items.length === 1 ? '' : 's'} from your store
        {otherSellerItems.length > 0
          ? ` and ${otherSellerItems.length} item${otherSellerItems.length === 1 ? '' : 's'} from another seller, which they fulfil separately.`
          : '.'}{' '}
        Updating the order status here affects the whole order record, so coordinate with other sellers where
        needed.
      </Alert>

      <Card>
        <CardBody>
          <OrderStatusTimeline order={order} />
        </CardBody>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {/* Items */}
          <Card>
            <CardHeader>
              <CardTitle>Your items</CardTitle>
              <span className="text-sm text-ink-500">{items.length} item{items.length === 1 ? '' : 's'}</span>
            </CardHeader>
            <Table>
              <THead>
                <TR>
                  <TH>Product</TH>
                  <TH>Unit price</TH>
                  <TH>Qty</TH>
                  <TH>Line total</TH>
                  <TH>Fulfilment</TH>
                </TR>
              </THead>
              <TBody>
                {items.map((item) => (
                  <TR key={item.id}>
                    <TD className="max-w-[16rem]">
                      <div className="flex items-center gap-3">
                        <span className="flex h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-ink-100">
                          {item.imageUrl ? (
                            <img src={item.imageUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
                          ) : null}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate font-medium text-ink">{item.productName}</p>
                          <p className="truncate text-xs text-ink-500">
                            {item.variantName} · {item.sku}
                          </p>
                        </div>
                      </div>
                    </TD>
                    <TD className="whitespace-nowrap">{formatCurrency(item.unitPrice)}</TD>
                    <TD>{item.quantity}</TD>
                    <TD className="whitespace-nowrap font-medium text-ink">
                      {formatCurrency(item.unitPrice * item.quantity)}
                    </TD>
                    <TD>
                      <Select
                        aria-label={`Fulfilment status for ${item.productName}`}
                        value={item.fulfillmentStatus}
                        options={FULFILMENT_OPTIONS}
                        onChange={(event) =>
                          updateItemStatus(item.id, event.target.value as OrderItem['fulfillmentStatus'])
                        }
                      />
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </Card>

          {/* History */}
          <Card>
            <CardHeader>
              <CardTitle>Order history</CardTitle>
            </CardHeader>
            <CardBody>
              <ol className="space-y-4">
                {order.history.map((event) => (
                  <li key={event.id} className="flex gap-3">
                    <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-ink" aria-hidden="true" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-ink">
                        <span className="font-medium capitalize">{event.newStatus.replace('_', ' ')}</span>
                        {event.note ? ` — ${event.note}` : ''}
                      </p>
                      <p className="mt-0.5 text-xs text-ink-400">
                        {formatDate(event.createdAt, 'time')} · {relativeTime(event.createdAt)}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            </CardBody>
          </Card>
        </div>

        <div className="space-y-6">
          {/* Customer */}
          <Card>
            <CardHeader>
              <CardTitle>Customer</CardTitle>
            </CardHeader>
            <CardBody className="space-y-1.5 text-sm">
              <p className="font-medium text-ink">{order.customerName}</p>
              <p className="text-ink-600">{order.customerEmail}</p>
              <p className="text-ink-600">{order.customerPhone}</p>
            </CardBody>
          </Card>

          {/* Shipping */}
          <Card>
            <CardHeader>
              <CardTitle>Shipping address</CardTitle>
            </CardHeader>
            <CardBody className="space-y-1.5 text-sm text-ink-600">
              <p className="font-medium text-ink">{order.customerName}</p>
              <p>{order.shippingAddressLine}</p>
              <p>
                {[order.shippingDistrict, order.shippingCity, order.shippingRegion].filter(Boolean).join(', ')}
              </p>
              <p>
                {order.shippingCity}, {order.shippingRegion} {order.shippingPostalCode}
              </p>
              {order.shippingInstructions && (
                <p className="mt-2 rounded-lg bg-ink-50 p-3 text-xs text-ink-600">
                  <span className="font-medium text-ink">Instructions:</span> {order.shippingInstructions}
                </p>
              )}
            </CardBody>
          </Card>

          {/* Summary */}
          <Card>
            <CardHeader>
              <CardTitle>Order summary</CardTitle>
            </CardHeader>
            <CardBody className="space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-ink-600">Your items subtotal</span>
                <span className="font-medium text-ink">{formatCurrency(subtotal)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-ink-600">Commission</span>
                <span className="font-medium text-danger-700">− {formatCurrency(commission)}</span>
              </div>
              <div className="flex items-center justify-between border-t border-ink-200 pt-3">
                <span className="font-medium text-ink">Net payout</span>
                <span className="text-base font-bold text-ink">{formatCurrency(netPayout)}</span>
              </div>

              <div className="mt-2 space-y-2 border-t border-ink-200 pt-3 text-xs text-ink-500">
                <p className="font-medium uppercase tracking-wide text-ink-500">Full order totals</p>
                <div className="flex items-center justify-between">
                  <span>Items subtotal</span>
                  <span>{formatCurrency(order.itemsSubtotal)}</span>
                </div>
                {order.itemsDiscount > 0 && (
                  <div className="flex items-center justify-between">
                    <span>Discount</span>
                    <span>− {formatCurrency(order.itemsDiscount)}</span>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span>Delivery</span>
                  <span>{formatCurrency(order.shippingTotal)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>VAT</span>
                  <span>{formatCurrency(order.taxTotal)}</span>
                </div>
                <div className="flex items-center justify-between font-medium text-ink">
                  <span>Grand total</span>
                  <span>{formatCurrency(order.grandTotal)}</span>
                </div>
              </div>

              <p className="border-t border-ink-200 pt-3 text-xs text-ink-500">
                Payment method: <span className="font-medium text-ink">{order.paymentMethod ?? '—'}</span>.
              </p>
            </CardBody>
          </Card>
        </div>
      </div>

      {/* Internal note modal */}
      <Modal
        open={noteOpen}
        onClose={() => setNoteOpen(false)}
        title="Add internal note"
        description="Only visible to you and Shopio staff."
        footer={
          <>
            <Button variant="outline" onClick={() => setNoteOpen(false)}>
              Cancel
            </Button>
            <Button onClick={saveNote}>Save note</Button>
          </>
        }
      >
        <Textarea
          label="Note"
          rows={4}
          value={noteText}
          onChange={(event) => setNoteText(event.target.value)}
          placeholder="e.g. Customer asked to deliver after 5pm."
        />
      </Modal>

      <ConfirmDialog
        open={cancelOpen}
        onClose={() => setCancelOpen(false)}
        onConfirm={cancelOrder}
        title="Cancel order"
        description={`${order.orderNumber} will be marked as cancelled. This cannot be undone.`}
        confirmLabel="Cancel order"
        tone="danger"
      />
    </div>
  )
}
