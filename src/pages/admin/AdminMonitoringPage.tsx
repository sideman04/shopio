import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Database,
  Gauge,
  HardDrive,
  MemoryStick,
  RefreshCw,
  Server,
  XCircle,
} from 'lucide-react'
import { Badge, Button, Card, CardBody, CardHeader, CardTitle, PageHeader, StatCard } from '@/components/ui'
import { adminService } from '@/services'
import type { MonitoringSnapshot } from '@/services/adminService'
import { errorMessage } from '@/services/apiClient'
import { LOCAL_DEMO } from '@/services/localDemo'

interface ProbeSample {
  label: string
  responseTimeMs: number | null
  healthy: boolean
}

function formatBytes(bytes: number | null): string {
  if (bytes == null) return 'Unlimited'
  if (bytes < 1024) return `${bytes} B`
  const units = ['KB', 'MB', 'GB']
  let value = bytes / 1024
  let unitIndex = 0
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024
    unitIndex++
  }
  return `${value.toFixed(1)} ${units[unitIndex]}`
}

function formatTime(value: string): string {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString()
}

function StatusMark({ healthy }: { healthy: boolean }) {
  return healthy ? (
    <CheckCircle2 className="h-5 w-5 shrink-0 text-success-600" aria-label="Healthy" />
  ) : (
    <XCircle className="h-5 w-5 shrink-0 text-danger-600" aria-label="Unavailable" />
  )
}

function LatencyHistory({ samples }: { samples: ProbeSample[] }) {
  const points = samples
    .map((sample, index) => ({ sample, index }))
    .filter((point): point is { sample: ProbeSample & { responseTimeMs: number }; index: number } =>
      point.sample.responseTimeMs != null,
    )
  const values = points.map(({ sample }) => sample.responseTimeMs)
  const min = Math.min(0, ...values)
  const max = Math.max(100, ...values)
  const width = 560
  const height = 150
  const padding = 12
  const x = (index: number) =>
    samples.length <= 1
      ? width / 2
      : padding + (index / (samples.length - 1)) * (width - padding * 2)
  const y = (value: number) => height - padding - ((value - min) / (max - min || 1)) * (height - padding * 2)
  const line = points.map(({ sample, index }) => `${x(index)},${y(sample.responseTimeMs)}`).join(' ')

  return (
    <div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={`API response time history: ${values.length} successful checks`}
        className="h-40 w-full overflow-visible"
      >
        {[0, 0.5, 1].map((fraction) => {
          const lineY = padding + fraction * (height - padding * 2)
          return <line key={fraction} x1={padding} x2={width - padding} y1={lineY} y2={lineY} stroke="#EDEDED" strokeDasharray="4 5" />
        })}
        {line && <polyline points={line} fill="none" stroke="#111111" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />}
        {points.map(({ sample, index }) => (
          <circle key={`${sample.label}-${index}`} cx={x(index)} cy={y(sample.responseTimeMs)} r="4" fill="#C7A67F" stroke="white" strokeWidth="2">
            <title>{`${sample.label}: ${sample.responseTimeMs} ms`}</title>
          </circle>
        ))}
        {samples.map((sample, index) =>
          sample.responseTimeMs == null ? (
            <circle key={`${sample.label}-missed-${index}`} cx={x(index)} cy={height - padding} r="4" fill="#DC2626">
              <title>{`${sample.label}: API check failed`}</title>
            </circle>
          ) : null,
        )}
      </svg>
      <div className="flex items-center justify-between text-xs text-ink-500">
        <span>Last {samples.length} checks</span>
        <span>{values.length ? `Scale: 0–${Math.ceil(max)} ms` : 'Waiting for first successful check'}</span>
      </div>
    </div>
  )
}

