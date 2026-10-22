import { useEffect, useState } from 'react'
import { DollarSign, RotateCcw, ShoppingBag, Store, TrendingUp, Users } from 'lucide-react'
import {
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  EmptyState,
  PageHeader,
  StatCard,
  TBody,
  TD,
  TH,
  THead,
  TR,
  Table,
} from '@/components/ui'
import { AreaRevenueChart, BarSeriesChart, ChartCard, DonutChart, LineSeriesChart } from '@/components/charts/Charts'
import { DateRangeFilter, type RangeKey } from '@/components/dashboard/DateRangeFilter'
import { adminService } from '@/services'
import { formatCurrency, formatNumber } from '@/lib/utils'

/** Platform analytics sourced from `/admin/analytics`. */
export default function AdminAnalyticsPage() {
  const [range, setRange] = useState<RangeKey>('12m')
  const [analytics, setAnalytics] = useState<adminService.AdminAnalytics | null>(null)

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

  const rangeData = analytics?.series ?? []
  const revenueByCategory = analytics?.revenueByCategory ?? []
  const customerGrowth = analytics?.customerGrowth ?? []
  const sellerPerformance = analytics?.topSellers ?? []
  const productPerformance = analytics?.topProducts ?? []
  const statusBreakdown = analytics?.statusBreakdown ?? []

  const totals = rangeData.reduce(
    (acc, point) => ({
      revenue: acc.revenue + point.revenue,
      orders: acc.orders + point.orders,
    }),
    { revenue: 0, orders: 0 },
  )
  const aov = totals.orders ? Math.round(totals.revenue / totals.orders) : 0
  const newCustomers = customerGrowth[customerGrowth.length - 1]?.newCustomers ?? 0
  const unitsSold = productPerformance.reduce((sum, product) => sum + product.units, 0)
  const maxSellerRevenue = sellerPerformance.reduce((max, seller) => Math.max(max, seller.revenue), 0)

  const statusData = statusBreakdown.map((entry) => ({
    name: entry.status.replace(/_/g, ' '),
    value: entry.count,
  }))

  return (
    <div className="space-y-6">
      <PageHeader
        title="Analytics"
        description="Demand, revenue and conversion across the marketplace."
        actions={<DateRangeFilter value={range} onChange={setRange} />}
      />

      <section aria-label="Analytics summary" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Revenue" value={formatCurrency(totals.revenue, { compact: true })} icon={<DollarSign className="h-4 w-4" />} hint="selected range" />
        <StatCard label="Orders" value={formatNumber(totals.orders)} icon={<ShoppingBag className="h-4 w-4" />} hint="selected range" />
        <StatCard label="Average order value" value={formatCurrency(aov, { compact: true })} icon={<DollarSign className="h-4 w-4" />} hint="per order" />
        <StatCard label="New customers" value={formatNumber(newCustomers)} icon={<Users className="h-4 w-4" />} hint="this period" />
        <StatCard label="Sellers with sales" value={formatNumber(sellerPerformance.length)} icon={<Store className="h-4 w-4" />} hint="this period" />
        <StatCard label="Units sold" value={formatNumber(unitsSold)} icon={<ShoppingBag className="h-4 w-4" />} hint="top products" />
        <StatCard label="Refunds pending" value={formatNumber(analytics?.refundsPending ?? 0)} icon={<RotateCcw className="h-4 w-4" />} hint="awaiting review" />
        <StatCard label="Payouts pending" value={formatNumber(analytics?.payoutsPending ?? 0)} icon={<TrendingUp className="h-4 w-4" />} hint="awaiting processing" />
      </section>

      <ChartCard title="Revenue and orders" description="Revenue over the selected range; order volume is shown below.">
        <AreaRevenueChart data={rangeData} ariaLabel="Revenue over the selected period" valueFormat="currency" />
      </ChartCard>

      <div className="grid gap-6 lg:grid-cols-2">
        <ChartCard title="Orders per bucket" description="Order volume across the selected range.">
          <BarSeriesChart
            data={rangeData}
            dataKey="orders"
            label="Orders"
            valueFormat="number"
            ariaLabel="Orders across the selected range"
          />
        </ChartCard>

        <ChartCard title="Revenue by category" description="Share of revenue by top-level category.">
          {revenueByCategory.length === 0 ? (
            <EmptyState size="sm" icon={<Store className="h-5 w-5" />} title="No category revenue yet" />
          ) : (
            <DonutChart data={revenueByCategory} ariaLabel="Revenue distribution by category" />
          )}
        </ChartCard>
      </div>

      <ChartCard title="Customer growth" description="Total and new customers over the selected period.">
        {customerGrowth.length === 0 ? (
          <EmptyState size="sm" icon={<Users className="h-5 w-5" />} title="No customer history yet" />
        ) : (
          <LineSeriesChart
            data={customerGrowth}
            series={[
              { key: 'customers', name: 'Total customers' },
              { key: 'newCustomers', name: 'New customers' },
            ]}
            ariaLabel="Customer growth over the selected period"
          />
        )}
      </ChartCard>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Top sellers</CardTitle>
          </CardHeader>
          {sellerPerformance.length === 0 ? (
            <CardBody>
              <EmptyState size="sm" icon={<Store className="h-5 w-5" />} title="No seller revenue yet" />
            </CardBody>
          ) : (
            <Table>
              <THead>
                <TR>
                  <TH>Store</TH>
                  <TH>Revenue</TH>
                  <TH>Orders</TH>
                  <TH>Share</TH>
                </TR>
              </THead>
              <TBody>
                {sellerPerformance.map((seller) => (
                  <TR key={seller.store}>
                    <TD className="font-medium text-ink">{seller.store}</TD>
                    <TD className="whitespace-nowrap">{formatCurrency(seller.revenue, { compact: true })}</TD>
                    <TD>{formatNumber(seller.orders)}</TD>
                    <TD>
                      <div className="h-2 w-24 overflow-hidden rounded-full bg-ink-100" aria-hidden="true">
                        <div
                          className="h-full rounded-full bg-ink"
                          style={{ width: `${maxSellerRevenue > 0 ? (seller.revenue / maxSellerRevenue) * 100 : 0}%` }}
                        />
                      </div>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Top products</CardTitle>
          </CardHeader>
          {productPerformance.length === 0 ? (
            <CardBody>
              <EmptyState size="sm" icon={<ShoppingBag className="h-5 w-5" />} title="No product revenue yet" />
            </CardBody>
          ) : (
            <Table>
              <THead>
                <TR>
                  <TH>Product</TH>
                  <TH>Units</TH>
                  <TH>Revenue</TH>
                </TR>
              </THead>
              <TBody>
                {productPerformance.map((product) => (
                  <TR key={product.name}>
                    <TD className="max-w-[16rem] truncate font-medium text-ink">{product.name}</TD>
                    <TD>{formatNumber(product.units)}</TD>
                    <TD className="whitespace-nowrap">{formatCurrency(product.revenue, { compact: true })}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </Card>
      </div>

      <ChartCard title="Order status" description="Orders grouped by their current status.">
        {statusData.length === 0 ? (
          <EmptyState size="sm" icon={<ShoppingBag className="h-5 w-5" />} title="No orders yet" />
        ) : (
          <DonutChart data={statusData} ariaLabel="Orders grouped by current status" />
        )}
      </ChartCard>

      <p className="text-xs text-ink-500">
        Figures are calculated from live orders, products and sellers.
      </p>
    </div>
  )
}
