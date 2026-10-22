import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Eye, MoreHorizontal, Package, RotateCcw, XCircle } from 'lucide-react'
import type { Order } from '@/types'
import {
  Button,
  Card,
  ConfirmDialog,
  Dropdown,
  EmptyState,
  PageHeader,
  Pagination,
  Select,
  StatusBadge,
  Table,
  TBody,
  TD,
  TH,
  THead,
  TR,
} from '@/components/ui'
import { DataToolbar } from '@/components/tables/DataToolbar'
import { toast, useAuthStore, useCustomerOrders } from '@/context'
import { cartService, orderService, productService } from '@/services'
import { formatCurrency, formatDate } from '@/lib/utils'

const PAGE_SIZE = 5

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

/**
 * Order history for the signed-in customer. The API returns summaries for the
 * list; full item details are loaded on demand when an order is re-ordered.
 */
export default function AccountOrdersPage() {
  const user = useAuthStore((s) => s.session?.user)
  const orders = useCustomerOrders(user?.id)

  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('all')
  const [page, setPage] = useState(1)
  const [cancelId, setCancelId] = useState<number | null>(null)
  const [cancelling, setCancelling] = useState(false)

  useEffect(() => {
    if (!user) return
    void orderService
      .queryOrders({ pageSize: 100, scope: 'customer' })
      .catch((error) =>
        toast.error('Could not load orders', error instanceof Error ? error.message : 'Please try again.'),
      )
  }, [user])

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase()
    return [...orders]
      .filter((order) => {
        if (status !== 'all' && order.status !== status) return false
        if (!needle) return true
        return (
          order.orderNumber.toLowerCase().includes(needle) ||
          order.items.some((item) => item.productName.toLowerCase().includes(needle))
        )
      })
      .sort((a, b) => new Date(b.placedAt).getTime() - new Date(a.placedAt).getTime())
  }, [orders, search, status])

  useEffect(() => {
    setPage(1)
  }, [search, status])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const paged = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  const handleBuyAgain = async (order: Order) => {
    let added = 0
    let skipped = 0
    try {
      const detail = await orderService.getOrder(order.id, 'customer')
      if (!detail) {
        toast.error('Could not load order', 'The order details are unavailable right now.')
        return
      }

      for (const item of detail.items) {
        const product = item.productSlug
          ? await productService.getProductBySlug(item.productSlug)
          : undefined
        const variant =
          product?.variants.find((v) => v.id === item.variantId) ??
          product?.variants.find((v) => v.isDefault) ??
          product?.variants[0]

        if (!product || !variant || variant.stock <= 0) {
          skipped += 1
          continue
        }
        await cartService.addToCart(product, variant, item.quantity)
        added += 1
      }

      if (added > 0) {
        toast.success(
          'Added to cart',
          `${added} ${added === 1 ? 'item' : 'items'} from ${order.orderNumber} added.`,
          { label: 'View cart', href: '/cart' },
        )
      }
      if (skipped > 0) {
        toast.warning(
          'Some items unavailable',
          `${skipped} ${skipped === 1 ? 'item is' : 'items are'} out of stock and were skipped.`,
        )
      }
      if (added === 0 && skipped === 0) {
        toast.error('Nothing to add', 'This order has no items to re-order.')
      }
    } catch (error) {
      toast.error('Could not re-order', error instanceof Error ? error.message : 'Please try again.')
    }
  }

  const confirmCancel = async () => {
    if (cancelId == null) return
    setCancelling(true)
    try {
      await orderService.updateOrderStatus(cancelId, 'cancelled', 'Cancelled by customer')
      toast.success('Order cancelled', 'The order has been marked as cancelled.')
    } catch (error) {
      toast.error('Could not cancel order', error instanceof Error ? error.message : 'Please try again.')
    } finally {
      setCancelling(false)
      setCancelId(null)
    }
  }

  const canCancel = (order: Order) => order.status === 'pending' || order.status === 'confirmed'

  const renderActions = (order: Order) => (
    <Dropdown
      align="right"
      label={`Actions for order ${order.orderNumber}`}
      trigger={
        <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-ink-200 text-ink-600 transition hover:bg-ink-50">
          <MoreHorizontal className="h-4 w-4" />
        </span>
      }
      items={[
        { label: 'View details', to: `/account/orders/${order.id}`, icon: <Eye className="h-4 w-4" /> },
        { label: 'Buy again', onClick: () => handleBuyAgain(order), icon: <RotateCcw className="h-4 w-4" /> },
        {
          label: 'Cancel order',
          onClick: () => setCancelId(order.id),
          icon: <XCircle className="h-4 w-4" />,
          tone: 'danger',
          divider: true,
          disabled: !canCancel(order),
        },
      ]}
    />
  )

  return (
    <div className="space-y-6">
      <PageHeader
        title="Order history"
        description="Track deliveries, review past purchases and re-order your favourites."
      />

      {orders.length === 0 ? (
        <EmptyState
          icon={<Package className="h-5 w-5" />}
          title="No orders yet"
          description="Once you place an order it will show up here with its delivery status."
          action={{ label: 'Start shopping', to: '/shop' }}
        />
      ) : (
        <Card>
          <DataToolbar
            searchValue={search}
            onSearchChange={setSearch}
            searchPlaceholder="Search by order number or product"
          >
            <Select
              aria-label="Filter by status"
              className="w-44"
              options={STATUS_OPTIONS}
              value={status}
              onChange={(event) => setStatus(event.target.value)}
            />
          </DataToolbar>

          {filtered.length === 0 ? (
            <div className="p-5">
              <EmptyState
                size="sm"
                title="No matching orders"
                description="Try a different search term or clear the status filter."
                action={{ label: 'Clear filters', onClick: () => { setSearch(''); setStatus('all') } }}
              />
            </div>
          ) : (
            <>
              {/* Desktop table */}
              <div className="hidden md:block">
                <Table>
                  <THead>
                    <TR>
                      <TH>Order</TH>
                      <TH>Date</TH>
                      <TH>Items</TH>
                      <TH>Total</TH>
                      <TH>Payment</TH>
                      <TH>Status</TH>
                      <TH className="text-right">Actions</TH>
                    </TR>
                  </THead>
                  <TBody>
                    {paged.map((order) => (
                      <TR key={order.id}>
                        <TD>
                          <Link
                            to={`/account/orders/${order.id}`}
                            className="font-medium text-ink hover:underline"
                          >
                            {order.orderNumber}
                          </Link>
                        </TD>
                        <TD className="whitespace-nowrap">{formatDate(order.placedAt)}</TD>
                        <TD>
                          <div className="flex items-center gap-2 text-ink-500">
                            <Package className="h-4 w-4" aria-hidden="true" />
                            <span className="text-xs">
                              {order.itemCount ?? order.items.length}{' '}
                              {(order.itemCount ?? order.items.length) === 1 ? 'item' : 'items'}
                            </span>
                          </div>
                        </TD>
                        <TD className="whitespace-nowrap font-semibold text-ink">
                          {formatCurrency(order.grandTotal)}
                        </TD>
                        <TD>
                          <StatusBadge status={order.paymentStatus} kind="payment" />
                        </TD>
                        <TD>
                          <StatusBadge status={order.status} kind="order" />
                        </TD>
                        <TD className="text-right">{renderActions(order)}</TD>
                      </TR>
                    ))}
                  </TBody>
                </Table>
              </div>

              {/* Mobile cards */}
              <ul className="divide-y divide-ink-100 md:hidden">
                {paged.map((order) => (
                  <li key={order.id} className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <Link
                          to={`/account/orders/${order.id}`}
                          className="block truncate text-sm font-semibold text-ink hover:underline"
                        >
                          {order.orderNumber}
                        </Link>
                        <p className="mt-0.5 text-xs text-ink-500">{formatDate(order.placedAt)}</p>
                      </div>
                      {renderActions(order)}
                    </div>
                    <div className="mt-3 flex items-center gap-3">
                      <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-ink-50 text-ink-500">
                        <Package className="h-5 w-5" aria-hidden="true" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs text-ink-500">
                          {order.itemCount ?? order.items.length}{' '}
                          {(order.itemCount ?? order.items.length) === 1 ? 'item' : 'items'}
                        </p>
                        <p className="text-sm font-semibold text-ink">{formatCurrency(order.grandTotal)}</p>
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <StatusBadge status={order.status} kind="order" />
                      <StatusBadge status={order.paymentStatus} kind="payment" />
                    </div>
                  </li>
                ))}
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
      )}

      <ConfirmDialog
        open={cancelId != null}
        onClose={() => setCancelId(null)}
        onConfirm={confirmCancel}
        title="Cancel this order?"
        description="The order will be cancelled and any reserved stock released."
        confirmLabel="Cancel order"
        cancelLabel="Keep order"
        tone="danger"
        loading={cancelling}
      />
    </div>
  )
}
