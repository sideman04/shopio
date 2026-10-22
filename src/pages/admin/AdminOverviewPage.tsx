import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertTriangle,
  ArrowRight,
  DollarSign,
  Flag,
  Mail,
  Package,
  RotateCcw,
  ShoppingBag,
  Store,
  TrendingUp,
  Users,
} from 'lucide-react'
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  Modal,
  PageHeader,
  StatCard,
  StatusBadge,
  TBody,
  TD,
  TH,
  THead,
  TR,
  Table,
} from '@/components/ui'
import { AreaRevenueChart, BarSeriesChart, ChartCard, DonutChart } from '@/components/charts/Charts'
import { ActivityFeed } from '@/components/dashboard/ActivityFeed'
import { DateRangeFilter, type RangeKey } from '@/components/dashboard/DateRangeFilter'
import { useCatalogStore } from '@/context/catalogStore'
import { useOrderStore } from '@/context/orderStore'
import { usePeopleStore } from '@/context/peopleStore'
import { useSystemStore } from '@/context/systemStore'
import { toast } from '@/context/uiStore'
import { adminService, orderService, reviewService, type AdminOverview } from '@/services'
import { formatCurrency, formatDate, formatNumber } from '@/lib/utils'

/**
 * Admin overview — the platform control room.
 *
 * Headline metrics, the "needs attention" queue, revenue/order charts and the
 * most recent orders and activity. All data comes from the live stores so the
 * figures stay in step with moderation performed elsewhere in the console.
 */
