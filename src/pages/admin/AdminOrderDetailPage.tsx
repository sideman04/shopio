import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { MoreHorizontal, Printer, StickyNote, Truck } from 'lucide-react'
import {
  Alert,
  Breadcrumbs,
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  DataList,
  Dropdown,
  EmptyState,
  Modal,
  PageHeader,
  Select,
  SmartImage,
  StatusBadge,
  TBody,
  TD,
  TH,
  THead,
  TR,
  Table,
  Textarea,
} from '@/components/ui'
import { OrderStatusTimeline } from '@/components/dashboard/OrderStatusTimeline'
import { adminService, orderService } from '@/services'
import { useOrderById, useOrderStore } from '@/context/orderStore'
import { usePeopleStore } from '@/context/peopleStore'
import { toast } from '@/context/uiStore'
import type { OrderItem, OrderStatus, PaymentStatus } from '@/types'
import { formatCurrency, formatDate, formatNumber } from '@/lib/utils'

const FULFILLMENT_OPTIONS: Array<{ label: string; value: OrderItem['fulfillmentStatus'] }> = [
  { label: 'Unfulfilled', value: 'unfulfilled' },
  { label: 'Processing', value: 'processing' },
  { label: 'Shipped', value: 'shipped' },
  { label: 'Delivered', value: 'delivered' },
  { label: 'Cancelled', value: 'cancelled' },
  { label: 'Returned', value: 'returned' },
]

const REFUND_REASONS = [
  'Customer request',
  'Item damaged in transit',
  'Item not as described',
  'Late delivery',
  'Goodwill gesture',
]

