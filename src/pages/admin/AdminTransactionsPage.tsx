import { useEffect, useMemo, useState } from 'react'
import { Banknote, Check, Download, RotateCcw, Wallet, X } from 'lucide-react'
import {
  Alert,
  Badge,
  Button,
  ConfirmDialog,
  EmptyState,
  Modal,
  PageHeader,
  Pagination,
  Select,
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
  type DropdownItem,
} from '@/components/ui'
import { DataToolbar } from '@/components/tables/DataToolbar'
import { RowActions } from '@/components/tables/RowActions'
import { toast } from '@/context/uiStore'
import { adminService } from '@/services'
import { errorMessage } from '@/services/apiClient'
import type { Refund, SellerPayout, Transaction } from '@/types'
import { formatCurrency, formatDate, truncate } from '@/lib/utils'

const PAGE_SIZE = 8

const REFUND_TONES: Record<Refund['status'], 'neutral' | 'warning' | 'success' | 'danger' | 'info'> = {
  requested: 'warning',
  approved: 'info',
  processing: 'info',
  succeeded: 'success',
  rejected: 'danger',
  failed: 'danger',
}

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

/**
 * Transactions, refunds and payouts ledgers. Every figure and action comes from
 * the admin API; the server is the source of truth for money movements.
 */
export default function AdminTransactionsPage() {
  const [tab, setTab] = useState('transactions')

  const [txList, setTxList] = useState<Transaction[]>([])
  const [refundList, setRefundList] = useState<Refund[]>([])
  const [payoutList, setPayoutList] = useState<SellerPayout[]>([])
  const [loading, setLoading] = useState(true)

  const [search, setSearch] = useState('')
  const [method, setMethod] = useState('all')
  const [status, setStatus] = useState('all')
  const [txPage, setTxPage] = useState(1)

  const [refundPage, setRefundPage] = useState(1)
  const [refundDetail, setRefundDetail] = useState<Refund | null>(null)

  const [payoutPage, setPayoutPage] = useState(1)
  const [payoutDetail, setPayoutDetail] = useState<SellerPayout | null>(null)
  const [rejectPayout, setRejectPayout] = useState<SellerPayout | null>(null)
  const [approvePayoutTarget, setApprovePayoutTarget] = useState<SellerPayout | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [loadError, setLoadError] = useState<string | null>(null)
  const [refundBusy, setRefundBusy] = useState<number | null>(null)
  const [payoutBusy, setPayoutBusy] = useState<number | null>(null)

  const load = async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const [tx, refunds, payouts] = await Promise.all([
        adminService.fetchTransactions({ pageSize: 100 }),
        adminService.fetchRefunds({ pageSize: 100 }),
        adminService.fetchPayouts({ pageSize: 100 }),
      ])
      setTxList(tx.items)
      setRefundList(refunds.items)
      setPayoutList(payouts.items)
    } catch (error) {
      const message = errorMessage(error)
      setLoadError(message)
      toast.error('Could not load ledgers', message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    setTxPage(1)
  }, [search, method, status])

  const methods = useMemo(() => Array.from(new Set(txList.map((t) => t.method))), [txList])

  const filteredTx = useMemo(() => {
    const needle = search.trim().toLowerCase()
    return txList.filter((tx) => {
      if (method !== 'all' && tx.method !== method) return false
      if (status !== 'all' && tx.status !== status) return false
      if (needle) {
        const haystack = [tx.reference, tx.orderNumber, tx.customerName, tx.sellerName].join(' ').toLowerCase()
        if (!haystack.includes(needle)) return false
      }
      return true
    })
  }, [txList, search, method, status])

  const txTotalPages = Math.max(1, Math.ceil(filteredTx.length / PAGE_SIZE))
  const txSafePage = Math.min(txPage, txTotalPages)
  const pagedTx = filteredTx.slice((txSafePage - 1) * PAGE_SIZE, txSafePage * PAGE_SIZE)

  const refundTotalPages = Math.max(1, Math.ceil(refundList.length / PAGE_SIZE))
  const refundSafePage = Math.min(refundPage, refundTotalPages)
  const pagedRefunds = refundList.slice((refundSafePage - 1) * PAGE_SIZE, refundSafePage * PAGE_SIZE)

  const payoutTotalPages = Math.max(1, Math.ceil(payoutList.length / PAGE_SIZE))
  const payoutSafePage = Math.min(payoutPage, payoutTotalPages)
  const pagedPayouts = payoutList.slice((payoutSafePage - 1) * PAGE_SIZE, payoutSafePage * PAGE_SIZE)

  const stats = useMemo(() => {
    const gross = txList.reduce((sum, t) => sum + t.amount, 0)
    const commission = txList.reduce((sum, t) => sum + t.commission, 0)
    const net = txList.reduce((sum, t) => sum + t.netToSeller, 0)
    const refunded = refundList.filter((r) => r.status === 'succeeded').reduce((sum, r) => sum + r.amount, 0)
    const pendingPayouts = payoutList
      .filter((p) => p.status === 'pending' || p.status === 'processing' || p.status === 'requested')
      .reduce((sum, p) => sum + p.amount, 0)
    return { gross, commission, net, refunded, pendingPayouts }
  }, [txList, refundList, payoutList])

  const updateRefund = async (
    refund: Refund,
    next: 'approved' | 'rejected' | 'processing' | 'succeeded' | 'failed',
  ) => {
    setRefundBusy(refund.id)
    try {
      const updated = await adminService.decideRefund(refund.id, next)
      setRefundList((list) => list.map((r) => (r.id === refund.id ? updated : r)))
      setRefundDetail(null)
      toast.success(`Refund marked as ${next}`, `Refund for ${refund.orderNumber} was updated.`)
    } catch (error) {
      toast.error('Refund not updated', errorMessage(error))
    } finally {
      setRefundBusy(null)
    }
  }

  const confirmApprovePayout = async () => {
    if (!approvePayoutTarget) return
    setPayoutBusy(approvePayoutTarget.id)
    try {
      const updated = await adminService.decidePayout(approvePayoutTarget.id, 'paid')
      setPayoutList((list) => list.map((p) => (p.id === approvePayoutTarget.id ? updated : p)))
      toast.success('Payout approved', `${approvePayoutTarget.payoutReference} was marked as paid.`)
      setApprovePayoutTarget(null)
    } catch (error) {
      toast.error('Payout not approved', errorMessage(error))
    } finally {
      setPayoutBusy(null)
    }
  }

  const rejectPayoutConfirm = async () => {
    if (!rejectPayout) return
    if (!rejectReason.trim()) {
      toast.error('A reason is required', 'Explain why the payout was rejected.')
      return
    }
    setPayoutBusy(rejectPayout.id)
    try {
      const updated = await adminService.decidePayout(rejectPayout.id, 'rejected', rejectReason.trim())
      setPayoutList((list) => list.map((p) => (p.id === rejectPayout.id ? updated : p)))
      toast.success('Payout rejected', `${rejectPayout.payoutReference} was rejected with your note.`)
      setRejectPayout(null)
      setRejectReason('')
    } catch (error) {
      toast.error('Payout not rejected', errorMessage(error))
    } finally {
      setPayoutBusy(null)
    }
  }

  const refundActions = (refund: Refund): DropdownItem[] => {
    const actions: DropdownItem[] = [
      { label: 'View details', onClick: () => setRefundDetail(refund) },
    ]
    if (['succeeded', 'rejected', 'failed'].includes(refund.status)) {
      return actions
    }

    const disabled = refundBusy === refund.id
    if (refund.status === 'requested') {
      actions.push({
        label: 'Approve request',
        icon: <Check className="h-4 w-4" />,
        divider: true,
        disabled,
        onClick: () => updateRefund(refund, 'approved'),
      })
    }
    if (refund.status === 'requested' || refund.status === 'approved') {
      actions.push({
        label: 'Mark processing',
        disabled,
        onClick: () => updateRefund(refund, 'processing'),
      })
    }
    actions.push({
      label: 'Complete refund',
      icon: <RotateCcw className="h-4 w-4" />,
      divider: true,
      disabled,
      onClick: () => updateRefund(refund, 'succeeded'),
    })
    actions.push({
      label: 'Reject request',
      icon: <X className="h-4 w-4" />,
      tone: 'danger',
      divider: true,
      disabled,
      onClick: () => updateRefund(refund, 'rejected'),
    })

    return actions
  }

  const payoutActions = (payout: SellerPayout): DropdownItem[] => {
    const actions: DropdownItem[] = [
      { label: 'View details', onClick: () => setPayoutDetail(payout) },
    ]
    if (!['pending', 'processing', 'requested'].includes(payout.status)) {
      return actions
    }

    const disabled = payoutBusy === payout.id
    actions.push({
      label: 'Approve & pay',
      icon: <Check className="h-4 w-4" />,
      divider: true,
      disabled,
      onClick: () => setApprovePayoutTarget(payout),
    })
    actions.push({
      label: 'Reject payout',
      icon: <X className="h-4 w-4" />,
      tone: 'danger',
      disabled,
      onClick: () => setRejectPayout(payout),
    })

    return actions
  }

  const handleExport = () => {
    if (tab === 'transactions') {
      downloadCsv('shopio-transactions.csv', [
        ['Reference', 'Order', 'Customer', 'Seller', 'Amount', 'Commission', 'Net to seller', 'Method', 'Status', 'Date'],
        ...filteredTx.map((t) => [t.reference, t.orderNumber, t.customerName, t.sellerName, t.amount, t.commission, t.netToSeller, t.method, t.status, t.createdAt]),
      ])
    } else if (tab === 'refunds') {
      downloadCsv('shopio-refunds.csv', [
        ['ID', 'Order', 'Customer', 'Amount', 'Reason', 'Status', 'Requested'],
        ...refundList.map((r) => [r.id, r.orderNumber, r.customerName, r.amount, r.reason, r.status, r.createdAt]),
      ])
    } else {
      downloadCsv('shopio-payouts.csv', [
        ['Reference', 'Seller', 'Amount', 'Method', 'Status', 'Requested', 'Processed', 'Note'],
        ...payoutList.map((p) => [p.payoutReference, p.sellerId, p.amount, p.payoutMethod ?? '', p.status, p.requestedAt, p.processedAt ?? '', p.adminNote ?? '']),
      ])
    }
    toast.success('Export ready', 'The current ledger view was exported to CSV.')
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Transactions"
        description="Three related ledgers: captured transactions, refunds and seller payouts."
        actions={
          <Button variant="outline" onClick={handleExport}>
            <Download className="h-4 w-4" />
            Export CSV
          </Button>
        }
      />

      {loadError && (
        <Alert tone="danger" title="Could not load ledgers">
          <div className="flex flex-wrap items-center gap-3">
            <span>{loadError}</span>
            <Button size="sm" variant="outline" onClick={() => void load()} loading={loading}>
              Retry
            </Button>
          </div>
        </Alert>
      )}

      <section aria-label="Ledger summary" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <StatCard label="Gross volume" value={formatCurrency(stats.gross, { compact: true })} icon={<Banknote className="h-4 w-4" />} hint="captured" />
        <StatCard label="Platform commission" value={formatCurrency(stats.commission, { compact: true })} icon={<Wallet className="h-4 w-4" />} hint="earned" />
        <StatCard label="Net to sellers" value={formatCurrency(stats.net, { compact: true })} icon={<Wallet className="h-4 w-4" />} hint="after commission" />
        <StatCard label="Refunded" value={formatCurrency(stats.refunded, { compact: true })} icon={<RotateCcw className="h-4 w-4" />} hint="succeeded refunds" />
        <StatCard label="Pending payouts" value={formatCurrency(stats.pendingPayouts, { compact: true })} icon={<Banknote className="h-4 w-4" />} hint="awaiting settlement" />
      </section>

      <Tabs
        value={tab}
        onChange={setTab}
        items={[
          { id: 'transactions', label: 'Transactions' },
          { id: 'refunds', label: 'Refunds', badge: <Badge tone="neutral" size="sm">{refundList.length}</Badge> },
          { id: 'payouts', label: 'Payouts', badge: <Badge tone="neutral" size="sm">{payoutList.length}</Badge> },
        ]}
      />

      {tab === 'transactions' && (
        <div className="rounded-card border border-ink-200 bg-white shadow-card">
          <DataToolbar searchValue={search} onSearchChange={setSearch} searchPlaceholder="Search reference, order, customer or seller">
            <label className="sr-only" htmlFor="tx-method-filter">Method</label>
            <Select
              id="tx-method-filter"
              value={method}
              onChange={(e) => setMethod(e.target.value)}
              options={[{ label: 'All methods', value: 'all' }, ...methods.map((m) => ({ label: m, value: m }))]}
              className="w-44"
            />
            <label className="sr-only" htmlFor="tx-status-filter">Status</label>
            <Select
              id="tx-status-filter"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              options={[
                { label: 'All statuses', value: 'all' },
                { label: 'Paid', value: 'paid' },
                { label: 'Pending', value: 'pending' },
                { label: 'Refunded', value: 'refunded' },
                { label: 'Failed', value: 'failed' },
              ]}
              className="w-40"
            />
          </DataToolbar>

          {loading && (
            <p className="border-b border-ink-200 px-4 py-2 text-xs text-ink-500">Loading ledger…</p>
          )}
          {pagedTx.length === 0 ? (
            <div className="p-6">
              <EmptyState size="sm" icon={<Banknote className="h-5 w-5" />} title="No transactions found" description="Adjust the search or filters." />
            </div>
          ) : (
            <>
              <Table>
                <THead>
                  <TR>
                    <TH>Reference</TH>
                    <TH>Order</TH>
                    <TH>Customer</TH>
                    <TH>Seller</TH>
                    <TH>Amount</TH>
                    <TH>Commission</TH>
                    <TH>Net to seller</TH>
                    <TH>Method</TH>
                    <TH>Status</TH>
                    <TH>Date</TH>
                    <TH className="text-right">Actions</TH>
                  </TR>
                </THead>
                <TBody>
                  {pagedTx.map((tx) => (
                    <TR key={tx.id}>
                      <TD className="whitespace-nowrap font-mono text-xs text-ink">{tx.reference}</TD>
                      <TD className="whitespace-nowrap">{tx.orderNumber}</TD>
                      <TD className="whitespace-nowrap">{tx.customerName}</TD>
                      <TD className="whitespace-nowrap">{tx.sellerName}</TD>
                      <TD className="whitespace-nowrap font-medium text-ink">{formatCurrency(tx.amount)}</TD>
                      <TD className="whitespace-nowrap">{formatCurrency(tx.commission)}</TD>
                      <TD className="whitespace-nowrap">{formatCurrency(tx.netToSeller)}</TD>
                      <TD className="whitespace-nowrap">{tx.method}</TD>
                      <TD>
                        <StatusBadge status={tx.status} kind="payment" />
                      </TD>
                      <TD className="whitespace-nowrap">{formatDate(tx.createdAt)}</TD>
                      <TD className="text-right">
                        {tx.orderId != null && (
                          <Button size="sm" variant="outline" to={`/admin/orders/${tx.orderId}`}>
                            View order
                          </Button>
                        )}
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
              <div className="p-4">
                <Pagination page={txSafePage} totalPages={txTotalPages} onPageChange={setTxPage} totalItems={filteredTx.length} pageSize={PAGE_SIZE} />
              </div>
            </>
          )}
        </div>
      )}

      {tab === 'refunds' && (
        <div className="rounded-card border border-ink-200 bg-white shadow-card">
          {pagedRefunds.length === 0 ? (
            <div className="p-6">
              <EmptyState size="sm" icon={<RotateCcw className="h-5 w-5" />} title="No refund requests" />
            </div>
          ) : (
            <>
              <Table>
                <THead>
                  <TR>
                    <TH>Order</TH>
                    <TH>Customer</TH>
                    <TH>Amount</TH>
                    <TH>Reason</TH>
                    <TH>Status</TH>
                    <TH>Requested</TH>
                    <TH className="text-right">Actions</TH>
                  </TR>
                </THead>
                <TBody>
                  {pagedRefunds.map((refund) => (
                    <TR key={refund.id}>
                      <TD className="whitespace-nowrap">{refund.orderNumber}</TD>
                      <TD className="whitespace-nowrap">{refund.customerName}</TD>
                      <TD className="whitespace-nowrap font-medium text-ink">{formatCurrency(refund.amount)}</TD>
                      <TD>
                        <button
                          type="button"
                          onClick={() => setRefundDetail(refund)}
                          className="max-w-[16rem] truncate text-left text-ink-600 underline-offset-2 hover:underline"
                        >
                          {truncate(refund.reason, 60)}
                        </button>
                      </TD>
                      <TD>
                        <Badge tone={REFUND_TONES[refund.status]}>{refund.status}</Badge>
                      </TD>
                      <TD className="whitespace-nowrap">{formatDate(refund.createdAt)}</TD>
                      <TD className="text-right">
                        <RowActions
                          label={`Actions for refund ${refund.id}`}
                          items={refundActions(refund)}
                        />
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
              <div className="p-4">
                <Pagination page={refundSafePage} totalPages={refundTotalPages} onPageChange={setRefundPage} totalItems={refundList.length} pageSize={PAGE_SIZE} />
              </div>
            </>
          )}
          <p className="border-t border-ink-200 px-4 py-3 text-xs text-ink-500">
            Refund decisions are recorded against the order and reflected in the customer's account.
          </p>
        </div>
      )}

      {tab === 'payouts' && (
        <div className="rounded-card border border-ink-200 bg-white shadow-card">
          {pagedPayouts.length === 0 ? (
            <div className="p-6">
              <EmptyState size="sm" icon={<Wallet className="h-5 w-5" />} title="No payouts" />
            </div>
          ) : (
            <>
              <Table>
                <THead>
                  <TR>
                    <TH>Reference</TH>
                    <TH>Seller</TH>
                    <TH>Amount</TH>
                    <TH>Method & destination</TH>
                    <TH>Status</TH>
                    <TH>Requested</TH>
                    <TH>Processed</TH>
                    <TH>Admin note</TH>
                    <TH className="text-right">Actions</TH>
                  </TR>
                </THead>
                <TBody>
                  {pagedPayouts.map((payout) => (
                    <TR key={payout.id}>
                      <TD className="whitespace-nowrap font-mono text-xs text-ink">{payout.payoutReference}</TD>
                      <TD className="whitespace-nowrap">Seller #{payout.sellerId}</TD>
                      <TD className="whitespace-nowrap font-medium text-ink">{formatCurrency(payout.amount)}</TD>
                      <TD>
                        <p className="text-ink-700">{payout.payoutMethod ?? '—'}</p>
                        <p className="text-xs text-ink-500">{payout.destinationLabel ?? '—'}</p>
                      </TD>
                      <TD>
                        <StatusBadge status={payout.status} kind="payout" />
                      </TD>
                      <TD className="whitespace-nowrap">{formatDate(payout.requestedAt)}</TD>
                      <TD className="whitespace-nowrap">{payout.processedAt ? formatDate(payout.processedAt) : '—'}</TD>
                      <TD className="max-w-[14rem] text-ink-600">{payout.adminNote ? truncate(payout.adminNote, 50) : '—'}</TD>
                      <TD className="text-right">
                        <RowActions
                          label={`Actions for payout ${payout.payoutReference}`}
                          items={payoutActions(payout)}
                        />
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
              <div className="p-4">
                <Pagination page={payoutSafePage} totalPages={payoutTotalPages} onPageChange={setPayoutPage} totalItems={payoutList.length} pageSize={PAGE_SIZE} />
              </div>
            </>
          )}
          <p className="border-t border-ink-200 px-4 py-3 text-xs text-ink-500">
            Payout approvals are final. Verify the seller's destination details before releasing funds.
          </p>
        </div>
      )}

      {/* Refund detail */}
      <Modal open={!!refundDetail} onClose={() => setRefundDetail(null)} title="Refund detail" size="md">
        {refundDetail && (
          <div className="space-y-3 text-sm text-ink-700">
            <p>
              <span className="font-medium text-ink">Order:</span> {refundDetail.orderNumber}
            </p>
            <p>
              <span className="font-medium text-ink">Customer:</span> {refundDetail.customerName}
            </p>
            <p>
              <span className="font-medium text-ink">Amount:</span> {formatCurrency(refundDetail.amount)}
            </p>
            <p>
              <span className="font-medium text-ink">Status:</span> <Badge tone={REFUND_TONES[refundDetail.status]}>{refundDetail.status}</Badge>
            </p>
            <p>
              <span className="font-medium text-ink">Requested:</span> {formatDate(refundDetail.createdAt, 'time')}
            </p>
            <div>
              <p className="font-medium text-ink">Reason</p>
              <p className="mt-1 text-ink-600">{refundDetail.reason}</p>
            </div>
          </div>
        )}
      </Modal>

      {/* Payout detail */}
      <Modal open={!!payoutDetail} onClose={() => setPayoutDetail(null)} title="Payout detail" size="md">
        {payoutDetail && (
          <div className="space-y-3 text-sm text-ink-700">
            <p>
              <span className="font-medium text-ink">Reference:</span> {payoutDetail.payoutReference}
            </p>
            <p>
              <span className="font-medium text-ink">Seller:</span> Seller #{payoutDetail.sellerId}
            </p>
            <p>
              <span className="font-medium text-ink">Amount:</span> {formatCurrency(payoutDetail.amount)}
            </p>
            <p>
              <span className="font-medium text-ink">Method:</span> {payoutDetail.payoutMethod ?? '—'} · {payoutDetail.destinationLabel ?? '—'}
            </p>
            <p>
              <span className="font-medium text-ink">Status:</span> <StatusBadge status={payoutDetail.status} kind="payout" />
            </p>
            <p>
              <span className="font-medium text-ink">Requested:</span> {formatDate(payoutDetail.requestedAt, 'time')}
            </p>
            <p>
              <span className="font-medium text-ink">Processed:</span> {payoutDetail.processedAt ? formatDate(payoutDetail.processedAt, 'time') : '—'}
            </p>
            {payoutDetail.adminNote && (
              <div>
                <p className="font-medium text-ink">Admin note</p>
                <p className="mt-1 text-ink-600">{payoutDetail.adminNote}</p>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Reject payout */}
      <Modal
        open={!!rejectPayout}
        onClose={() => {
          setRejectPayout(null)
          setRejectReason('')
        }}
        title="Reject payout"
        description={rejectPayout ? `Rejecting ${rejectPayout.payoutReference}.` : undefined}
        size="md"
        footer={
          <>
            <Button
              variant="outline"
              disabled={payoutBusy !== null}
              onClick={() => {
                setRejectPayout(null)
                setRejectReason('')
              }}
            >
              Cancel
            </Button>
            <Button variant="danger" onClick={rejectPayoutConfirm} loading={payoutBusy !== null}>
              Reject payout
            </Button>
          </>
        }
      >
        <Textarea
          label="Reason"
          value={rejectReason}
          onChange={(e) => setRejectReason(e.target.value)}
          hint="Stored on the payout record and shared with the seller."
          required
        />
      </Modal>

      <ConfirmDialog
        open={!!approvePayoutTarget}
        onClose={() => setApprovePayoutTarget(null)}
        onConfirm={confirmApprovePayout}
        title="Approve and pay this payout?"
        description={
          approvePayoutTarget
            ? `This releases ${formatCurrency(approvePayoutTarget.amount)} to ${approvePayoutTarget.payoutReference}. Payout approvals are final.`
            : ''
        }
        confirmLabel="Approve & pay"
        loading={payoutBusy !== null}
      />
    </div>
  )
}