function MonitoringContent({ snapshot, error, history, refreshing, onRefresh }: {
  snapshot: MonitoringSnapshot | null
  error: string | null
  history: ProbeSample[]
  refreshing: boolean
  onRefresh: () => void
}) {
  const failures = snapshot?.logs.recentFailures ?? []
  const successCount = history.filter((sample) => sample.healthy).length
  const availability = history.length ? `${Math.round((successCount / history.length) * 100)}%` : '—'
  const database = snapshot?.checks.find((check) => check.key === 'database')
  const logsAvailable = snapshot?.checks.find((check) => check.key === 'logs')?.status === 'healthy'
  const memoryPercent =
    snapshot?.runtime.memoryLimitBytes && snapshot.runtime.memoryLimitBytes > 0
      ? Math.min(100, Math.round((snapshot.runtime.memoryUsageBytes / snapshot.runtime.memoryLimitBytes) * 100))
      : null
  const statusHealthy = !error && snapshot?.status === 'healthy'
  const overallStatus = error ? 'Monitor unreachable' : snapshot ? (statusHealthy ? 'All monitored services operational' : 'Service degradation detected') : 'Waiting for live status'

  return (
    <div className="space-y-6">
      <PageHeader
        title="System monitor"
        description="Live application, dependency and runtime signals for RAGIZE."
        actions={
          <Button variant="outline" onClick={onRefresh} loading={refreshing}>
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
        }
      />

      {error && (
        <div role="alert" className="flex items-start gap-3 rounded-card border border-danger-200 bg-danger-50 p-4 text-sm text-danger-800">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
          <div>
            <p className="font-semibold">Monitoring data could not be refreshed</p>
            <p className="mt-1">{error}. Check API availability and try again.</p>
          </div>
        </div>
      )}

      <Card>
        <CardBody className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className={`flex h-11 w-11 items-center justify-center rounded-full ${statusHealthy ? 'bg-success-50 text-success-700' : 'bg-danger-50 text-danger-700'}`}>
              {statusHealthy ? <CheckCircle2 className="h-6 w-6" /> : <AlertTriangle className="h-6 w-6" />}
            </span>
            <div>
              <h2 className="font-semibold text-ink">{overallStatus}</h2>
              <p className="mt-1 text-sm text-ink-500">
                {snapshot ? `${error ? 'Last successful check' : 'Last checked'} ${formatTime(snapshot.checkedAt)}` : 'The monitor checks the live backend every 30 seconds.'}
              </p>
            </div>
          </div>
          <Badge tone={error || (snapshot && !statusHealthy) ? 'danger' : snapshot ? 'success' : 'neutral'}>
            {error ? 'check failed' : snapshot ? snapshot.status : 'Connecting'}
          </Badge>
        </CardBody>
      </Card>

      <section aria-label="Performance summary" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="API response" value={snapshot ? `${snapshot.responseTimeMs} ms` : '—'} icon={<Activity className="h-4 w-4" />} hint="admin check round trip" />
        <StatCard label="Session availability" value={availability} icon={<Gauge className="h-4 w-4" />} hint={`${successCount}/${history.length} checks passed in this session`} />
        <StatCard label="Server errors" value={snapshot ? String(snapshot.logs.failuresLastHour) : '—'} icon={<AlertTriangle className="h-4 w-4" />} hint="last hour" />
        <StatCard label="PHP request memory" value={snapshot ? formatBytes(snapshot.runtime.memoryUsageBytes) : '—'} icon={<MemoryStick className="h-4 w-4" />} hint={memoryPercent == null ? 'current monitoring request' : `${memoryPercent}% of PHP memory limit`} />
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.3fr)_minmax(300px,0.7fr)]">
        <Card>
          <CardHeader>
            <div>
              <CardTitle>API response time</CardTitle>
              <p className="mt-1 text-sm text-ink-500">Round-trip time from this browser to the monitoring API.</p>
            </div>
            <Clock3 className="h-5 w-5 text-ink-400" />
          </CardHeader>
          <CardBody>
            <LatencyHistory samples={history} />
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <div>
              <CardTitle>Service checks</CardTitle>
              <p className="mt-1 text-sm text-ink-500">The API and its critical dependencies.</p>
            </div>
            <Server className="h-5 w-5 text-ink-400" />
          </CardHeader>
          <div className="divide-y divide-ink-100">
            {snapshot ? snapshot.checks.map((check) => (
              <div key={check.key} className="flex items-start gap-3 px-5 py-4">
                <StatusMark healthy={check.status === 'healthy'} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-ink">{check.label}</p>
                  <p className="mt-1 text-xs text-ink-500">{check.detail}</p>
                </div>
                {check.responseTimeMs != null && <span className="text-xs tabular-nums text-ink-500">{check.responseTimeMs} ms</span>}
              </div>
            )) : (
              <p className="px-5 py-8 text-center text-sm text-ink-500">No live service data yet.</p>
            )}
          </div>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Runtime resources</CardTitle>
              <p className="mt-1 text-sm text-ink-500">Snapshot of the PHP request serving this monitor.</p>
            </div>
            <Database className="h-5 w-5 text-ink-400" />
          </CardHeader>
          <CardBody className="grid gap-5 sm:grid-cols-2">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-ink-400">PHP version</p>
              <p className="mt-1 text-lg font-semibold text-ink">{snapshot?.runtime.phpVersion ?? '—'}</p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-ink-400">Peak request memory</p>
              <p className="mt-1 text-lg font-semibold text-ink">{snapshot ? formatBytes(snapshot.runtime.peakMemoryUsageBytes) : '—'}</p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-ink-400">Database probe</p>
              <p className="mt-1 text-lg font-semibold text-ink">{database?.responseTimeMs != null ? `${database.responseTimeMs} ms` : '—'}</p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-ink-400">Host load average (1 / 5 / 15 min)</p>
              <p className="mt-1 text-lg font-semibold text-ink">{snapshot?.runtime.loadAverage?.join(' / ') ?? 'Not available'}</p>
            </div>
            {snapshot && (
              <div className="sm:col-span-2">
                <div className="mb-1 flex justify-between text-xs text-ink-500">
                  <span>PHP memory limit</span>
                  <span>{formatBytes(snapshot.runtime.memoryLimitBytes)}</span>
                </div>
                {memoryPercent != null && (
                  <div
                    className="h-2 overflow-hidden rounded-full bg-ink-100"
                    role="progressbar"
                    aria-label="PHP request memory usage"
                    aria-valuenow={memoryPercent}
                    aria-valuemin={0}
                    aria-valuemax={100}
                  >
                    <div className={`h-full rounded-full ${memoryPercent >= 85 ? 'bg-danger-600' : 'bg-ink-700'}`} style={{ width: `${memoryPercent}%` }} />
                  </div>
                )}
              </div>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <div>
              <CardTitle>Recent server failures</CardTitle>
              <p className="mt-1 text-sm text-ink-500">Errors and critical failures found in the last 24 hours.</p>
            </div>
            <HardDrive className="h-5 w-5 text-ink-400" />
          </CardHeader>
          {failures.length ? (
            <ul className="max-h-[360px] divide-y divide-ink-100 overflow-y-auto">
              {failures.map((failure, index) => (
                <li key={`${failure.time}-${failure.requestId ?? index}`} className="px-5 py-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={failure.level === 'critical' ? 'danger' : 'warning'} size="sm">{failure.level}</Badge>
                    <span className="text-xs text-ink-500">{formatTime(failure.time)}</span>
                  </div>
                  <p className="mt-2 break-words text-sm font-medium text-ink">{failure.summary}</p>
                  <div className="mt-1 space-y-0.5 text-xs text-ink-500">
                    {failure.exception && <p>Exception: <span className="font-mono">{failure.exception}</span></p>}
                    {failure.source && <p>Source: <span className="font-mono">{failure.source}</span></p>}
                    {failure.requestId && <p>Request ID: <span className="font-mono">{failure.requestId}</span></p>}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <CardBody className="py-10 text-center">
              {logsAvailable ? (
                <CheckCircle2 className="mx-auto h-8 w-8 text-success-600" />
              ) : (
                <AlertTriangle className="mx-auto h-8 w-8 text-gold-600" />
              )}
              <p className="mt-2 text-sm font-medium text-ink">
                {!snapshot ? 'Failure history is not available yet' : logsAvailable ? 'No recent server failures' : 'Failure history is unavailable'}
              </p>
              <p className="mt-1 text-xs text-ink-500">
                {!snapshot
                  ? 'Failure history appears after live data loads.'
                  : logsAvailable
                    ? `${snapshot.logs.warningsLastHour} warning(s) recorded in the last hour.`
                    : 'Check the error log storage service status above.'}
              </p>
            </CardBody>
          )}
        </Card>
      </div>

      <p className="flex items-start gap-2 text-xs leading-relaxed text-ink-500">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
        This screen samples the API every 30 seconds while open. Availability history is kept only for this browser session; use a hosted uptime/alerting service and production load tests for continuous monitoring and capacity planning.
      </p>
    </div>
  )
}

export default function AdminMonitoringPage() {
  const [snapshot, setSnapshot] = useState<MonitoringSnapshot | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [history, setHistory] = useState<ProbeSample[]>([])
  const [refreshing, setRefreshing] = useState(false)
  const inFlight = useRef(false)

  const loadSnapshot = useCallback(async () => {
    if (LOCAL_DEMO || inFlight.current) return
    inFlight.current = true
    setRefreshing(true)
    try {
      const result = await adminService.fetchMonitoring()
      setSnapshot(result)
      setError(null)
      setHistory((previous) => [
        ...previous,
        {
          label: new Date().toLocaleTimeString(),
          responseTimeMs: result.responseTimeMs,
          healthy: result.status === 'healthy',
        },
      ].slice(-12))
    } catch (reason) {
      setError(errorMessage(reason))
      setHistory((previous) => [
        ...previous,
        { label: new Date().toLocaleTimeString(), responseTimeMs: null, healthy: false },
      ].slice(-12))
    } finally {
      inFlight.current = false
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    if (LOCAL_DEMO) return
    void loadSnapshot()
    const interval = window.setInterval(() => void loadSnapshot(), 30_000)
    return () => window.clearInterval(interval)
  }, [loadSnapshot])

  if (LOCAL_DEMO) {
    return (
      <div className="space-y-6">
        <PageHeader title="System monitor" description="Live application, dependency and runtime signals for RAGIZE." />
        <Card>
          <CardBody className="flex items-start gap-3 py-8">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-gold-600" />
            <div>
              <h2 className="font-semibold text-ink">Live monitoring is unavailable in demo mode</h2>
              <p className="mt-1 max-w-2xl text-sm text-ink-500">
                Demo mode uses browser-only sample data and does not connect to the PHP API or database. Set <code className="rounded bg-ink-100 px-1">VITE_LOCAL_DEMO=false</code> and run the backend to view real system health.
              </p>
            </div>
          </CardBody>
        </Card>
      </div>
    )
  }

  return <MonitoringContent snapshot={snapshot} error={error} history={history} refreshing={refreshing} onRefresh={() => void loadSnapshot()} />
}
