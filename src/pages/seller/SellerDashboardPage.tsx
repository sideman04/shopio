import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertTriangle,
  Boxes,
  MessageSquare,
  Package,
  Plus,
  Star,
  TrendingUp,
  Wallet,
} from 'lucide-react'
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  EmptyState,
  Modal,
  PageHeader,
  QuantitySelector,
  Stars,
  StatCard,
  StatusBadge,
  Table,
  TBody,
  TD,
  Textarea,
  TH,
  THead,
  TR,
} from '@/components/ui'
import { AreaRevenueChart, BarSeriesChart, ChartCard } from '@/components/charts/Charts'
import { DateRangeFilter, type RangeKey } from '@/components/dashboard/DateRangeFilter'
import {
  useAuthStore,
  useCatalogStore,
  useSeller,
  useSellerOrders,
  useSellerProducts,
} from '@/context'
import { toast } from '@/context/uiStore'
import { reviewService, sellerService } from '@/services'
import type { Product, ProductVariant, Review } from '@/types'
import { formatCurrency, formatDate, formatNumber, relativeTime } from '@/lib/utils'

interface RestockTarget {
  product: Product
  variant: ProductVariant
}

export default function SellerDashboardPage() {
  const user = useAuthStore((s) => s.session?.user)
  const sellerId = user?.sellerId ?? null
  const seller = useSeller(sellerId)
  const products = useSellerProducts(sellerId)
  const orders = useSellerOrders(sellerId)
  const reviews = useCatalogStore((s) => s.reviews)

  const [range, setRange] = useState<RangeKey>('30d')
  const [analytics, setAnalytics] = useState<sellerService.SellerAnalytics | null>(null)

  const days = range === '7d' ? 7 : range === '30d' ? 30 : range === '90d' ? 90 : 365

  useEffect(() => {
    let active = true
    sellerService
      .fetchSellerAnalytics(days)
      .then((result) => active && setAnalytics(result))
      .catch(() => active && setAnalytics(null))
    return () => {
      active = false
    }
  }, [days])

  useEffect(() => {
    if (!sellerId) return
    void Promise.allSettled([
      sellerService.fetchStore(),
      sellerService.fetchSellerProducts({ pageSize: 100 }),
      sellerService.fetchSellerOrders({ pageSize: 100 }),
      reviewService.fetchSellerReviews({ pageSize: 100 }),
    ])
  }, [sellerId])

  const [restock, setRestock] = useState<RestockTarget | null>(null)
  const [restockQty, setRestockQty] = useState(10)
  const [savingRestock, setSavingRestock] = useState(false)

  const [replyTarget, setReplyTarget] = useState<Review | null>(null)
  const [replyText, setReplyText] = useState('')
  const [savingReply, setSavingReply] = useState(false)

  const lowStock = useMemo(
    () =>
      products
        .flatMap((product) => product.variants.map((variant) => ({ product, variant })))
        .filter(({ variant }) => variant.stock <= variant.lowStockThreshold),
    [products],
  )

  const sellerRevenue = useMemo(
    () =>
      orders.reduce(
        (total, order) =>
          total +
          order.items
            .filter((item) => item.sellerId === sellerId)
            .reduce((lineTotal, item) => lineTotal + item.unitPrice * item.quantity, 0),
        0,
      ),
    [orders, sellerId],
  )

  const recentOrders = useMemo(
    () =>
      [...orders]
        .sort((a, b) => new Date(b.placedAt).getTime() - new Date(a.placedAt).getTime())
        .slice(0, 5),
    [orders],
  )

  const productIds = useMemo(() => new Set(products.map((p) => p.id)), [products])

  const sellerReviews = useMemo(
    () =>
      reviews
        .filter((review) => productIds.has(review.productId))
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [reviews, productIds],
  )

  const topProducts = useMemo(
    () => [...products].sort((a, b) => b.soldCount - a.soldCount).slice(0, 5),
    [products],
  )

  const revenueData = analytics?.series ?? []

  const pendingOrders = orders.filter((o) => o.status === 'pending' || o.status === 'processing').length
  const averageOrderValue = orders.length ? Math.round(sellerRevenue / orders.length) : 0

  const openRestock = (product: Product, variant: ProductVariant) => {
    setRestock({ product, variant })
    setRestockQty(10)
  }

  const confirmRestock = async () => {
    if (!restock) return
    setSavingRestock(true)
    await sellerService.adjustStock(restock.variant.id, restockQty, restock.product.name)
    setSavingRestock(false)
    toast.success('Stock updated', `${restock.product.name} — added ${restockQty} units.`)
    setRestock(null)
  }

  const openReply = (review: Review) => {
    setReplyTarget(review)
    setReplyText(review.sellerReply ?? '')
  }

  const confirmReply = async () => {
    if (!replyTarget || !replyText.trim()) {
      toast.error('Reply required', 'Write a short reply before saving.')
      return
    }
    setSavingReply(true)
    await reviewService.replyToReview(replyTarget.id, replyText.trim())
    setSavingReply(false)
    toast.success('Reply published', 'Your response is now visible on the product page.')
    setReplyTarget(null)
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description={`Welcome back, ${user?.fullName?.split(' ')[0] ?? 'seller'}. Here's how ${seller?.storeName ?? 'your store'} is performing.`}
        actions={
          <>
            <DateRangeFilter value={range} onChange={setRange} />
            <Button to="/seller/products/new">
              <Plus className="h-4 w-4" aria-hidden="true" />
              Add product
            </Button>
          </>
        }
      />

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Total sales"
          value={formatCurrency(analytics?.totals.earnedNet ?? sellerRevenue, { compact: true })}
          icon={<Wallet className="h-4 w-4" aria-hidden="true" />}
        />
        <StatCard
          label="Net revenue"
          value={formatCurrency(sellerRevenue || (analytics?.totals.earnedNet ?? 0), { compact: true })}
          hint="After commission"
          icon={<TrendingUp className="h-4 w-4" aria-hidden="true" />}
        />
        <StatCard
          label="Orders"
          value={formatNumber(orders.length)}
          hint={`${pendingOrders} awaiting action`}
          icon={<Package className="h-4 w-4" aria-hidden="true" />}
        />
        <StatCard
          label="Products listed"
          value={formatNumber(products.length)}
          hint={`${products.filter((p) => p.status === 'active').length} active`}
          icon={<Boxes className="h-4 w-4" aria-hidden="true" />}
        />
        <StatCard
          label="Pending orders"
          value={formatNumber(pendingOrders)}
          icon={<Package className="h-4 w-4" aria-hidden="true" />}
        />
        <StatCard
          label="Low stock"
          value={formatNumber(lowStock.length)}
          hint="Variants at or below threshold"
          icon={<AlertTriangle className="h-4 w-4" aria-hidden="true" />}
        />
        <StatCard
          label="Average order value"
          value={formatCurrency(averageOrderValue)}
          icon={<TrendingUp className="h-4 w-4" aria-hidden="true" />}
        />
        <StatCard
          label="Available for payout"
          value={formatCurrency(analytics?.totals.availableForPayout ?? 0, { compact: true })}
          icon={<Wallet className="h-4 w-4" aria-hidden="true" />}
        />
      </div>

      {/* Charts */}
      <div className="grid gap-6 lg:grid-cols-2">
        <ChartCard
          title="Sales performance"
          description="Revenue for the selected period"
          height={280}
        >
          <AreaRevenueChart
            data={revenueData}
            label="Revenue"
            dataKey="revenue"
            height={280}
            ariaLabel="Revenue over the selected period"
          />
        </ChartCard>

        <ChartCard title="Orders per period" description="Order volume over the selected period" height={280}>
          <BarSeriesChart
            data={revenueData}
            dataKey="orders"
            label="Orders"
            valueFormat="number"
            height={280}
            ariaLabel="Weekly order volume"
          />
        </ChartCard>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Recent orders */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Recent orders</CardTitle>
            <Link to="/seller/orders" className="text-sm font-medium text-ink link-underline">
              View all
            </Link>
          </CardHeader>
          {recentOrders.length === 0 ? (
            <CardBody>
              <EmptyState
                size="sm"
                icon={<Package className="h-5 w-5" />}
                title="No orders yet"
                description="Orders containing your items will appear here."
              />
            </CardBody>
          ) : (
            <ul className="divide-y divide-ink-100">
              {recentOrders.map((order) => {
                const items = order.items.filter((item) => item.sellerId === sellerId)
                const total = items.reduce((s, item) => s + item.unitPrice * item.quantity, 0)
                return (
                  <li key={order.id} className="flex flex-wrap items-center gap-4 px-5 py-4">
                    <div className="min-w-0 flex-1">
                      <Link
                        to={`/seller/orders/${order.id}`}
                        className="font-medium text-ink link-underline"
                      >
                        {order.orderNumber}
                      </Link>
                      <p className="mt-0.5 truncate text-sm text-ink-500">
                        {order.customerName} · {items.length} item{items.length === 1 ? '' : 's'}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium text-ink">{formatCurrency(total)}</p>
                      <p className="text-xs text-ink-400">{formatDate(order.placedAt)}</p>
                    </div>
                    <StatusBadge status={order.status} kind="order" />
                  </li>
                )
              })}
            </ul>
          )}
        </Card>

        {/* Low stock */}
        <Card>
          <CardHeader>
            <CardTitle>Low stock alerts</CardTitle>
            <Link to="/seller/inventory" className="text-sm font-medium text-ink link-underline">
              Inventory
            </Link>
          </CardHeader>
          {lowStock.length === 0 ? (
            <CardBody>
              <EmptyState
                size="sm"
                icon={<Boxes className="h-5 w-5" />}
                title="Stock levels look healthy"
                description="No variants are at or below their low-stock threshold."
              />
            </CardBody>
          ) : (
            <ul className="divide-y divide-ink-100">
              {lowStock.slice(0, 5).map(({ product, variant }) => (
                <li key={variant.id} className="flex items-center gap-3 px-5 py-4">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-ink">{product.name}</p>
                    <p className="mt-0.5 text-xs text-ink-500">
                      {variant.variantName} · {variant.stock} left
                    </p>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => openRestock(product, variant)}>
                    Restock
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Recent reviews */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Recent reviews</CardTitle>
            <Link to="/seller/reviews" className="text-sm font-medium text-ink link-underline">
              View all
            </Link>
          </CardHeader>
          {sellerReviews.length === 0 ? (
            <CardBody>
              <EmptyState
                size="sm"
                icon={<Star className="h-5 w-5" />}
                title="No reviews yet"
                description="Customer reviews for your products will show up here."
              />
            </CardBody>
          ) : (
            <ul className="divide-y divide-ink-100">
              {sellerReviews.slice(0, 3).map((review) => (
                <li key={review.id} className="space-y-2 px-5 py-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <Stars rating={review.rating} size="sm" />
                      <span className="text-sm font-medium text-ink">{review.customerName}</span>
                    </div>
                    <span className="text-xs text-ink-400">{relativeTime(review.createdAt)}</span>
                  </div>
                  <p className="text-sm text-ink-600">{review.reviewText}</p>
                  <div className="flex items-center justify-between gap-3">
                    <p className="truncate text-xs text-ink-400">{review.productName}</p>
                    <Button size="sm" variant="ghost" onClick={() => openReply(review)}>
                      <MessageSquare className="h-3.5 w-3.5" aria-hidden="true" />
                      {review.sellerReply ? 'Edit reply' : 'Reply'}
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* Top products */}
        <Card>
          <CardHeader>
            <CardTitle>Top products</CardTitle>
            <Link to="/seller/analytics" className="text-sm font-medium text-ink link-underline">
              Analytics
            </Link>
          </CardHeader>
          {topProducts.length === 0 ? (
            <CardBody>
              <EmptyState
                size="sm"
                icon={<Boxes className="h-5 w-5" />}
                title="No products yet"
                description="Add a product to start tracking performance."
                action={{ label: 'Add product', to: '/seller/products/new' }}
              />
            </CardBody>
          ) : (
            <Table className="min-w-0">
              <THead>
                <TR>
                  <TH>Product</TH>
                  <TH className="text-right">Sold</TH>
                </TR>
              </THead>
              <TBody>
                {topProducts.map((product) => (
                  <TR key={product.id}>
                    <TD className="max-w-[12rem]">
                      <Link to={`/seller/products/${product.id}/edit`} className="truncate font-medium text-ink hover:underline">
                        {product.name}
                      </Link>
                    </TD>
                    <TD className="text-right">{formatNumber(product.soldCount)}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </Card>
      </div>

      {/* Restock modal */}
      <Modal
        open={!!restock}
        onClose={() => setRestock(null)}
        title="Restock variant"
        description={restock ? `${restock.product.name} — ${restock.variant.variantName}` : undefined}
        footer={
          <>
            <Button variant="outline" onClick={() => setRestock(null)} disabled={savingRestock}>
              Cancel
            </Button>
            <Button onClick={confirmRestock} loading={savingRestock}>
              Add stock
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-sm text-ink-600">
            Current stock: <span className="font-medium text-ink">{restock?.variant.stock ?? 0}</span> · Threshold:{' '}
            {restock?.variant.lowStockThreshold ?? 0}
          </p>
          <div>
            <span className="mb-1.5 block text-sm font-medium text-ink">Units to add</span>
            <QuantitySelector value={restockQty} onChange={setRestockQty} min={1} max={500} label="Units to add" />
          </div>
          <p className="text-xs text-ink-500">
            This updates the variant stock in the backend and records the inventory movement.
          </p>
        </div>
      </Modal>

      {/* Reply modal */}
      <Modal
        open={!!replyTarget}
        onClose={() => setReplyTarget(null)}
        title="Reply to review"
        description={replyTarget?.productName ?? undefined}
        footer={
          <>
            <Button variant="outline" onClick={() => setReplyTarget(null)} disabled={savingReply}>
              Cancel
            </Button>
            <Button onClick={confirmReply} loading={savingReply}>
              Publish reply
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="rounded-lg bg-ink-50 p-3 text-sm text-ink-600">
            <Stars rating={replyTarget?.rating ?? 5} size="sm" />
            <p className="mt-1.5">{replyTarget?.reviewText}</p>
          </div>
          <Textarea
            label="Your reply"
            rows={4}
            value={replyText}
            onChange={(event) => setReplyText(event.target.value)}
            placeholder="Thank the customer and address their feedback."
          />
        </div>
      </Modal>
    </div>
  )
}