/** Full order detail with fulfilment, payment truth and refund controls. */
export default function AdminOrderDetailPage() {
  const { id } = useParams()
  const order = useOrderById(Number(id))

  useEffect(() => {
    if (!id) return
    void orderService.getAdminOrder(Number(id))
    void adminService.fetchSellers({ pageSize: 100 }).catch(() => undefined)
  }, [id])

  const sellers = usePeopleStore((s) => s.sellers)
  const sellerNameFor = (sellerId: number | null | undefined) =>
    sellers.find((seller) => seller.id === sellerId)?.storeName ?? '—'

  const [noteOpen, setNoteOpen] = useState(false)
  const [noteText, setNoteText] = useState('')
  const [refundOpen, setRefundOpen] = useState(false)
  const [refundAmount, setRefundAmount] = useState('')
  const [refundReason, setRefundReason] = useState(REFUND_REASONS[0])
  const [busy, setBusy] = useState(false)

  if (!order) {
    return (
      <div className="space-y-6">
        <PageHeader title="Order not found" />
        <EmptyState
          icon={<Truck className="h-5 w-5" />}
          title="That order does not exist"
          description="It may have been removed, or the link may be incorrect."
          action={{ label: 'Back to orders', to: '/admin/orders' }}
        />
      </div>
    )
  }

  const setStatus = async (next: OrderStatus) => {
    await orderService.updateOrderStatus(order.id, next)
    toast.success('Order status updated', `${order.orderNumber} is now ${next.replace(/_/g, ' ')}.`)
  }

  const markPaid = async () => {
    await orderService.updatePaymentStatus(order.id, 'paid')
    toast.success('Payment marked as paid', 'The order was updated on the server.')
  }

  const saveNote = () => {
    if (!noteText.trim()) {
      toast.error('Note cannot be empty', 'Add a short internal note before saving.')
      return
    }
    useOrderStore.getState().addNote(order.id, noteText.trim())
    toast.success('Note added', 'The note was appended to the order history.')
    setNoteText('')
    setNoteOpen(false)
  }

  const submitRefund = async () => {
    const amount = Number(refundAmount)
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error('Enter a valid refund amount', 'The amount must be greater than zero.')
      return
    }
    const status: PaymentStatus = amount >= order.grandTotal ? 'refunded' : 'partially_refunded'
    setBusy(true)
    try {
      await orderService.updatePaymentStatus(order.id, status)
      toast.success(
        'Refund recorded',
        `${formatCurrency(amount)} recorded as ${status.replace(/_/g, ' ')}. No money moved — a real refund must be issued via the payment provider.`,
      )
      setRefundOpen(false)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <Breadcrumbs
          items={[
            { label: 'Admin', to: '/admin' },
            { label: 'Orders', to: '/admin/orders' },
            { label: `#${order.orderNumber}` },
          ]}
        />
        <div className="mt-3">
          <PageHeader
            title={`Order ${order.orderNumber}`}
            description={`Placed ${formatDate(order.placedAt, 'time')} · ${order.customerName}`}
            actions={
              <>
                <Dropdown
                  label="Update order status"
                  trigger={
                    <Button variant="outline">
                      Update status
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  }
                  items={[
                    { label: 'Confirmed', onClick: () => setStatus('confirmed') },
                    { label: 'Processing', onClick: () => setStatus('processing') },
                    { label: 'Partially shipped', onClick: () => setStatus('partially_shipped') },
                    { label: 'Shipped', onClick: () => setStatus('shipped') },
                    { label: 'Delivered', onClick: () => setStatus('delivered') },
                  ]}
                />
                <Button variant="outline" onClick={markPaid}>
                  Mark as paid
                </Button>
                <Button variant="outline" onClick={() => setNoteOpen(true)}>
                  <StickyNote className="h-4 w-4" />
                  Add note
                </Button>
                <Button variant="outline" onClick={() => window.print()}>
                  <Printer className="h-4 w-4" />
                  Print
                </Button>
                <Button variant="danger" onClick={() => { setRefundAmount(String(order.grandTotal)); setRefundOpen(true) }}>
                  Refund
                </Button>
              </>
            }
          />
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <StatusBadge status={order.status} kind="order" />
          <StatusBadge status={order.paymentStatus} kind="payment" />
          <StatusBadge status={order.fulfillmentStatus} kind="fulfillment" />
        </div>
      </div>

      <Alert tone="info" title="Payment status">
        Payment status changes are saved by the backend. Captures and refunds are not sent to a payment
        provider in this environment — a production deployment must route them through the provider.
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle>Fulfilment progress</CardTitle>
        </CardHeader>
        <CardBody>
          <OrderStatusTimeline order={order} />
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Items</CardTitle>
          <span className="text-sm text-ink-500">{order.items.length} item(s)</span>
        </CardHeader>
        <Table>
          <THead>
            <TR>
              <TH>Product</TH>
              <TH>Variant / SKU</TH>
              <TH>Seller</TH>
              <TH>Unit price</TH>
              <TH>Qty</TH>
              <TH>Commission</TH>
              <TH>Line total</TH>
              <TH>Fulfilment</TH>
            </TR>
          </THead>
          <TBody>
            {order.items.map((item) => {
              return (
                <TR key={item.id}>
                  <TD>
                    <div className="flex items-center gap-3">
                      <SmartImage
                        src={item.imageUrl ?? undefined}
                        alt={item.productName}
                        wrapperClassName="h-10 w-10 shrink-0 rounded-lg"
                        fallbackLabel={item.productName}
                      />
                      <Link
                        to={`/product/${item.productSlug}`}
                        className="font-medium text-ink underline-offset-2 hover:underline"
                      >
                        {item.productName}
                      </Link>
                    </div>
                  </TD>
                  <TD>
                    <p className="text-ink-700">{item.variantName}</p>
                    <p className="text-xs text-ink-500">{item.sku}</p>
                  </TD>
                  <TD className="whitespace-nowrap">{sellerNameFor(item.sellerId)}</TD>
                  <TD className="whitespace-nowrap">{formatCurrency(item.unitPrice)}</TD>
                  <TD>{item.quantity}</TD>
                  <TD>{item.sellerCommissionRate}%</TD>
                  <TD className="whitespace-nowrap font-medium text-ink">{formatCurrency(item.unitPrice * item.quantity)}</TD>
                  <TD>
                    <label className="sr-only" htmlFor={`fulfil-${item.id}`}>
                      Fulfilment for {item.productName}
                    </label>
                    <Select
                      id={`fulfil-${item.id}`}
                      value={item.fulfillmentStatus}
                      onChange={(e) => {
                        orderService.updateItemFulfillment(order.id, item.id, e.target.value as OrderItem['fulfillmentStatus'])
                        toast.success('Fulfilment updated', `${item.productName} → ${e.target.value}.`)
                      }}
                      options={FULFILLMENT_OPTIONS}
                      className="w-36"
                    />
                  </TD>
                </TR>
              )
            })}
          </TBody>
        </Table>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Customer</CardTitle>
          </CardHeader>
          <CardBody>
            <DataList
              items={[
                { label: 'Name', value: order.customerName },
                { label: 'Email', value: order.customerEmail },
                { label: 'Phone', value: order.customerPhone },
                { label: 'Account ID', value: order.userId ? `#${order.userId}` : 'Guest checkout' },
              ]}
            />
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Shipping address</CardTitle>
          </CardHeader>
          <CardBody>
            <address className="not-italic text-sm leading-relaxed text-ink-700">
              <p>{order.shippingAddressLine}</p>
              <p>
                {order.shippingDistrict ? `${order.shippingDistrict}, ` : ''}
                {order.shippingCity}
              </p>
              <p>
                {order.shippingRegion}, {order.shippingCountryCode}
              </p>
              {order.shippingPostalCode && <p>Postal code: {order.shippingPostalCode}</p>}
              {order.shippingInstructions && <p className="mt-2 text-ink-500">{order.shippingInstructions}</p>}
            </address>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Payment</CardTitle>
          </CardHeader>
          <CardBody>
            <DataList
              items={[
                { label: 'Method', value: order.paymentMethod ?? '—' },
                { label: 'Status', value: <StatusBadge status={order.paymentStatus} kind="payment" /> },
                { label: 'Amount', value: formatCurrency(order.grandTotal) },
                { label: 'Placed', value: formatDate(order.placedAt, 'time') },
              ]}
            />
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Order summary</CardTitle>
          </CardHeader>
          <CardBody>
            <DataList
              items={[
                { label: 'Subtotal', value: formatCurrency(order.itemsSubtotal) },
                { label: 'Discount', value: order.itemsDiscount ? `− ${formatCurrency(order.itemsDiscount)}` : formatCurrency(0) },
                { label: 'Delivery', value: order.shippingTotal ? formatCurrency(order.shippingTotal) : 'Free' },
                { label: 'VAT', value: formatCurrency(order.taxTotal) },
                { label: 'Total', value: <span className="text-base font-semibold text-ink">{formatCurrency(order.grandTotal)}</span> },
                { label: 'Items', value: formatNumber(order.items.reduce((sum, i) => sum + i.quantity, 0)) },
              ]}
            />
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Order history</CardTitle>
        </CardHeader>
        <CardBody>
          <ol className="space-y-4">
            {[...order.history].reverse().map((event) => (
              <li key={event.id} className="flex gap-3">
                <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-ink" aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-ink">{event.newStatus.replace(/_/g, ' ')}</p>
                  {event.note && <p className="mt-0.5 text-sm text-ink-600">{event.note}</p>}
                  <p className="mt-0.5 text-xs text-ink-400">{formatDate(event.createdAt, 'time')}</p>
                </div>
              </li>
            ))}
          </ol>
        </CardBody>
      </Card>

      {/* Add note */}
      <Modal
        open={noteOpen}
        onClose={() => setNoteOpen(false)}
        title="Add internal note"
        size="md"
        footer={
          <>
            <Button variant="outline" onClick={() => setNoteOpen(false)}>
              Cancel
            </Button>
            <Button onClick={saveNote}>Add note</Button>
          </>
        }
      >
        <Textarea
          label="Note"
          value={noteText}
          onChange={(e) => setNoteText(e.target.value)}
          hint="Visible to staff only. Appended to the order history timeline."
          required
        />
      </Modal>

      {/* Refund */}
      <Modal
        open={refundOpen}
        onClose={() => setRefundOpen(false)}
        title="Record a refund"
        description="Records a refund against this order. It cannot be undone."
        size="md"
        footer={
          <>
            <Button variant="outline" onClick={() => setRefundOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button variant="danger" onClick={submitRefund} loading={busy}>
              Record refund
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <label className="sr-only" htmlFor="refund-amount">
            Refund amount
          </label>
          <input
            id="refund-amount"
            type="number"
            min={0}
            max={order.grandTotal}
            value={refundAmount}
            onChange={(e) => setRefundAmount(e.target.value)}
            className="h-10 w-full rounded-lg border border-ink-200 px-3 text-sm text-ink focus:border-ink focus:outline-none focus:ring-2 focus:ring-ink/60"
            aria-label="Refund amount"
          />
          <Select
            label="Reason"
            value={refundReason}
            onChange={(e) => setRefundReason(e.target.value)}
            options={REFUND_REASONS.map((r) => ({ label: r, value: r }))}
          />
          <p className="text-xs text-ink-500">
            Order total is {formatCurrency(order.grandTotal)}. A full refund marks the payment as refunded; a partial amount marks it partially
            refunded.
          </p>
        </div>
      </Modal>
    </div>
  )
}
