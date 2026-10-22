import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  CheckCircle2,
  Eye,
  MoreHorizontal,
  Package,
  PackageCheck,
  Truck,
} from 'lucide-react'
import {
  Button,
  Card,
  Checkbox,
  Dropdown,
  EmptyState,
  PageHeader,
  Pagination,
  Select,
  StatusBadge,
  Table,
  Tabs,
  TBody,
  TD,
  TH,
  THead,
  TR,
} from '@/components/ui'
import { DataToolbar } from '@/components/tables/DataToolbar'
import { useAuthStore, useSellerOrders } from '@/context'
import { toast } from '@/context/uiStore'
import { orderService, sellerService } from '@/services'
import type { Order, OrderStatus } from '@/types'
import { formatCurrency, formatDate } from '@/lib/utils'

const PAGE_SIZE = 8

const STATUS_OPTIONS = [
  { label: 'All statuses', value: 'all' },
  { label: 'Pending', value: 'pending' },
  { label: 'Confirmed', value: 'confirmed' },
  { label: 'Processing', value: 'processing' },
  { label: 'Shipped', value: 'shipped' },
  { label: 'Delivered', value: 'delivered' },
  { label: 'Cancelled', value: 'cancelled' },
  { label: 'Refunded', value: 'refunded' },
]

const PAYMENT_OPTIONS = [
  { label: 'All payments', value: 'all' },
  { label: 'Unpaid', value: 'unpaid' },
  { label: 'Pending', value: 'pending' },
  { label: 'Paid', value: 'paid' },
  { label: 'Partially refunded', value: 'partially_refunded' },
  { label: 'Refunded', value: 'refunded' },
  { label: 'Failed', value: 'failed' },
]

const DATE_OPTIONS = [
  { label: 'All time', value: 'all' },
  { label: 'Last 7 days', value: '7' },
  { label: 'Last 30 days', value: '30' },
  { label: 'Last 90 days', value: '90' },
]

const TABS = [
  { id: 'all', label: 'All' },
  { id: 'pending', label: 'Pending' },
  { id: 'processing', label: 'Processing' },
  { id: 'shipped', label: 'Shipped' },
  { id: 'delivered', label: 'Delivered' },
  { id: 'cancelled', label: 'Cancelled' },
]

function inTab(order: Order, tab: string) {
  switch (tab) {
    case 'pending':
      return order.status === 'pending'
    case 'processing':
      return order.status === 'confirmed' || order.status === 'processing'
    case 'shipped':
      return order.status === 'shipped' || order.status === 'partially_shipped'
    case 'delivered':
      return order.status === 'delivered'
    case 'cancelled':
      return order.status === 'cancelled' || order.status === 'refunded'
    default:
      return true
  }
}

