import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  CheckCircle2,
  Clock,
  Heart,
  Package,
  ShoppingBag,
  Wallet,
} from 'lucide-react'
import type { Product } from '@/types'
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  EmptyState,
  PageHeader,
  SmartImage,
  StatCard,
  StatusBadge,
} from '@/components/ui'
import {
  useAuthStore,
  useBrowseStore,
  useCatalogStore,
  useCustomerOrders,
  useWishlistStore,
} from '@/context'
import { orderService } from '@/services'
import { formatCurrency, formatDate, sum } from '@/lib/utils'

/** Orders that are still on their way (not finished, not cancelled). */
const ACTIVE_STATUSES = ['pending', 'confirmed', 'processing', 'partially_shipped', 'shipped']

/**
 * Customer account overview — a single glance at orders, wishlist activity and
 * recently viewed products. Everything is read from the live client stores so
 * the numbers stay in step with the rest of the account.
 */
export default function AccountOverviewPage() {
  const user = useAuthStore((s) => s.session?.user)
  const orders = useCustomerOrders(user?.id)
  const entries = useWishlistStore((s) => s.entries)
  const recentlyViewed = useBrowseStore((s) => s.recentlyViewed)
  const products = useCatalogStore((s) => s.products)

  useEffect(() => {
    void orderService.queryOrders({ pageSize: 100, scope: 'customer' }).catch(() => undefined)
  }, [])

  const firstName = user?.fullName?.split(' ')[0] ?? 'there'
  const summary = orderService.summarise(orders)

  const inProgress = orders.filter((o) => ACTIVE_STATUSES.includes(o.status)).length
  const delivered = orders.filter((o) => o.status === 'delivered').length
  const totalSpent = sum(
    orders.filter((o) => o.status !== 'cancelled' && o.status !== 'refunded').map((o) => o.grandTotal),
  )

  const wishlistProducts = entries
    .map((entry) => products.find((p) => p.id === entry.productId))
    .filter((p): p is Product => Boolean(p))

  const recentOrders = [...orders]
    .sort((a, b) => new Date(b.placedAt).getTime() - new Date(a.placedAt).getTime())
    .slice(0, 4)

  const recentProducts = recentlyViewed
    .map((id) => products.find((p) => p.id === id))
    .filter((p): p is Product => Boolean(p))
    .slice(0, 6)

  const statusRows = [
    { key: 'pending', label: 'Pending', value: summary.pending, dot: 'bg-gold-500', bar: 'bg-gold-500' },
    { key: 'processing', label: 'Processing', value: summary.processing, dot: 'bg-info-600', bar: 'bg-info-600' },
    { key: 'shipped', label: 'Shipped', value: summary.shipped, dot: 'bg-ink-400', bar: 'bg-ink-400' },
    { key: 'delivered', label: 'Delivered', value: summary.delivered, dot: 'bg-success-600', bar: 'bg-success-600' },
    { key: 'cancelled', label: 'Cancelled / refunded', value: summary.cancelled, dot: 'bg-danger-600', bar: 'bg-danger-600' },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Welcome back, ${firstName}`}
        description="Here is a snapshot of your orders, saved items and recent activity on Shopio."
        actions={
          <Button to="/shop" variant="primary">
            Continue shopping
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard label="Total orders" value={String(orders.length)} icon={<ShoppingBag className="h-4 w-4" />} />
        <StatCard label="In progress" value={String(inProgress)} icon={<Clock className="h-4 w-4" />} />
        <StatCard label="Delivered" value={String(delivered)} icon={<CheckCircle2 className="h-4 w-4" />} />
        <StatCard label="Wishlist items" value={String(entries.length)} icon={<Heart className="h-4 w-4" />} />
        <StatCard
          label="Total spent"
          value={formatCurrency(totalSpent)}
          hint="Excludes cancelled orders"
          icon={<Wallet className="h-4 w-4" />}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Recent orders */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Recent orders</CardTitle>
            <Button to="/account/orders" variant="ghost" size="sm">
              View all
            </Button>
          </CardHeader>
          {recentOrders.length === 0 ? (
            <CardBody>
              <EmptyState
                size="sm"
                icon={<Package className="h-5 w-5" />}
                title="No orders yet"
                description="When you place an order it will appear here with its live status."
                action={{ label: 'Start shopping', to: '/shop' }}
              />
            </CardBody>
          ) : (
            <ul className="divide-y divide-ink-100">
              {recentOrders.map((order) => (
                <li key={order.id} className="flex items-center gap-4 px-5 py-4">
                  <div className="flex -space-x-3">
                    {order.items.slice(0, 3).map((item) => (
                      <SmartImage
                        key={item.id}
                        src={item.imageUrl ?? undefined}
                        alt={item.productName}
                        wrapperClassName="h-11 w-11 rounded-lg ring-2 ring-white"
                      />
                    ))}
                  </div>
                  <div className="min-w-0 flex-1">
                    <Link
                      to={`/account/orders/${order.id}`}
                      className="block truncate text-sm font-medium text-ink hover:underline"
                    >
                      {order.orderNumber}
                    </Link>
                    <p className="truncate text-xs text-ink-500">
                      {formatDate(order.placedAt)} · {order.items.length}{' '}
                      {order.items.length === 1 ? 'item' : 'items'}
                    </p>
                  </div>
                  <div className="hidden text-right sm:block">
                    <p className="text-sm font-semibold text-ink">{formatCurrency(order.grandTotal)}</p>
                    <div className="mt-1">
                      <StatusBadge status={order.status} kind="order" />
                    </div>
                  </div>
                  <Button to={`/account/orders/${order.id}`} variant="ghost" size="sm">
                    View
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* Order status summary */}
        <Card>
          <CardHeader>
            <CardTitle>Order status summary</CardTitle>
          </CardHeader>
          <CardBody className="space-y-4">
            <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-ink-100">
              {statusRows
                .filter((row) => row.value > 0)
                .map((row) => (
                  <span
                    key={row.key}
                    className={row.bar}
                    style={{ width: `${(row.value / Math.max(1, summary.total)) * 100}%` }}
                  />
                ))}
            </div>
            <ul className="space-y-3">
              {statusRows.map((row) => (
                <li key={row.key} className="flex items-center gap-3 text-sm">
                  <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${row.dot}`} aria-hidden="true" />
                  <span className="flex-1 truncate text-ink-600">{row.label}</span>
                  <span className="font-semibold text-ink">{row.value}</span>
                </li>
              ))}
            </ul>
            <p className="text-xs text-ink-500">
              {summary.total} {summary.total === 1 ? 'order' : 'orders'} in total ·{' '}
              {formatCurrency(summary.revenue)} lifetime value
            </p>
          </CardBody>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Recently viewed */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Recently viewed</CardTitle>
            <Button to="/shop" variant="ghost" size="sm">
              Browse catalog
            </Button>
          </CardHeader>
          <CardBody>
            {recentProducts.length === 0 ? (
              <EmptyState
                size="sm"
                icon={<ShoppingBag className="h-5 w-5" />}
                title="Nothing viewed yet"
                description="Products you open will be collected here for a quick return visit."
                action={{ label: 'Explore products', to: '/shop' }}
              />
            ) : (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                {recentProducts.map((product) => (
                  <Link key={product.id} to={`/product/${product.slug}`} className="group min-w-0">
                    <SmartImage
                      src={product.images.find((i) => i.isPrimary)?.imageUrl ?? product.images[0]?.imageUrl}
                      alt={product.name}
                      wrapperClassName="aspect-square rounded-lg"
                      className="transition-transform duration-500 group-hover:scale-105"
                    />
                    <p className="mt-2 line-clamp-2 text-sm font-medium text-ink group-hover:underline">
                      {product.name}
                    </p>
                    <p className="mt-0.5 text-sm text-ink-500">
                      {formatCurrency(Math.min(...product.variants.map((v) => v.price)))}
                    </p>
                  </Link>
                ))}
              </div>
            )}
          </CardBody>
        </Card>

        {/* Wishlist summary */}
        <Card>
          <CardHeader>
            <CardTitle>Wishlist</CardTitle>
            <span className="text-sm text-ink-500">{entries.length} saved</span>
          </CardHeader>
          <CardBody className="space-y-4">
            {wishlistProducts.length === 0 ? (
              <EmptyState
                size="sm"
                icon={<Heart className="h-5 w-5" />}
                title="Your wishlist is empty"
                description="Tap the heart on any product to save it for later."
                action={{ label: 'Find something', to: '/shop' }}
              />
            ) : (
              <>
                <ul className="space-y-3">
                  {wishlistProducts.slice(0, 4).map((product) => (
                    <li key={product.id}>
                      <Link to={`/product/${product.slug}`} className="group flex items-center gap-3">
                        <SmartImage
                          src={product.images.find((i) => i.isPrimary)?.imageUrl ?? product.images[0]?.imageUrl}
                          alt={product.name}
                          wrapperClassName="h-12 w-12 shrink-0 rounded-lg"
                        />
                        <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink group-hover:underline">
                          {product.name}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
                <Button to="/account/wishlist" variant="outline" fullWidth>
                  View wishlist
                </Button>
              </>
            )}
          </CardBody>
        </Card>
      </div>

      {/* Quick actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick actions</CardTitle>
        </CardHeader>
        <CardBody className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Button to="/shop" variant="outline" fullWidth>
            Browse products
          </Button>
          <Button to="/account/addresses" variant="outline" fullWidth>
            Manage addresses
          </Button>
          <Button to="/account/profile" variant="outline" fullWidth>
            Edit profile
          </Button>
          <Button to="/account/security" variant="outline" fullWidth>
            Security
          </Button>
          <Button to="/account/notifications" variant="outline" fullWidth>
            Notifications
          </Button>
          <Button to="/account/reviews" variant="outline" fullWidth>
            My reviews
          </Button>
        </CardBody>
      </Card>
    </div>
  )
}