export default function AdminOverviewPage() {
  const orders = useOrderStore((s) => s.orders)
  const products = useCatalogStore((s) => s.products)
  const reviews = useCatalogStore((s) => s.reviews)
  const sellers = usePeopleStore((s) => s.sellers)
  const activity = useSystemStore((s) => s.activity)
  const supportMessages = useSystemStore((s) => s.supportMessages)

  const [range, setRange] = useState<RangeKey>('30d')
  const [supportOpen, setSupportOpen] = useState(false)
  const [overview, setOverview] = useState<AdminOverview | null>(null)
  const [analytics, setAnalytics] = useState<adminService.AdminAnalytics | null>(null)
  const [monthly, setMonthly] = useState<adminService.AdminAnalytics | null>(null)

  const days = range === '7d' ? 7 : range === '30d' ? 30 : range === '90d' ? 90 : 365

  useEffect(() => {
    let active = true
    adminService
      .fetchAnalytics(days)
      .then((result) => active && setAnalytics(result))
      .catch(() => active && setAnalytics(null))
    return () => {
      active = false
    }
  }, [days])

  useEffect(() => {
    let active = true
    adminService
      .fetchOverview()
      .then((result) => active && setOverview(result))
      .catch(() => undefined)
    adminService
      .fetchAnalytics(365)
      .then((result) => active && setMonthly(result))
      .catch(() => undefined)
    adminService.fetchSupport().catch(() => undefined)
    adminService.fetchActivity().catch(() => undefined)
    adminService.fetchProducts({ pageSize: 100 }).catch(() => undefined)
    adminService.fetchSellers({ pageSize: 100 }).catch(() => undefined)
    reviewService.fetchAdminReviews({ pageSize: 100 }).catch(() => undefined)
    orderService.queryOrders({ pageSize: 100, scope: 'admin' }).catch(() => undefined)
    return () => {
      active = false
    }
  }, [])

  const pendingSellers = sellers.filter((s) => s.verificationStatus === 'pending').length
  const pendingProducts = products.filter((p) => p.status === 'pending_review').length
  const reportedReviews = reviews.filter((r) => r.reported).length
  const refundRequests = analytics?.refundsPending ?? 0
  const newSupport = supportMessages.filter((m) => m.status === 'new').length

  const rangeData = analytics?.series ?? []
  const revenueByCategory = analytics?.revenueByCategory ?? []
  const sellerPerformance = analytics?.topSellers ?? []
  const productPerformance = analytics?.topProducts ?? []

  const recentOrders = useMemo(
    () =>
      [...orders]
        .sort((a, b) => new Date(b.placedAt).getTime() - new Date(a.placedAt).getTime())
        .slice(0, 6),
    [orders],
  )

  const attention = [
    {
      key: 'sellers',
      label: 'Seller applications',
      hint: 'Awaiting verification',
      value: pendingSellers,
      icon: <Store className="h-5 w-5" />,
      to: '/admin/sellers',
    },
    {
      key: 'products',
      label: 'Products in review',
      hint: 'Submitted by sellers',
      value: pendingProducts,
      icon: <Package className="h-5 w-5" />,
      to: '/admin/products',
    },
    {
      key: 'reviews',
      label: 'Reported reviews',
      hint: 'Flagged by shoppers',
      value: reportedReviews,
      icon: <Flag className="h-5 w-5" />,
      to: '/admin/reviews',
    },
    {
      key: 'refunds',
      label: 'Refund requests',
      hint: 'Requested or processing',
      value: refundRequests,
      icon: <RotateCcw className="h-5 w-5" />,
      to: '/admin/transactions',
    },
    {
      key: 'support',
      label: 'Support messages',
      hint: 'Unanswered',
      value: newSupport,
      icon: <Mail className="h-5 w-5" />,
      onClick: () => setSupportOpen(true),
    },
  ]

  const handleSupportStatus = async (id: number, status: 'in_progress' | 'resolved') => {
    try {
      await adminService.setSupportStatus(id, status)
      toast.success(
        status === 'resolved' ? 'Support message resolved' : 'Support message in progress',
        'The support ticket was updated on the server.',
      )
    } catch {
      toast.error('Could not update the ticket', 'Please try again.')
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Platform overview"
        description="Revenue, catalogue health and the moderation queue across the marketplace."
        actions={
          <>
            <DateRangeFilter value={range} onChange={setRange} />
            <Button to="/admin/products" variant="outline">
              Review queue
            </Button>
          </>
        }
      />

      {/* Needs attention */}
      <section aria-label="Needs attention" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {attention.map((item) => {
          const inner = (
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-ink-500">{item.label}</p>
                <p className="mt-2 text-2xl font-bold tracking-tight text-ink">{formatNumber(item.value)}</p>
                <p className="mt-1 text-xs text-ink-500">{item.hint}</p>
              </div>
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-sand-100 text-ink-600">
                {item.icon}
              </span>
            </div>
          )

          if (item.to) {
            return (
              <Link
                key={item.key}
                to={item.to}
                className="group rounded-card border border-ink-200 bg-white p-5 shadow-card transition hover:border-ink-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/70"
              >
                {inner}
                <span className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-ink-600 group-hover:text-ink">
                  Open <ArrowRight className="h-3.5 w-3.5" />
                </span>
              </Link>
            )
          }

          return (
            <button
              key={item.key}
              type="button"
              onClick={item.onClick}
              className="group rounded-card border border-ink-200 bg-white p-5 text-left shadow-card transition hover:border-ink-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/70"
            >
              {inner}
              <span className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-ink-600 group-hover:text-ink">
                Review <ArrowRight className="h-3.5 w-3.5" />
              </span>
            </button>
          )
        })}
      </section>

      {/* Headline metrics */}
      <section aria-label="Key metrics" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total revenue"
          value={formatCurrency((overview?.totalRevenue ?? 0), { compact: true })}
          change={overview?.revenueChange ?? 0}
          icon={<DollarSign className="h-4 w-4" />}
          hint="vs previous period"
        />
        <StatCard
          label="Orders"
          value={formatNumber((overview?.totalOrders ?? 0))}
          change={overview?.ordersChange ?? 0}
          icon={<ShoppingBag className="h-4 w-4" />}
          hint="vs previous period"
        />
        <StatCard
          label="Customers"
          value={formatNumber((overview?.totalCustomers ?? 0))}
          change={overview?.customersChange ?? 0}
          icon={<Users className="h-4 w-4" />}
          hint="vs previous period"
        />
        <StatCard
          label="Active sellers"
          value={formatNumber((overview?.activeSellers ?? 0))}
          change={overview?.sellersChange ?? 0}
          icon={<Store className="h-4 w-4" />}
          hint="vs previous period"
        />
        <StatCard
          label="Products"
          value={formatNumber((overview?.totalProducts ?? 0))}
          change={overview?.productsChange ?? 0}
          icon={<Package className="h-4 w-4" />}
          hint="across all sellers"
        />
        <StatCard
          label="Conversion rate"
          value={`${(overview?.conversionRate ?? 0)}%`}
          icon={<TrendingUp className="h-4 w-4" />}
          hint="visits that convert"
        />
        <StatCard
          label="Average order value"
          value={formatCurrency((overview?.averageOrderValue ?? 0), { compact: true })}
          icon={<DollarSign className="h-4 w-4" />}
          hint="per completed order"
        />
      </section>

      {/* Revenue */}
      <ChartCard
        title="Revenue"
        description="Gross merchandise value over the selected range."
        action={<DateRangeFilter value={range} onChange={setRange} />}
      >
        <AreaRevenueChart
          data={rangeData}
          ariaLabel="Revenue over the selected period"
          valueFormat="currency"
        />
      </ChartCard>

      <div className="grid gap-6 lg:grid-cols-2">
        <ChartCard title="Orders per month" description="Order volume across the last 12 months.">
          <BarSeriesChart
            data={monthly?.series ?? []}
            dataKey="orders"
            label="Orders"
            valueFormat="number"
            ariaLabel="Orders per month for the last 12 months"
          />
        </ChartCard>

        <ChartCard title="Revenue by category" description="Share of revenue by top-level category.">
          <DonutChart data={revenueByCategory} ariaLabel="Revenue distribution by category" />
        </ChartCard>
      </div>

      {/* Top sellers */}
      <Card>
        <CardHeader>
          <CardTitle>Top sellers</CardTitle>
          <Button to="/admin/sellers" variant="ghost" size="sm">
            View all
          </Button>
        </CardHeader>
        <Table>
          <THead>
            <TR>
              <TH>Store</TH>
              <TH>Revenue</TH>
              <TH>Orders</TH>
            </TR>
          </THead>
          <TBody>
            {sellerPerformance.map((seller) => (
              <TR key={seller.store}>
                <TD className="font-medium text-ink">{seller.store}</TD>
                <TD>{formatCurrency(seller.revenue, { compact: true })}</TD>
                <TD>{formatNumber(seller.orders)}</TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recent orders */}
        <Card>
          <CardHeader>
            <CardTitle>Recent orders</CardTitle>
            <Button to="/admin/orders" variant="ghost" size="sm">
              View all
            </Button>
          </CardHeader>
          <Table>
            <THead>
              <TR>
                <TH>Order</TH>
                <TH>Customer</TH>
                <TH>Total</TH>
                <TH>Status</TH>
              </TR>
            </THead>
            <TBody>
              {recentOrders.map((order) => (
                <TR key={order.id}>
                  <TD>
                    <Link
                      to={`/admin/orders/${order.id}`}
                      className="font-medium text-ink underline-offset-2 hover:underline"
                    >
                      {order.orderNumber}
                    </Link>
                  </TD>
                  <TD className="max-w-[12rem] truncate">{order.customerName}</TD>
                  <TD className="whitespace-nowrap">{formatCurrency(order.grandTotal)}</TD>
                  <TD>
                    <StatusBadge status={order.status} kind="order" />
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </Card>

        {/* Recent activity */}
        <Card>
          <CardHeader>
            <CardTitle>Recent activity</CardTitle>
            <Button to="/admin/activity" variant="ghost" size="sm">
              View all
            </Button>
          </CardHeader>
          <CardBody>
            <ActivityFeed items={activity.slice(0, 6)} />
          </CardBody>
        </Card>
      </div>

      {/* Top products */}
      <Card>
        <CardHeader>
          <CardTitle>Top products</CardTitle>
          <Button to="/admin/products" variant="ghost" size="sm">
            Manage catalogue
          </Button>
        </CardHeader>
        <CardBody className="space-y-3">
          {productPerformance.map((product, index) => (
            <div
              key={product.name}
              className="flex items-center justify-between gap-4 rounded-lg border border-ink-100 bg-ink-50/40 px-4 py-3"
            >
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white text-xs font-semibold text-ink-600 shadow-card">
                  {index + 1}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-ink">{product.name}</p>
                  <p className="text-xs text-ink-500">{formatNumber(product.units)} units sold</p>
                </div>
              </div>
              <p className="shrink-0 text-sm font-semibold text-ink">
                {formatCurrency(product.revenue, { compact: true })}
              </p>
            </div>
          ))}
        </CardBody>
      </Card>

      {/* Support inbox */}
      <Modal
        open={supportOpen}
        onClose={() => setSupportOpen(false)}
        title="Support messages"
        description="New and in-progress messages from the support inbox."
        size="lg"
      >
        <div className="space-y-4">
          {supportMessages.length === 0 ? (
            <p className="text-sm text-ink-500">No support messages.</p>
          ) : (
            supportMessages.map((message) => (
              <div key={message.id} className="rounded-lg border border-ink-200 p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium text-ink">{message.subject}</p>
                    <p className="text-xs text-ink-500">
                      {message.name} · {message.email}
                    </p>
                  </div>
                  <StatusBadge status={message.status} kind="generic" />
                </div>
                <p className="mt-2 text-sm text-ink-600">{message.message}</p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span className="text-xs text-ink-400">{formatDate(message.createdAt, 'time')}</span>
                  <div className="ml-auto flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleSupportStatus(message.id, 'in_progress')}
                    >
                      Mark in progress
                    </Button>
                    <Button size="sm" onClick={() => handleSupportStatus(message.id, 'resolved')}>
                      Resolve
                    </Button>
                  </div>
                </div>
              </div>
            ))
          )}
          <p className="text-xs text-ink-500">
            Ticket status is saved to the backend; no reply email is sent from the console.
          </p>
        </div>
      </Modal>

      <p className="flex items-center gap-1.5 text-xs text-ink-500">
        <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
        Figures are calculated from live platform data. Moderation actions elsewhere in the console update these counters.
      </p>
    </div>
  )
}