export default function SellerOrdersPage() {
  const user = useAuthStore((s) => s.session?.user)
  const sellerId = user?.sellerId ?? null
  const orders = useSellerOrders(sellerId)

  useEffect(() => {
    if (!sellerId) return
    void sellerService.fetchSellerOrders({ pageSize: 100 }).catch(() => undefined)
  }, [sellerId])

  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('all')
  const [payment, setPayment] = useState('all')
  const [dateRange, setDateRange] = useState('all')
  const [tab, setTab] = useState('all')
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<number[]>([])

  const sellerItems = (order: Order) => order.items.filter((item) => item.sellerId === sellerId)
  const sellerTotal = (order: Order) =>
    sellerItems(order).reduce((total, item) => total + item.unitPrice * item.quantity, 0)

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase()
    const cutoff =
      dateRange === 'all'
        ? 0
        : Date.now() - Number(dateRange) * 24 * 60 * 60 * 1000

    return orders
      .filter((order) => {
        if (!inTab(order, tab)) return false
        if (status !== 'all' && order.status !== status) return false
        if (payment !== 'all' && order.paymentStatus !== payment) return false
        if (cutoff && new Date(order.placedAt).getTime() < cutoff) return false
        if (needle) {
          const haystack = `${order.orderNumber} ${order.customerName} ${order.customerEmail}`.toLowerCase()
          if (!haystack.includes(needle)) return false
        }
        return true
      })
      .sort((a, b) => new Date(b.placedAt).getTime() - new Date(a.placedAt).getTime())
  }, [orders, search, status, payment, dateRange, tab])

  const tabCounts = useMemo(
    () => Object.fromEntries(TABS.map((item) => [item.id, orders.filter((o) => inTab(o, item.id)).length])),
    [orders],
  )

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const pageItems = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  const allOnPageSelected = pageItems.length > 0 && pageItems.every((o) => selected.includes(o.id))

  const toggleAllOnPage = () => {
    if (allOnPageSelected) {
      setSelected((prev) => prev.filter((id) => !pageItems.some((o) => o.id === id)))
    } else {
      setSelected((prev) => Array.from(new Set([...prev, ...pageItems.map((o) => o.id)])))
    }
  }

  const toggleOne = (id: number) => {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  const updateStatus = async (order: Order, next: OrderStatus, label: string) => {
    await orderService.updateOrderStatus(order.id, next, `Seller marked order as ${next.replace('_', ' ')}`)
    toast.success(label, `${order.orderNumber} updated.`)
  }

  const markSelectedShipped = async () => {
    const targets = orders.filter((order) => selected.includes(order.id))
    await Promise.all(
      targets.map((order) =>
        orderService.updateOrderStatus(order.id, 'shipped', 'Seller marked order as shipped (bulk)'),
      ),
    )
    toast.success('Orders shipped', `${targets.length} orders marked as shipped.`)
    setSelected([])
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Orders"
        description="Orders that contain at least one of your items. Items from other sellers are fulfilled separately."
        actions={<Button to="/seller/products">Manage products</Button>}
      />

      <Tabs
        items={TABS.map((item) => ({
          id: item.id,
          label: item.label,
          badge: tabCounts[item.id] ? <span className="text-xs text-ink-400">{tabCounts[item.id]}</span> : undefined,
        }))}
        value={tab}
        onChange={(id) => {
          setTab(id)
          setPage(1)
        }}
      />

      {selected.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-card border border-ink-200 bg-sand-50 px-4 py-3">
          <span className="text-sm font-medium text-ink">{selected.length} selected</span>
          <Button size="sm" variant="outline" onClick={markSelectedShipped}>
            <Truck className="h-3.5 w-3.5" aria-hidden="true" />
            Mark selected as shipped
          </Button>
          <Button size="sm" variant="ghost" className="ml-auto" onClick={() => setSelected([])}>
            Clear
          </Button>
        </div>
      )}

      <Card>
        <DataToolbar
          searchValue={search}
          onSearchChange={(value) => {
            setSearch(value)
            setPage(1)
          }}
          searchPlaceholder="Search by order number or customer"
        >
          <Select
            aria-label="Filter by status"
            value={status}
            options={STATUS_OPTIONS}
            onChange={(event) => {
              setStatus(event.target.value)
              setPage(1)
            }}
          />
          <Select
            aria-label="Filter by payment status"
            value={payment}
            options={PAYMENT_OPTIONS}
            onChange={(event) => {
              setPayment(event.target.value)
              setPage(1)
            }}
          />
          <Select
            aria-label="Filter by date range"
            value={dateRange}
            options={DATE_OPTIONS}
            onChange={(event) => {
              setDateRange(event.target.value)
              setPage(1)
            }}
          />
        </DataToolbar>

        {pageItems.length === 0 ? (
          <div className="p-5">
            <EmptyState
              icon={<Package className="h-5 w-5" />}
              title={orders.length === 0 ? 'No orders yet' : 'No orders match your filters'}
              description={
                orders.length === 0
                  ? 'When a customer buys one of your products, the order will appear here.'
                  : 'Try a different status, payment or date range.'
              }
            />
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden md:block">
              <Table>
                <THead>
                  <TR>
                    <TH className="w-10">
                      <Checkbox
                        aria-label="Select all orders on this page"
                        checked={allOnPageSelected}
                        onChange={toggleAllOnPage}
                      />
                    </TH>
                    <TH>Order</TH>
                    <TH>Customer</TH>
                    <TH>Date</TH>
                    <TH>Items</TH>
                    <TH>Seller total</TH>
                    <TH>Payment</TH>
                    <TH>Fulfillment</TH>
                    <TH>Status</TH>
                    <TH className="text-right">Actions</TH>
                  </TR>
                </THead>
                <TBody>
                  {pageItems.map((order) => {
                    const items = sellerItems(order)
                    return (
                      <TR key={order.id}>
                        <TD>
                          <Checkbox
                            aria-label={`Select ${order.orderNumber}`}
                            checked={selected.includes(order.id)}
                            onChange={() => toggleOne(order.id)}
                          />
                        </TD>
                        <TD>
                          <Link to={`/seller/orders/${order.id}`} className="font-medium text-ink hover:underline">
                            {order.orderNumber}
                          </Link>
                        </TD>
                        <TD className="max-w-[12rem]">
                          <span className="block truncate">{order.customerName}</span>
                        </TD>
                        <TD className="whitespace-nowrap text-ink-500">{formatDate(order.placedAt)}</TD>
                        <TD>
                          <div className="flex items-center gap-2">
                            <span className="flex h-8 w-8 overflow-hidden rounded-md bg-ink-100">
                              {items[0]?.imageUrl ? (
                                <img src={items[0].imageUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
                              ) : null}
                            </span>
                            <span className="text-sm text-ink-500">
                              {items.length} item{items.length === 1 ? '' : 's'}
                            </span>
                          </div>
                        </TD>
                        <TD className="whitespace-nowrap font-medium text-ink">{formatCurrency(sellerTotal(order))}</TD>
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
                            align="right"
                            label={`Actions for ${order.orderNumber}`}
                            trigger={
                              <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-ink-500 transition hover:bg-ink-100 hover:text-ink">
                                <MoreHorizontal className="h-4 w-4" />
                              </span>
                            }
                            items={[
                              { label: 'View order', to: `/seller/orders/${order.id}`, icon: <Eye className="h-4 w-4" /> },
                              {
                                label: 'Mark as processing',
                                icon: <PackageCheck className="h-4 w-4" />,
                                onClick: () => updateStatus(order, 'processing', 'Marked as processing'),
                              },
                              {
                                label: 'Mark as shipped',
                                icon: <Truck className="h-4 w-4" />,
                                onClick: () => updateStatus(order, 'shipped', 'Marked as shipped'),
                              },
                              {
                                label: 'Mark as delivered',
                                icon: <CheckCircle2 className="h-4 w-4" />,
                                onClick: () => updateStatus(order, 'delivered', 'Marked as delivered'),
                              },
                            ]}
                          />
                        </TD>
                      </TR>
                    )
                  })}
                </TBody>
              </Table>
            </div>

            {/* Mobile cards */}
            <ul className="divide-y divide-ink-100 md:hidden">
              {pageItems.map((order) => {
                const items = sellerItems(order)
                return (
                  <li key={order.id} className="space-y-3 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <Link to={`/seller/orders/${order.id}`} className="font-medium text-ink hover:underline">
                          {order.orderNumber}
                        </Link>
                        <p className="mt-0.5 text-sm text-ink-500">{order.customerName}</p>
                        <p className="text-xs text-ink-400">{formatDate(order.placedAt)}</p>
                      </div>
                      <StatusBadge status={order.status} kind="order" />
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm text-ink-500">
                        {items.length} item{items.length === 1 ? '' : 's'}
                      </span>
                      <span className="font-medium text-ink">{formatCurrency(sellerTotal(order))}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusBadge status={order.paymentStatus} kind="payment" />
                      <StatusBadge status={order.fulfillmentStatus} kind="fulfillment" />
                    </div>
                    <Button size="sm" variant="outline" to={`/seller/orders/${order.id}`} fullWidth>
                      View order
                    </Button>
                  </li>
                )
              })}
            </ul>

            <div className="border-t border-ink-200 p-4">
              <Pagination
                page={safePage}
                totalPages={totalPages}
                onPageChange={setPage}
                totalItems={filtered.length}
                pageSize={PAGE_SIZE}
              />
            </div>
          </>
        )}
      </Card>
    </div>
  )
}
