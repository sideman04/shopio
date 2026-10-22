import { useEffect, useMemo, useState } from 'react'
import { Activity, CalendarDays, Download, Layers, Users } from 'lucide-react'
import {
  Avatar,
  Badge,
  Button,
  EmptyState,
  PageHeader,
  Pagination,
  Select,
  StatCard,
  Tabs,
  TBody,
  TD,
  TH,
  THead,
  TR,
  Table,
} from '@/components/ui'
import { DataToolbar } from '@/components/tables/DataToolbar'
import { useSystemStore } from '@/context/systemStore'
import { toast } from '@/context/uiStore'
import { adminService } from '@/services'
import type { ActivityLog } from '@/types'
import { formatDate, formatNumber, relativeTime, titleCase } from '@/lib/utils'

const PAGE_SIZE = 12

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

/** Append-only audit log of privileged actions across the platform. */
export default function AdminActivityPage() {
  const activity = useSystemStore((s) => s.activity)

  const [view, setView] = useState('timeline')
  const [search, setSearch] = useState('')
  const [entityType, setEntityType] = useState('all')
  const [range, setRange] = useState('all')
  const [page, setPage] = useState(1)

  useEffect(() => {
    setPage(1)
  }, [search, entityType, range])

  useEffect(() => {
    void adminService.fetchActivity().catch(() => undefined)
  }, [])

  const entityTypes = useMemo(
    () => Array.from(new Set(activity.map((entry) => entry.entityType))).sort(),
    [activity],
  )

  const stats = useMemo(() => {
    const today = new Date().toDateString()
    return {
      total: activity.length,
      today: activity.filter((entry) => new Date(entry.createdAt).toDateString() === today).length,
      actors: new Set(activity.map((entry) => entry.actorName)).size,
      entities: entityTypes.length,
    }
  }, [activity, entityTypes])

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase()
    const cutoff = range === 'all' ? null : Date.now() - Number(range) * 24 * 60 * 60 * 1000
    return activity
      .filter((entry) => {
        if (entityType !== 'all' && entry.entityType !== entityType) return false
        if (cutoff && new Date(entry.createdAt).getTime() < cutoff) return false
        if (needle) {
          const haystack = [entry.actorName, entry.action, entry.entityLabel, entry.entityType].join(' ').toLowerCase()
          if (!haystack.includes(needle)) return false
        }
        return true
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  }, [activity, search, entityType, range])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const paged = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  const grouped = useMemo(() => {
    const groups = new Map<string, ActivityLog[]>()
    paged.forEach((entry) => {
      const key = new Date(entry.createdAt).toDateString()
      const list = groups.get(key) ?? []
      list.push(entry)
      groups.set(key, list)
    })
    return Array.from(groups.entries())
  }, [paged])

  const handleExport = () => {
    downloadCsv('shopio-activity.csv', [
      ['Actor', 'Action', 'Entity type', 'Entity', 'Timestamp'],
      ...filtered.map((entry) => [entry.actorName, entry.action, entry.entityType, entry.entityLabel, entry.createdAt]),
    ])
    toast.success('Export ready', `${filtered.length} audit events exported to CSV.`)
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Activity log"
        description="Every privileged action recorded across the marketplace."
        actions={
          <Button variant="outline" onClick={handleExport}>
            <Download className="h-4 w-4" />
            Export CSV
          </Button>
        }
      />

      <section aria-label="Activity summary" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total events" value={formatNumber(stats.total)} icon={<Activity className="h-4 w-4" />} hint="all time" />
        <StatCard label="Events today" value={formatNumber(stats.today)} icon={<CalendarDays className="h-4 w-4" />} hint="since midnight" />
        <StatCard label="Distinct actors" value={formatNumber(stats.actors)} icon={<Users className="h-4 w-4" />} hint="staff and system" />
        <StatCard label="Entity types" value={formatNumber(stats.entities)} icon={<Layers className="h-4 w-4" />} hint="categories logged" />
      </section>

      <Tabs
        value={view}
        onChange={setView}
        items={[
          { id: 'timeline', label: 'Timeline' },
          { id: 'table', label: 'Table' },
        ]}
      />

      <div className="rounded-card border border-ink-200 bg-white shadow-card">
        <DataToolbar searchValue={search} onSearchChange={setSearch} searchPlaceholder="Search actor, action or entity">
          <label className="sr-only" htmlFor="activity-entity-filter">Entity type</label>
          <Select
            id="activity-entity-filter"
            value={entityType}
            onChange={(e) => setEntityType(e.target.value)}
            options={[{ label: 'All entity types', value: 'all' }, ...entityTypes.map((t) => ({ label: titleCase(t), value: t }))]}
            className="w-44"
          />
          <label className="sr-only" htmlFor="activity-range-filter">Date range</label>
          <Select
            id="activity-range-filter"
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

        {paged.length === 0 ? (
          <div className="p-6">
            <EmptyState
              size="sm"
              icon={<Activity className="h-5 w-5" />}
              title="No activity found"
              description="Adjust the search or filters to see audit events."
            />
          </div>
        ) : view === 'timeline' ? (
          <div className="space-y-6 p-4">
            {grouped.map(([day, entries]) => (
              <section key={day}>
                <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-ink-500">
                  {formatDate(entries[0].createdAt, 'long')}
                </h3>
                <ol className="space-y-4">
                  {entries.map((entry) => (
                    <li key={entry.id} className="flex gap-3">
                      <Avatar name={entry.actorName} size="sm" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-ink">
                          <span className="font-medium">{entry.actorName}</span> {entry.action.toLowerCase()}
                        </p>
                        <p className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-ink-500">
                          <span className="truncate">{entry.entityLabel}</span>
                          <Badge tone="neutral" size="sm">
                            {titleCase(entry.entityType)}
                          </Badge>
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-xs text-ink-500">{formatDate(entry.createdAt, 'time')}</p>
                        <p className="text-xs text-ink-400">{relativeTime(entry.createdAt)}</p>
                      </div>
                    </li>
                  ))}
                </ol>
              </section>
            ))}
          </div>
        ) : (
          <Table>
            <THead>
              <TR>
                <TH>Actor</TH>
                <TH>Action</TH>
                <TH>Entity</TH>
                <TH>When</TH>
              </TR>
            </THead>
            <TBody>
              {paged.map((entry) => (
                <TR key={entry.id}>
                  <TD>
                    <div className="flex items-center gap-3">
                      <Avatar name={entry.actorName} size="sm" />
                      <span className="font-medium text-ink">{entry.actorName}</span>
                    </div>
                  </TD>
                  <TD>{entry.action}</TD>
                  <TD>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="truncate text-ink-700">{entry.entityLabel}</span>
                      <Badge tone="neutral" size="sm">
                        {titleCase(entry.entityType)}
                      </Badge>
                    </div>
                  </TD>
                  <TD className="whitespace-nowrap">
                    <p className="text-ink-600">{formatDate(entry.createdAt, 'time')}</p>
                    <p className="text-xs text-ink-400">{relativeTime(entry.createdAt)}</p>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}

        <div className="p-4">
          <Pagination page={safePage} totalPages={totalPages} onPageChange={setPage} totalItems={filtered.length} pageSize={PAGE_SIZE} />
        </div>
      </div>

      <p className="text-xs text-ink-500">
        In production this audit log is append-only and records every privileged action with the acting administrator, timestamp and entity
        affected. Entries cannot be edited or deleted.
      </p>
    </div>
  )
}
