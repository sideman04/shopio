import { useEffect, useMemo, useState } from 'react'
import {
  Ban,
  Check,
  ExternalLink,
  MoreHorizontal,
  Pause,
  Percent,
  Play,
  Store,
  X,
} from 'lucide-react'
import {
  Alert,
  Badge,
  Button,
  ConfirmDialog,
  DataList,
  Dropdown,
  EmptyState,
  Input,
  Modal,
  PageHeader,
  Pagination,
  SmartImage,
  Stars,
  StatCard,
  StatusBadge,
  Tabs,
  TBody,
  TD,
  TH,
  THead,
  TR,
  Table,
  Textarea,
} from '@/components/ui'
import { DataToolbar } from '@/components/tables/DataToolbar'
import { adminService } from '@/services'
import { usePeopleStore } from '@/context/peopleStore'
import { toast } from '@/context/uiStore'
import type { Seller } from '@/types'
import { formatCurrency, formatDate, formatNumber } from '@/lib/utils'

const PAGE_SIZE = 8

const STATUS_TONES: Record<Seller['status'], 'success' | 'warning' | 'danger' | 'neutral'> = {
  active: 'success',
  paused: 'warning',
  suspended: 'danger',
  closed: 'neutral',
}

/** Seller directory with verification review, commission and status controls. */
export default function AdminSellersPage() {
  const sellers = usePeopleStore((s) => s.sellers)

  const [tab, setTab] = useState('all')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<number[]>([])

  const [reviewSeller, setReviewSeller] = useState<Seller | null>(null)
  const [rejectMode, setRejectMode] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [busy, setBusy] = useState(false)

  const [commissionSeller, setCommissionSeller] = useState<Seller | null>(null)
  const [commissionValue, setCommissionValue] = useState('10')

  const [confirm, setConfirm] = useState<{ seller: Seller; status: Seller['status'] } | null>(null)
  const [bulk, setBulk] = useState<{ ids: number[]; action: 'approve' | 'reject' } | null>(null)
  const [bulkReason, setBulkReason] = useState('')

  useEffect(() => {
    setPage(1)
  }, [tab, search])

  useEffect(() => {
    void adminService.fetchSellers({ pageSize: 100 }).catch(() => undefined)
  }, [])

  const counts = useMemo(
    () => ({
      all: sellers.length,
      pending: sellers.filter((s) => s.verificationStatus === 'pending').length,
      approved: sellers.filter((s) => s.verificationStatus === 'approved').length,
      rejected: sellers.filter((s) => s.verificationStatus === 'rejected').length,
      suspended: sellers.filter((s) => s.status === 'suspended').length,
    }),
    [sellers],
  )

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase()
    return sellers.filter((seller) => {
      if (tab === 'pending' && seller.verificationStatus !== 'pending') return false
      if (tab === 'approved' && seller.verificationStatus !== 'approved') return false
      if (tab === 'rejected' && seller.verificationStatus !== 'rejected') return false
      if (tab === 'suspended' && seller.status !== 'suspended') return false
      if (needle) {
        const haystack = [seller.storeName, seller.ownerName ?? '', seller.ownerEmail ?? '', seller.storeSlug]
          .join(' ')
          .toLowerCase()
        if (!haystack.includes(needle)) return false
      }
      return true
    })
  }, [sellers, tab, search])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const paged = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  const totalSales = useMemo(() => sellers.reduce((sum, s) => sum + (s.totalSales ?? 0), 0), [sellers])

  const selectedPending = selected.filter((id) => sellers.find((s) => s.id === id)?.verificationStatus === 'pending')

  const openReview = (seller: Seller) => {
    setReviewSeller(seller)
    setRejectMode(false)
    setRejectReason('')
  }

  const approve = async (seller: Seller) => {
    setBusy(true)
    try {
      await adminService.setSellerVerification(seller.id, 'approved')
      toast.success('Seller approved', `${seller.storeName} is now verified and can list products.`)
      setReviewSeller(null)
    } finally {
      setBusy(false)
    }
  }

  const reject = async (seller: Seller, reason: string) => {
    if (!reason.trim()) {
      toast.error('A reason is required', 'Explain what the seller needs to correct before resubmitting.')
      return
    }
    setBusy(true)
    try {
      await adminService.setSellerVerification(seller.id, 'rejected', reason.trim())
      toast.success('Application rejected', `${seller.storeName} was notified with your reason.`)
      setReviewSeller(null)
      setRejectMode(false)
      setRejectReason('')
    } finally {
      setBusy(false)
    }
  }

  const saveCommission = () => {
    if (!commissionSeller) return
    const value = Number(commissionValue)
    if (!Number.isFinite(value) || value < 0 || value > 40) {
      toast.error('Enter a valid commission', 'Commission must be between 0% and 40%.')
      return
    }
    usePeopleStore.getState().updateSeller(commissionSeller.id, { commissionRate: value })
    toast.success('Commission updated', `${commissionSeller.storeName} now pays ${value}% per sale.`)
    setCommissionSeller(null)
  }

  const runBulk = async () => {
    if (!bulk) return
    setBusy(true)
    try {
      if (bulk.action === 'approve') {
        await Promise.all(bulk.ids.map((id) => adminService.setSellerVerification(id, 'approved')))
        toast.success('Applications approved', `${bulk.ids.length} seller${bulk.ids.length === 1 ? '' : 's'} verified.`)
      } else {
        if (!bulkReason.trim()) {
          toast.error('A reason is required', 'Provide a reason so sellers know what to fix.')
          setBusy(false)
          return
        }
        await Promise.all(bulk.ids.map((id) => adminService.setSellerVerification(id, 'rejected', bulkReason.trim())))
        toast.success('Applications rejected', `${bulk.ids.length} application${bulk.ids.length === 1 ? '' : 's'} rejected.`)
      }
      setBulk(null)
      setBulkReason('')
      setSelected([])
    } finally {
      setBusy(false)
    }
  }

  const setSellerStatus = async (seller: Seller, status: Seller['status']) => {
    setBusy(true)
    try {
      await adminService.setSellerStatus(seller.id, status)
      toast.success('Seller status updated', `${seller.storeName} is now ${status}.`)
      setConfirm(null)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Sellers"
        description="Review applications, set commissions and manage store access."
      />

      <section aria-label="Seller summary" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <StatCard label="Total sellers" value={formatNumber(counts.all)} icon={<Store className="h-4 w-4" />} hint="all stores" />
        <StatCard label="Pending applications" value={formatNumber(counts.pending)} icon={<Check className="h-4 w-4" />} hint="awaiting review" />
        <StatCard label="Approved" value={formatNumber(counts.approved)} icon={<Check className="h-4 w-4" />} hint="verified stores" />
        <StatCard label="Suspended" value={formatNumber(counts.suspended)} icon={<Ban className="h-4 w-4" />} hint="access paused" />
        <StatCard label="Platform sales" value={formatCurrency(totalSales, { compact: true })} icon={<Percent className="h-4 w-4" />} hint="lifetime GMV" />
      </section>

      <Tabs
        value={tab}
        onChange={setTab}
        items={[
          { id: 'all', label: 'All', badge: <Badge tone="neutral" size="sm">{counts.all}</Badge> },
          { id: 'pending', label: 'Pending verification', badge: <Badge tone="warning" size="sm">{counts.pending}</Badge> },
          { id: 'approved', label: 'Approved', badge: <Badge tone="success" size="sm">{counts.approved}</Badge> },
          { id: 'rejected', label: 'Rejected', badge: <Badge tone="danger" size="sm">{counts.rejected}</Badge> },
          { id: 'suspended', label: 'Suspended', badge: <Badge tone="neutral" size="sm">{counts.suspended}</Badge> },
        ]}
      />

      <div className="rounded-card border border-ink-200 bg-white shadow-card">
        <DataToolbar searchValue={search} onSearchChange={setSearch} searchPlaceholder="Search stores or owners" />

        {selectedPending.length > 0 && (
          <div className="flex flex-wrap items-center gap-3 border-b border-ink-200 bg-sand-50 px-4 py-3">
            <p className="text-sm font-medium text-ink">{selectedPending.length} pending application{selectedPending.length === 1 ? '' : 's'} selected</p>
            <div className="ml-auto flex flex-wrap gap-2">
              <Button size="sm" onClick={() => setBulk({ ids: selectedPending, action: 'approve' })}>
                Approve selected
              </Button>
              <Button size="sm" variant="danger" onClick={() => setBulk({ ids: selectedPending, action: 'reject' })}>
                Reject selected
              </Button>
            </div>
          </div>
        )}

        {paged.length === 0 ? (
          <div className="p-6">
            <EmptyState
              size="sm"
              icon={<Store className="h-5 w-5" />}
              title="No sellers in this view"
              description="Adjust the tab or search to find a store."
            />
          </div>
        ) : (
          <>
            <Table>
              <THead>
                <TR>
                  <TH className="w-10">
                    <span className="sr-only">Select</span>
                  </TH>
                  <TH>Store</TH>
                  <TH>Owner</TH>
                  <TH>Category</TH>
                  <TH>Products</TH>
                  <TH>Sales</TH>
                  <TH>Rating</TH>
                  <TH>Verification</TH>
                  <TH>Status</TH>
                  <TH className="text-right">Actions</TH>
                </TR>
              </THead>
              <TBody>
                {paged.map((seller) => {
                  const selectable = seller.verificationStatus === 'pending'
                  return (
                    <TR key={seller.id}>
                      <TD>
                        <input
                          type="checkbox"
                          aria-label={`Select ${seller.storeName}`}
                          disabled={!selectable}
                          checked={selected.includes(seller.id)}
                          onChange={() =>
                            setSelected((current) =>
                              current.includes(seller.id) ? current.filter((x) => x !== seller.id) : [...current, seller.id],
                            )
                          }
                          className="h-4 w-4 cursor-pointer appearance-none rounded border border-ink-300 bg-white checked:border-ink checked:bg-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/70 disabled:cursor-not-allowed disabled:opacity-40"
                        />
                      </TD>
                      <TD>
                        <div className="flex items-center gap-3">
                          <SmartImage
                            src={seller.logoUrl ?? undefined}
                            alt={seller.storeName}
                            wrapperClassName="h-10 w-10 shrink-0 rounded-lg"
                            fallbackLabel={seller.storeName}
                          />
                          <div className="min-w-0">
                            <p className="truncate font-medium text-ink">{seller.storeName}</p>
                            <p className="truncate text-xs text-ink-500">/{seller.storeSlug}</p>
                          </div>
                        </div>
                      </TD>
                      <TD>
                        <p className="truncate font-medium text-ink-700">{seller.ownerName ?? '—'}</p>
                        <p className="truncate text-xs text-ink-500">{seller.ownerEmail ?? '—'}</p>
                      </TD>
                      <TD className="whitespace-nowrap">{seller.businessCategory ?? '—'}</TD>
                      <TD>{formatNumber(seller.productCount ?? 0)}</TD>
                      <TD className="whitespace-nowrap">{formatCurrency(seller.totalSales ?? 0, { compact: true })}</TD>
                      <TD>{seller.rating != null ? <Stars rating={seller.rating} size="sm" showValue /> : '—'}</TD>
                      <TD>
                        <StatusBadge status={seller.verificationStatus} kind="verification" />
                      </TD>
                      <TD>
                        <Badge tone={STATUS_TONES[seller.status]}>{seller.status}</Badge>
                      </TD>
                      <TD className="text-right">
                        <Dropdown
                          label={`Actions for ${seller.storeName}`}
                          trigger={
                            <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-ink-500 hover:bg-ink-100 hover:text-ink">
                              <MoreHorizontal className="h-4 w-4" />
                            </span>
                          }
                          items={[
                            { label: 'Review application', icon: <Check className="h-4 w-4" />, onClick: () => openReview(seller) },
                            {
                              label: 'View store',
                              icon: <ExternalLink className="h-4 w-4" />,
                              to: `/search?q=${encodeURIComponent(seller.storeName)}`,
                            },
                            {
                              label: 'Set commission',
                              icon: <Percent className="h-4 w-4" />,
                              onClick: () => {
                                setCommissionSeller(seller)
                                setCommissionValue(String(seller.commissionRate))
                              },
                            },
                            { label: 'Activate', icon: <Play className="h-4 w-4" />, divider: true, onClick: () => setSellerStatus(seller, 'active') },
                            { label: 'Pause', icon: <Pause className="h-4 w-4" />, onClick: () => setSellerStatus(seller, 'paused') },
                            {
                              label: 'Suspend',
                              icon: <Ban className="h-4 w-4" />,
                              tone: 'danger',
                              onClick: () => setConfirm({ seller, status: 'suspended' }),
                            },
                          ]}
                        />
                      </TD>
                    </TR>
                  )
                })}
              </TBody>
            </Table>

            <div className="p-4">
              <Pagination page={safePage} totalPages={totalPages} onPageChange={setPage} totalItems={filtered.length} pageSize={PAGE_SIZE} />
            </div>
          </>
        )}
      </div>

      {/* Review application */}
      <Modal
        open={!!reviewSeller}
        onClose={() => setReviewSeller(null)}
        title="Review seller application"
        description={reviewSeller ? `Submitted ${formatDate(reviewSeller.createdAt, 'long')}` : undefined}
        size="lg"
        footer={
          reviewSeller ? (
            rejectMode ? (
              <>
                <Button variant="outline" onClick={() => setRejectMode(false)} disabled={busy}>
                  Back
                </Button>
                <Button variant="danger" onClick={() => reject(reviewSeller, rejectReason)} loading={busy}>
                  Confirm rejection
                </Button>
              </>
            ) : (
              <>
                <Button variant="outline" onClick={() => setRejectMode(true)} disabled={busy}>
                  <X className="h-4 w-4" />
                  Reject
                </Button>
                <Button onClick={() => approve(reviewSeller)} loading={busy}>
                  <Check className="h-4 w-4" />
                  Approve
                </Button>
              </>
            )
          ) : undefined
        }
      >
        {reviewSeller && (
          <div className="space-y-5">
            <div className="flex items-center gap-4">
              <SmartImage
                src={reviewSeller.logoUrl ?? undefined}
                alt={reviewSeller.storeName}
                wrapperClassName="h-14 w-14 shrink-0 rounded-xl"
                fallbackLabel={reviewSeller.storeName}
              />
              <div className="min-w-0">
                <p className="truncate text-base font-semibold text-ink">{reviewSeller.storeName}</p>
                <p className="truncate text-sm text-ink-500">{reviewSeller.storeDescription}</p>
              </div>
            </div>

            {reviewSeller.verificationNotes && (
              <Alert tone="warning" title="Previous review notes">
                {reviewSeller.verificationNotes}
              </Alert>
            )}

            <DataList
              items={[
                { label: 'Owner', value: reviewSeller.ownerName ?? '—' },
                { label: 'Owner email', value: reviewSeller.ownerEmail ?? '—' },
                { label: 'Phone', value: reviewSeller.ownerPhone ?? '—' },
                { label: 'Address', value: reviewSeller.address ?? '—' },
                { label: 'Business category', value: reviewSeller.businessCategory ?? '—' },
                { label: 'Commission rate', value: `${reviewSeller.commissionRate}%` },
                { label: 'Products listed', value: formatNumber(reviewSeller.productCount ?? 0) },
                { label: 'Submitted', value: formatDate(reviewSeller.createdAt, 'long') },
              ]}
            />

            {rejectMode && (
              <Textarea
                label="Reason for rejection"
                hint="This is shared with the seller so they can correct the application."
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                required
              />
            )}

            <p className="text-xs text-ink-500">
              Approving or rejecting updates the seller directory and writes an audit-log entry.
            </p>
          </div>
        )}
      </Modal>

      {/* Set commission */}
      <Modal
        open={!!commissionSeller}
        onClose={() => setCommissionSeller(null)}
        title="Set commission"
        description={commissionSeller ? `Platform commission for ${commissionSeller.storeName}.` : undefined}
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => setCommissionSeller(null)}>
              Cancel
            </Button>
            <Button onClick={saveCommission}>Save commission</Button>
          </>
        }
      >
        <Input
          label="Commission rate (%)"
          type="number"
          min={0}
          max={40}
          step={0.5}
          value={commissionValue}
          onChange={(e) => setCommissionValue(e.target.value)}
          hint="Applied to each completed sale at settlement."
        />
      </Modal>

      <ConfirmDialog
        open={!!confirm}
        onClose={() => setConfirm(null)}
        onConfirm={() => confirm && setSellerStatus(confirm.seller, confirm.status)}
        title={confirm ? `Suspend ${confirm.seller.storeName}?` : ''}
        description="A suspended store is hidden from the storefront and cannot list or fulfil orders until reactivated."
        confirmLabel="Suspend"
        tone="danger"
        loading={busy}
      />

      <ConfirmDialog
        open={!!bulk}
        onClose={() => {
          setBulk(null)
          setBulkReason('')
        }}
        onConfirm={runBulk}
        title={bulk?.action === 'approve' ? 'Approve selected applications?' : 'Reject selected applications?'}
        description={
          bulk?.action === 'approve'
            ? `${bulk?.ids.length ?? 0} seller application(s) will be verified and their stores activated.`
            : `${bulk?.ids.length ?? 0} seller application(s) will be rejected.`
        }
        confirmLabel={bulk?.action === 'approve' ? 'Approve all' : 'Reject all'}
        tone={bulk?.action === 'approve' ? 'default' : 'danger'}
        loading={busy}
      >
        {bulk?.action === 'reject' && (
          <Textarea
            label="Reason for rejection"
            value={bulkReason}
            onChange={(e) => setBulkReason(e.target.value)}
            required
          />
        )}
      </ConfirmDialog>
    </div>
  )
}
