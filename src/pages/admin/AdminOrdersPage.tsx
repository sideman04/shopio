import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Ban, Download, MoreHorizontal, Receipt, Truck } from 'lucide-react'
import {
  Button,
  Checkbox,
  ConfirmDialog,
  Dropdown,
  EmptyState,
  PageHeader,
  Pagination,
  Select,
  SmartImage,
  StatCard,
  StatusBadge,
  TBody,
  TD,
  TH,
  THead,
  TR,
  Table,
} from '@/components/ui'
import { DataToolbar } from '@/components/tables/DataToolbar'
import { orderService } from '@/services'
import { useOrderStore } from '@/context/orderStore'
import { toast } from '@/context/uiStore'
import type { Order, OrderStatus } from '@/types'
import { formatCurrency, formatDate, formatNumber } from '@/lib/utils'

const PAGE_SIZE = 8

function downloadCsv(filename: string, rows: Array<Array<string | number>>) {
  const csv = rows
    .map((row) =>
      row
        .map((cell) => {
          const value = String(cell ?? '')
          return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value
        })
        .join(','),
    )
    .join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

/** Platform order book with fulfilment and payment controls. */
export default function AdminOrdersPage() {
  const orders = useOrderStore((s) => s.orders)

  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('all')
  const [payment, setPayment] = useState('all')
  const [fulfillment, setFulfillment] = useState('all')
  const [range, setRange] = useState('all')
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<number[]>([])

  const [cancelTarget, setCancelTarget] = useState<Order | null>(null)
  const [bulk, setBulk] = useState<'shipped' | 'cancelled' | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    setPage(1)
  }, [search, status, payment, fulfillment, range])

  useEffect(() => {
    void orderService.queryOrders({ pageSize: 100, scope: 'admin' }).catch(() => undefined)
  }, [])

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase()
    const cutoff =
      range === 'all'
        ? null
        : Date.now() - Number(range) * 24 * 60 * 60 * 1000

    return orders
      .filter((order) => {
        if (status !== 'all' && order.status !== status) return false
        if (payment !== 'all' && order.paymentStatus !== payment) return false
        if (fulfillment !== 'all' && order.fulfillmentStatus !== fulfillment) return false
        if (cutoff && new Date(order.placedAt).getTime() < cutoff) return false
        if (needle) {
          const haystack = [order.orderNumber, order.customerName, order.customerEmail].join(' ').toLowerCase()
          if (!haystack.includes(needle)) return false
        }
        return true
      })
      .sort((a, b) => new Date(b.placedAt).getTime() - new Date(a.placedAt).getTime())
  }, [orders, search, status, payment, fulfillment, range])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const paged = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  const stats = useMemo(() => {
    const revenue = orders.reduce((sum, o) => sum + o.grandTotal, 0)
    return {
      total: orders.length,
      revenue,
      aov: orders.length ? Math.round(revenue / orders.length) : 0,
      pending: orders.filter((o) => o.status === 'pending').length,
      delivered: orders.filter((o) => o.status === 'delivered').length,
      closed: orders.filter((o) => o.status === 'refunded' || o.status === 'cancelled').length,
    }
  }, [orders])

  const allOnPageSelected = paged.length > 0 && paged.every((o) => selected.includes(o.id))

  const toggleOne = (id: number) =>
    setSelected((current) => (current.includes(id) ? current.filter((x) => x !== id) : [...current, id]))

  const togglePage = () => {
    if (allOnPageSelected) {
      setSelected((current) => current.filter((id) => !paged.some((o) => o.id === id)))
    } else {
      setSelected((current) => Array.from(new Set([...current, ...paged.map((o) => o.id)])))
    }
  }

  const changeStatus = async (order: Order, next: OrderStatus) => {
    await orderService.updateOrderStatus(order.id, next)
    toast.success('Order updated', `${order.orderNumber} is now ${next.replace(/_/g, ' ')}.`)
  }

  const markPaid = async (order: Order) => {
    await orderService.updatePaymentStatus(order.id, 'paid')
    toast.success('Payment marked as paid', `Payment for ${order.orderNumber} was marked as paid.`)
  }

  const cancel = async (order: Order) => {
    await orderService.updateOrderStatus(order.id, 'cancelled')
    toast.success('Order cancelled', `${order.orderNumber} was cancelled.`)
    setCancelTarget(null)
  }

  const runBulk = async () => {
    if (!bulk) return
    setBusy(true)
    try {
      await Promise.all(selected.map((id) => orderService.updateOrderStatus(id, bulk)))
      toast.success(
        bulk === 'shipped' ? 'Orders marked as shipped' : 'Orders cancelled',
        `${selected.length} order(s) updated.`,
      )
      setBulk(null)
      setSelected([])
    } finally {
      setBusy(false)
    }
  }

  const handleExport = () => {
    downloadCsv('shopio-orders.csv', [
      ['Order', 'Customer', 'Email', 'Placed', 'Items', 'Total', 'Payment', 'Fulfillment', 'Status'],
      ...filtered.map((o) => [
        o.orderNumber,
        o.customerName,
        o.customerEmail,
        o.placedAt,
        o.items.length,
        o.grandTotal,
        o.paymentStatus,
        o.fulfillmentStatus,
        o.status,
      ]),
    ])
    toast.success('Export ready', `${filtered.length} orders exported to CSV.`)
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Orders"
        description="Track every order, update fulfilment and reconcile payments."
        actions={
          <Button variant="outline" onClick={handleExport}>
            <Download className="h-4 w-4" />
            Export CSV
          </Button>
        }
      />

      <section aria-label="Order summary" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <StatCard label="Total orders" value={formatNumber(stats.total)} icon={<Receipt className="h-4 w-4" />} hint="all time" />
        <StatCard label="Revenue" value={formatCurrency(stats.revenue, { compact: true })} icon={<Receipt className="h-4 w-4" />} hint="gross total" />
        <StatCard label="Average order value" value={formatCurrency(stats.aov, { compact: true })} icon={<Receipt className="h-4 w-4" />} hint="per order" />
        <StatCard label="Pending" value={formatNumber(stats.pending)} icon={<Receipt className="h-4 w-4" />} hint="awaiting action" />
        <StatCard label="Delivered" value={formatNumber(stats.delivered)} icon={<Truck className="h-4 w-4" />} hint="completed" />
        <StatCard label="Refunded / cancelled" value={formatNumber(stats.closed)} icon={<Ban className="h-4 w-4" />} hint="closed" />
      </section>

      <div className="rounded-card border border-ink-200 bg-white shadow-card">
        <DataToolbar searchValue={search} onSearchChange={setSearch} searchPlaceholder="Search order, customer or email">
          <label className="sr-only" htmlFor="orders-status-filter">Status</label>
          <Select
            id="orders-status-filter"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            options={[
              { label: 'All statuses', value: 'all' },
              { label: 'Pending', value: 'pending' },
              { label: 'Confirmed', value: 'confirmed' },
              { label: 'Processing', value: 'processing' },
              { label: 'Shipped', value: 'shipped' },
              { label: 'Delivered', value: 'delivered' },
              { label: 'Cancelled', value: 'cancelled' },
              { label: 'Refunded', value: 'refunded' },
            ]}
            className="w-40"
          />
          <label className="sr-only" htmlFor="orders-payment-filter">Payment</label>
          <Select
            id="orders-payment-filter"
            value={payment}
            onChange={(e) => setPayment(e.target.value)}
            options={[
              { label: 'All payments', value: 'all' },
              { label: 'Unpaid', value: 'unpaid' },
              { label: 'Pending', value: 'pending' },
              { label: 'Paid', value: 'paid' },
              { label: 'Partially refunded', value: 'partially_refunded' },
              { label: 'Refunded', value: 'refunded' },
              { label: 'Failed', value: 'failed' },
            ]}
            className="w-44"
          />
          <label className="sr-only" htmlFor="orders-fulfillment-filter">Fulfilment</label>
          <Select
            id="orders-fulfillment-filter"
            value={fulfillment}
            onChange={(e) => setFulfillment(e.target.value)}
            options={[
              { label: 'All fulfilment', value: 'all' },
              { label: 'Unfulfilled', value: 'unfulfilled' },
              { label: 'Partial', value: 'partial' },
              { label: 'Fulfilled', value: 'fulfilled' },
              { label: 'Returned', value: 'returned' },
            ]}
            className="w-44"
          />
          <label className="sr-only" htmlFor="orders-range-filter">Date range</label>
          <Select
            id="orders-range-filter"
            value={range}
            onChange={(e) => setRange(e.target.value)}
            options={[
              { label: 'All time', value: 'all' },
              { label: 'Last 7 days', value: '7' },
              { label: 'Last 30 days', value: '30' },
              { label: 'Last 90 days', value: '90' },
            ]}
            className="w-40"
          />
        </DataToolbar>

        {selected.length > 0 && (
          <div className="flex flex-wrap items-center gap-3 border-b border-ink-200 bg-sand-50 px-4 py-3">
            <p className="text-sm font-medium text-ink">{selected.length} selected</p>
            <div className="ml-auto flex flex-wrap gap-2">
              <Button size="sm" onClick={() => setBulk('shipped')}>
                <Truck className="h-4 w-4" />
                Mark as shipped
              </Button>
              <Button size="sm" variant="danger" onClick={() => setBulk('cancelled')}>
                Cancel orders
              </Button>
            </div>
          </div>
        )}

        {paged.length === 0 ? (
          <div className="p-6">
            <EmptyState
              size="sm"
              icon={<Receipt className="h-5 w-5" />}
              title="No orders match your filters"
              description="Adjust the search or filters to find orders."
            />
          </div>
        ) : (
          <>
            {/* Mobile cards */}
            <div className="divide-y divide-ink-100 md:hidden">
              {paged.map((order) => (
                <div key={order.id} className="space-y-3 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <Link to={`/admin/orders/${order.id}`} className="font-medium text-ink underline-offset-2 hover:underline">
                        {order.orderNumber}
                      </Link>
                      <p className="text-xs text-ink-500">{formatDate(order.placedAt, 'time')}</p>
                    </div>
                    <StatusBadge status={order.status} kind="order" />
                  </div>
                  <p className="text-sm text-ink-700">{order.customerName}</p>
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge status={order.paymentStatus} kind="payment" />
                    <StatusBadge status={order.fulfillmentStatus} kind="fulfillment" />
                    <span className="ml-auto text-sm font-semibold text-ink">{formatCurrency(order.grandTotal)}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop table */}
            <div className="hidden md:block">
              <Table>
                <THead>
                  <TR>
                    <TH className="w-10">
                      <Checkbox checked={allOnPageSelected} onChange={togglePage} aria-label="Select all orders on this page" />
                    </TH>
                    <TH>Order</TH>
                    <TH>Customer</TH>
                    <TH>Date</TH>
                    <TH>Items</TH>
                    <TH>Total</TH>
                    <TH>Payment</TH>
                    <TH>Fulfilment</TH>
                    <TH>Status</TH>
                    <TH className="text-right">Actions</TH>
                  </TR>
                </THead>
                <TBody>
                  {paged.map((order) => (
                    <TR key={order.id}>
                      <TD>
                        <Checkbox
                          checked={selected.includes(order.id)}
                          onChange={() => toggleOne(order.id)}
                          aria-label={`Select ${order.orderNumber}`}
                        />
                      </TD>
                      <TD>
                        <Link to={`/admin/orders/${order.id}`} className="font-medium text-ink underline-offset-2 hover:underline">
                          {order.orderNumber}
                        </Link>
                      </TD>
                      <TD>
                        <p className="truncate font-medium text-ink-700">{order.customerName}</p>
                        <p className="truncate text-xs text-ink-500">{order.customerEmail}</p>
                      </TD>
                      <TD className="whitespace-nowrap">{formatDate(order.placedAt)}</TD>
                      <TD>
                        <div className="flex items-center gap-2">
                          <div className="flex -space-x-2">
                            {order.items.slice(0, 3).map((item) => (
                              <SmartImage
                                key={item.id}
                                src={item.imageUrl ?? undefined}
                                alt={item.productName}
                                wrapperClassName="h-7 w-7 rounded-full ring-2 ring-white"
                                fallbackLabel={item.productName}
                              />
                            ))}
                          </div>
                          <span className="text-xs text-ink-500">{order.items.length}</span>
                        </div>
                      </TD>
                      <TD className="whitespace-nowrap font-medium text-ink">{formatCurrency(order.grandTotal)}</TD>
                      <TD>
                        <StatusBadge status={order.paymentStatus} kind="payment" />
                      </TD>
                      <TD>
                        <StatusBadge status={order.fulfillmentStatus} kind="fulfillment" />
                      </TD>
                      <TD>
                        <StatusBadge status={order.status} kind="order" />
                      </TD>
                      <TD className="text-right">
                        <Dropdown
                          label={`Actions for ${order.orderNumber}`}
                          trigger={
                            <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-ink-500 hover:bg-ink-100 hover:text-ink">
                              <MoreHorizontal className="h-4 w-4" />
                            </span>
                          }
                          items={[
                            { label: 'View details', to: `/admin/orders/${order.id}` },
                            { label: 'Mark confirmed', divider: true, onClick: () => changeStatus(order, 'confirmed') },
                            { label: 'Mark processing', onClick: () => changeStatus(order, 'processing') },
                            { label: 'Mark shipped', onClick: () => changeStatus(order, 'shipped') },
                            { label: 'Mark delivered', onClick: () => changeStatus(order, 'delivered') },
                            {
                              label: 'Mark as paid',
                              divider: true,
                              onClick: () => markPaid(order),
                            },
                            {
                              label: 'Cancel order',
                              tone: 'danger',
                              onClick: () => setCancelTarget(order),
                            },
                          ]}
                        />
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </div>

            <div className="p-4">
              <Pagination page={safePage} totalPages={totalPages} onPageChange={setPage} totalItems={filtered.length} pageSize={PAGE_SIZE} />
            </div>
          </>
        )}
      </div>

      <p className="text-xs text-ink-500">
        Status and payment changes are written to the order history and the audit log.
      </p>

      <ConfirmDialog
        open={!!cancelTarget}
        onClose={() => setCancelTarget(null)}
        onConfirm={() => cancelTarget && cancel(cancelTarget)}
        title={cancelTarget ? `Cancel ${cancelTarget.orderNumber}?` : ''}
        description="Cancelling an order stops fulfilment. The payment status is not refunded automatically."
        confirmLabel="Cancel order"
        tone="danger"
      />

      <ConfirmDialog
        open={!!bulk}
        onClose={() => setBulk(null)}
        onConfirm={runBulk}
        title={bulk === 'shipped' ? 'Mark selected orders as shipped?' : 'Cancel selected orders?'}
        description={`This affects ${selected.length} order(s).`}
        confirmLabel={bulk === 'shipped' ? 'Mark shipped' : 'Cancel orders'}
        tone={bulk === 'shipped' ? 'default' : 'danger'}
        loading={busy}
      />
    </div>
  )
}
