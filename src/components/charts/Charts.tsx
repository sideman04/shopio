import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { cn, formatCurrency, formatNumber } from '@/lib/utils'

/**
 * Chart wrappers around Recharts.
 *
 * Shared tooltip/axis styling keeps the dashboards consistent and gives every
 * chart an accessible text alternative via `role="img"` + `aria-label`.
 */

const AXIS_PROPS = {
  stroke: '#8A8A8A',
  fontSize: 12,
  tickLine: false,
  axisLine: false,
} as const

const PALETTE = ['#111111', '#4B4B4B', '#C7A67F', '#E8B02E', '#8A8A8A', '#6B6B6B']

function ChartTooltip({
  active,
  payload,
  label,
  valueFormat = 'currency',
}: {
  active?: boolean
  payload?: Array<{ name?: string; value?: number | string; color?: string }>
  label?: string
  valueFormat?: 'currency' | 'number' | 'percent'
}) {
  if (!active || !payload?.length) return null
  const format = (value: number | string | undefined) => {
    const numeric = typeof value === 'number' ? value : Number(value ?? 0)
    if (valueFormat === 'currency') return formatCurrency(numeric)
    if (valueFormat === 'percent') return `${numeric}%`
    return formatNumber(numeric)
  }

  return (
    <div className="rounded-lg border border-ink-200 bg-white px-3 py-2 shadow-lift">
      {label && <p className="mb-1 text-xs font-medium text-ink-500">{label}</p>}
      <ul className="space-y-0.5">
        {payload.map((entry, index) => (
          <li key={index} className="flex items-center gap-2 text-xs">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: entry.color }} aria-hidden="true" />
            <span className="text-ink-500">{entry.name}</span>
            <span className="ml-auto font-medium text-ink">{format(entry.value)}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

export interface ChartCardProps {
  title: string
  description?: string
  action?: React.ReactNode
  children: React.ReactNode
  className?: string
  height?: number
}

/** Card wrapper: title row plus a fixed-height chart body. */
export function ChartCard({ title, description, action, children, className, height = 300 }: ChartCardProps) {
  return (
    <section className={cn('rounded-card border border-ink-200 bg-white p-5 shadow-card', className)}>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-ink">{title}</h2>
          {description && <p className="mt-0.5 text-sm text-ink-500">{description}</p>}
        </div>
        {action}
      </div>
      <div style={{ height }} className="w-full">
        {children}
      </div>
    </section>
  )
}

/* -------------------------------------------------------------------------- */
/* Charts                                                                      */
/* -------------------------------------------------------------------------- */

export interface SeriesDatum {
  label: string
  revenue?: number
  orders?: number
  value?: number
}

export function AreaRevenueChart({
  data,
  label = 'Revenue',
  dataKey = 'revenue',
  height = 300,
  ariaLabel = 'Revenue over time',
  valueFormat = 'currency',
}: {
  data: SeriesDatum[]
  label?: string
  dataKey?: 'revenue' | 'orders' | 'value'
  height?: number
  ariaLabel?: string
  valueFormat?: 'currency' | 'number'
}) {
  return (
    <div style={{ height }} role="img" aria-label={ariaLabel}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id={`area-${dataKey}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#111111" stopOpacity={0.22} />
              <stop offset="100%" stopColor="#111111" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#EDEDED" vertical={false} />
          <XAxis dataKey="label" {...AXIS_PROPS} />
          <YAxis
            {...AXIS_PROPS}
            width={64}
            tickFormatter={(value: number) => (valueFormat === 'currency' ? formatCurrency(value, { compact: true }) : formatNumber(value, true))}
          />
          <Tooltip content={<ChartTooltip valueFormat={valueFormat} />} />
          <Area
            type="monotone"
            dataKey={dataKey}
            name={label}
            stroke="#111111"
            strokeWidth={2}
            fill={`url(#area-${dataKey})`}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

export function BarSeriesChart({
  data,
  dataKey = 'revenue',
  label = 'Revenue',
  height = 300,
  ariaLabel = 'Bar chart',
  valueFormat = 'currency',
}: {
  data: SeriesDatum[]
  dataKey?: 'revenue' | 'orders' | 'value'
  label?: string
  height?: number
  ariaLabel?: string
  valueFormat?: 'currency' | 'number'
}) {
  return (
    <div style={{ height }} role="img" aria-label={ariaLabel}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#EDEDED" vertical={false} />
          <XAxis dataKey="label" {...AXIS_PROPS} />
          <YAxis
            {...AXIS_PROPS}
            width={64}
            tickFormatter={(value: number) => (valueFormat === 'currency' ? formatCurrency(value, { compact: true }) : formatNumber(value, true))}
          />
          <Tooltip content={<ChartTooltip valueFormat={valueFormat} />} cursor={{ fill: '#F7F7F7' }} />
          <Bar dataKey={dataKey} name={label} fill="#111111" radius={[4, 4, 0, 0]} maxBarSize={44} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

export function DonutChart({
  data,
  height = 280,
  ariaLabel = 'Distribution',
  innerRadius = 62,
  outerRadius = 96,
}: {
  data: Array<{ name: string; value: number }>
  height?: number
  ariaLabel?: string
  innerRadius?: number
  outerRadius?: number
}) {
  return (
    <div style={{ height }} role="img" aria-label={ariaLabel}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Tooltip content={<ChartTooltip valueFormat="currency" />} />
          <Legend
            verticalAlign="bottom"
            height={36}
            iconType="circle"
            formatter={(value) => <span className="text-xs text-ink-600">{value}</span>}
          />
          <Pie data={data} dataKey="value" nameKey="name" innerRadius={innerRadius} outerRadius={outerRadius} paddingAngle={2}>
            {data.map((entry, index) => (
              <Cell key={entry.name} fill={PALETTE[index % PALETTE.length]} />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}

export function LineSeriesChart({
  data,
  series,
  height = 300,
  ariaLabel = 'Line chart',
}: {
  data: Array<Record<string, string | number>>
  series: Array<{ key: string; name: string; color?: string }>
  height?: number
  ariaLabel?: string
}) {
  return (
    <div style={{ height }} role="img" aria-label={ariaLabel}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#EDEDED" vertical={false} />
          <XAxis dataKey="label" {...AXIS_PROPS} />
          <YAxis {...AXIS_PROPS} width={56} tickFormatter={(value: number) => formatNumber(value, true)} />
          <Tooltip content={<ChartTooltip valueFormat="number" />} />
          <Legend
            verticalAlign="top"
            height={28}
            iconType="circle"
            formatter={(value) => <span className="text-xs text-ink-600">{value}</span>}
          />
          {series.map((s, index) => (
            <Line
              key={s.key}
              type="monotone"
              dataKey={s.key}
              name={s.name}
              stroke={s.color ?? PALETTE[index % PALETTE.length]}
              strokeWidth={2}
              dot={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

export { PALETTE as CHART_PALETTE }
