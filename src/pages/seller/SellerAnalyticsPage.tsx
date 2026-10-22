import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Package, TrendingUp, Users, Wallet } from 'lucide-react'
import {
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  DataList,
  EmptyState,
  PageHeader,
  StatCard,
  Stars,
  Table,
  TBody,
  TD,
  TH,
  THead,
  TR,
} from '@/components/ui'
import { AreaRevenueChart, BarSeriesChart, ChartCard, DonutChart } from '@/components/charts/Charts'
import { DateRangeFilter, type RangeKey } from '@/components/dashboard/DateRangeFilter'
import { useAuthStore, useSellerOrders, useSellerProducts } from '@/context'
import { sellerService } from '@/services'
import { formatCurrency, formatNumber } from '@/lib/utils'

export default function SellerAnalyticsPage() {
  const user = useAuthStore((s) => s.session?.user)
  const sellerId = user?.sellerId ?? 1
  const products = useSellerProducts(sellerId)
  const orders = useSellerOrders(sellerId)

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

  const revenueData = analytics?.series ?? []

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

  const uniqueCustomers = useMemo(
    () => new Set(orders.map((order) => order.userId).filter((id): id is number => id != null)).size,
    [orders],
  )

  const categoryRevenue = useMemo(() => {
    const map = new Map<string, number>()
    products.forEach((product) => {
      const name = product.categoryName ?? 'Other'
      const revenue = product.soldCount * (product.variants[0]?.price ?? 0)
      map.set(name, (map.get(name) ?? 0) + revenue)
    })
    return Array.from(map.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
  }, [products])

  const topProducts = useMemo(() => {
    const rows = products.map((product) => ({
      product,
      units: product.soldCount,
      revenue: product.soldCount * (product.variants[0]?.price ?? 0),
    }))
    const total = rows.reduce((sum, row) => sum + row.revenue, 0)
    return rows
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 8)
      .map((row) => ({ ...row, share: total > 0 ? Math.round((row.revenue / total) * 100) : 0 }))
  }, [products])

  const averageOrderValue = orders.length ? Math.round(sellerRevenue / orders.length) : 0

  return (
    <div className="space-y-6">
      <PageHeader
        title="Analytics"
        description="How your store is performing across the selected period."
        actions={<DateRangeFilter value={range} onChange={setRange} />}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Net revenue"
          value={formatCurrency(analytics?.totals.earnedNet ?? sellerRevenue, { compact: true })}
          hint="After commission"
          icon={<Wallet className="h-4 w-4" aria-hidden="true" />}
        />
        <StatCard
          label="Available for payout"
          value={formatCurrency(analytics?.totals.availableForPayout ?? 0, { compact: true })}
          icon={<TrendingUp className="h-4 w-4" aria-hidden="true" />}
        />
        <StatCard
          label="Average order value"
          value={formatCurrency(averageOrderValue)}
          icon={<Wallet className="h-4 w-4" aria-hidden="true" />}
        />
        <StatCard
          label="Units sold"
          value={formatNumber(analytics?.totals.unitsSold ?? 0)}
          icon={<Package className="h-4 w-4" aria-hidden="true" />}
        />
        <StatCard
          label="Orders"
          value={formatNumber(orders.length)}
          icon={<Package className="h-4 w-4" aria-hidden="true" />}
        />
        <StatCard
          label="Unique customers"
          value={formatNumber(uniqueCustomers)}
          icon={<Users className="h-4 w-4" aria-hidden="true" />}
        />
        <StatCard
          label="Commission"
          value={formatCurrency(analytics?.totals.commissionTotal ?? 0, { compact: true })}
          icon={<Wallet className="h-4 w-4" aria-hidden="true" />}
        />
        <StatCard
          label="Products listed"
          value={formatNumber(products.length)}
          icon={<Package className="h-4 w-4" aria-hidden="true" />}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <ChartCard title="Revenue trend" description="Revenue over the selected period" height={300}>
          <AreaRevenueChart
            data={revenueData}
            dataKey="revenue"
            label="Revenue"
            height={300}
            ariaLabel="Revenue trend"
          />
        </ChartCard>

        <ChartCard title="Orders per period" description="Order volume over the selected period" height={300}>
          <BarSeriesChart
            data={revenueData}
            dataKey="orders"
            label="Orders"
            valueFormat="number"
            height={300}
            ariaLabel="Orders per period"
          />
        </ChartCard>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <ChartCard title="Revenue by category" description="This store's sales mix by category" height={300}>
          {categoryRevenue.length === 0 ? (
            <EmptyState size="sm" icon={<Package className="h-5 w-5" />} title="No category data yet" />
          ) : (
            <DonutChart data={categoryRevenue} height={300} ariaLabel="Revenue share by category" />
          )}
        </ChartCard>

        <Card>
          <CardHeader>
            <CardTitle>Sales summary</CardTitle>
          </CardHeader>
          <CardBody>
            <DataList
              items={[
                { label: 'Units sold', value: formatNumber(analytics?.totals.unitsSold ?? 0) },
                { label: 'Net earned', value: formatCurrency(analytics?.totals.earnedNet ?? 0) },
                { label: 'Commission', value: formatCurrency(analytics?.totals.commissionTotal ?? 0) },
                { label: 'Available for payout', value: formatCurrency(analytics?.totals.availableForPayout ?? 0) },
              ]}
            />
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Top performing products</CardTitle>
          <span className="text-sm text-ink-500">Ranked by revenue</span>
        </CardHeader>
        {topProducts.length === 0 ? (
          <CardBody>
            <EmptyState
              size="sm"
              icon={<Package className="h-5 w-5" />}
              title="No products yet"
              description="Add products to see performance analytics."
              action={{ label: 'Add product', to: '/seller/products/new' }}
            />
          </CardBody>
        ) : (
          <Table>
            <THead>
              <TR>
                <TH>Product</TH>
                <TH>Units sold</TH>
                <TH>Revenue</TH>
                <TH>Rating</TH>
                <TH>Share of revenue</TH>
              </TR>
            </THead>
            <TBody>
              {topProducts.map(({ product, units, revenue, share }) => (
                <TR key={product.id}>
                  <TD className="max-w-[16rem]">
                    <Link to={`/seller/products/${product.id}/edit`} className="truncate font-medium text-ink hover:underline">
                      {product.name}
                    </Link>
                  </TD>
                  <TD>{formatNumber(units)}</TD>
                  <TD className="whitespace-nowrap font-medium text-ink">{formatCurrency(revenue)}</TD>
                  <TD>
                    <Stars rating={product.rating} size="sm" showValue />
                  </TD>
                  <TD>
                    <div className="flex items-center gap-3">
                      <div className="h-2 w-28 rounded-full bg-ink-100">
                        <div className="h-2 rounded-full bg-ink" style={{ width: `${share}%` }} />
                      </div>
                      <span className="text-xs text-ink-500">{share}%</span>
                    </div>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </Card>

      <p className="text-xs text-ink-500">
        Figures are calculated from your live orders and products.
      </p>
    </div>
  )
}
