import { useEffect, useMemo, useState } from 'react'
import { Banknote, CalendarDays, Download, Eye, Percent, Plus, Wallet } from 'lucide-react'
import {
  Alert,
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  EmptyState,
  Input,
  Modal,
  PageHeader,
  Select,
  StatCard,
  StatusBadge,
  Table,
  TBody,
  TD,
  TH,
  THead,
  TR,
} from '@/components/ui'
import { useAuthStore, useSeller } from '@/context'
import { toast } from '@/context/uiStore'
import { sellerService } from '@/services'
import type { SellerPayout } from '@/types'
import { formatCurrency, formatDate } from '@/lib/utils'

const METHOD_OPTIONS = [
  { label: 'Bank transfer', value: 'Bank transfer' },
  { label: 'Mobile money', value: 'Mobile money' },
]

function downloadStatement(payout: SellerPayout) {
  const lines = [
    'Shopio payout statement',
    '========================',
    `Reference: ${payout.payoutReference}`,
    `Amount: ${formatCurrency(payout.amount)}`,
    `Method: ${payout.payoutMethod ?? '—'}`,
    `Destination: ${payout.destinationLabel ?? '—'}`,
    `Status: ${payout.status}`,
    `Requested: ${formatDate(payout.requestedAt, 'time')}`,
    `Processed: ${payout.processedAt ? formatDate(payout.processedAt, 'time') : 'Not yet processed'}`,
    `Admin note: ${payout.adminNote ?? 'None'}`,
  ]
  const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `${payout.payoutReference || `payout-${payout.id}`}-statement.txt`
  anchor.click()
  URL.revokeObjectURL(url)
}

export default function SellerPayoutsPage() {
  const user = useAuthStore((s) => s.session?.user)
  const sellerId = user?.sellerId ?? null
  const seller = useSeller(sellerId)

  const [payouts, setPayouts] = useState<SellerPayout[]>([])
  const [summary, setSummary] = useState<Awaited<ReturnType<typeof sellerService.fetchPayoutSummary>>>(null)
  const [loading, setLoading] = useState(true)

  const [requestOpen, setRequestOpen] = useState(false)
  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState('Bank transfer')
  const [destination, setDestination] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [detail, setDetail] = useState<SellerPayout | null>(null)

  const available = summary?.availableForPayout ?? 0
  const pendingBalance = Math.max(
    0,
    (summary?.earnedNet ?? 0) -
      (summary?.availableForPayout ?? 0) -
      (summary?.paidTotal ?? 0) -
      (summary?.requestedTotal ?? 0),
  )

  const load = async () => {
    setLoading(true)
    try {
      const [payoutPage, summaryData] = await Promise.all([
        sellerService.fetchPayouts({ pageSize: 100 }),
        sellerService.fetchPayoutSummary(),
      ])
      setPayouts(payoutPage.items)
      setSummary(summaryData)
    } catch (error) {
      toast.error('Could not load payouts', error instanceof Error ? error.message : 'Please try again.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!sellerId) return
    void sellerService.fetchStore().catch(() => undefined)
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sellerId])

  const parsedAmount = Number(amount)
  const amountError =
    amount && (Number.isNaN(parsedAmount) || parsedAmount <= 0)
      ? 'Enter an amount greater than zero'
      : amount && parsedAmount > available
        ? 'Amount exceeds your available balance'
        : undefined

  const submitRequest = async () => {
    if (amountError || !amount) {
      toast.error('Check the amount', amountError ?? 'Enter an amount to request.')
      return
    }
    if (!destination.trim()) {
      toast.error('Destination required', 'Enter the account or wallet number to receive the payout.')
      return
    }
    setSubmitting(true)
    try {
      const result = await sellerService.requestPayout(sellerId, parsedAmount, method, destination.trim())
      toast.success('Payout requested', `Reference ${result.payoutReference} · ${formatCurrency(parsedAmount)}`)
      setRequestOpen(false)
      setAmount('')
      setDestination('')
      await load()
    } catch (error) {
      toast.error('Payout not requested', error instanceof Error ? error.message : 'Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const stats = useMemo(
    () => [
      {
        label: 'Available balance',
        value: formatCurrency(available),
        hint: 'Ready to withdraw',
        icon: <Wallet className="h-4 w-4" aria-hidden="true" />,
      },
      {
        label: 'Pending balance',
        value: formatCurrency(pendingBalance),
        hint: 'Clearing the return window',
        icon: <CalendarDays className="h-4 w-4" aria-hidden="true" />,
      },
      {
        label: 'Lifetime earnings',
        value: formatCurrency(summary?.earnedNet ?? 0, { compact: true }),
        icon: <Banknote className="h-4 w-4" aria-hidden="true" />,
      },
      {
        label: 'Platform commission',
        value: formatCurrency(summary?.commissionTotal ?? 0, { compact: true }),
        icon: <Percent className="h-4 w-4" aria-hidden="true" />,
      },
      {
        label: 'Commission rate',
        value: `${seller?.commissionRate ?? 0}%`,
        icon: <Percent className="h-4 w-4" aria-hidden="true" />,
      },
      {
        label: 'Paid to date',
        value: formatCurrency(summary?.paidTotal ?? 0, { compact: true }),
        icon: <Wallet className="h-4 w-4" aria-hidden="true" />,
      },
    ],
    [available, pendingBalance, seller?.commissionRate, summary],
  )

  return (
    <div className="space-y-6">
      <PageHeader
        title="Payouts"
        description="Track your balance and request payouts to your bank or mobile money wallet."
        actions={
          <Button onClick={() => setRequestOpen(true)} disabled={available <= 0}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            Request payout
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {stats.map((stat) => (
          <StatCard
            key={stat.label}
            label={stat.label}
            value={stat.value}
            hint={stat.hint}
            icon={stat.icon}
          />
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Payout history</CardTitle>
            <span className="text-sm text-ink-500">
              {loading ? 'Loading…' : `${payouts.length} payouts`}
            </span>
          </CardHeader>
          {payouts.length === 0 ? (
            <CardBody>
              <EmptyState
                icon={<Wallet className="h-5 w-5" />}
                title="No payouts yet"
                description="Once your balance becomes available you can request your first payout."
                action={{ label: 'Request payout', onClick: () => setRequestOpen(true) }}
              />
            </CardBody>
          ) : (
            <Table>
              <THead>
                <TR>
                  <TH>Reference</TH>
                  <TH>Requested</TH>
                  <TH>Amount</TH>
                  <TH>Method</TH>
                  <TH>Status</TH>
                  <TH>Processed</TH>
                  <TH className="text-right">Actions</TH>
                </TR>
              </THead>
              <TBody>
                {payouts.map((payout) => (
                  <TR key={payout.id}>
                    <TD className="font-medium text-ink">{payout.payoutReference || `#${payout.id}`}</TD>
                    <TD className="whitespace-nowrap text-ink-500">{formatDate(payout.requestedAt)}</TD>
                    <TD className="whitespace-nowrap font-medium text-ink">
                      {formatCurrency(payout.amount)}
                    </TD>
                    <TD>
                      <span className="block text-ink">{payout.payoutMethod ?? '—'}</span>
                      <span className="text-xs text-ink-500">{payout.destinationLabel ?? '—'}</span>
                    </TD>
                    <TD>
                      <StatusBadge status={payout.status} kind="payout" />
                    </TD>
                    <TD className="whitespace-nowrap text-ink-500">
                      {payout.processedAt ? formatDate(payout.processedAt) : '—'}
                    </TD>
                    <TD>
                      <div className="flex items-center justify-end gap-2">
                        <Button size="sm" variant="outline" onClick={() => setDetail(payout)}>
                          <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                          View
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => downloadStatement(payout)}>
                          <Download className="h-3.5 w-3.5" aria-hidden="true" />
                          Statement
                        </Button>
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
            <CardTitle>How settlements work</CardTitle>
          </CardHeader>
          <CardBody className="space-y-4 text-sm text-ink-600">
            <div>
              <p className="font-medium text-ink">Holding period</p>
              <p className="mt-0.5">
                Earnings become available once the order is delivered and paid, after the return window.
              </p>
            </div>
            <div>
              <p className="font-medium text-ink">Commission</p>
              <p className="mt-0.5">
                Shopio's {seller?.commissionRate ?? 0}% commission is already deducted from the balance
                shown.
              </p>
            </div>
            <div>
              <p className="font-medium text-ink">Review</p>
              <p className="mt-0.5">
                Payout requests are reviewed by the platform before funds are released.
              </p>
            </div>
            <Alert tone="info" title="Bank details">
              Confirm your destination details before requesting a payout; a paid payout cannot be reversed
              automatically.
            </Alert>
          </CardBody>
        </Card>
      </div>

      <Modal
        open={requestOpen}
        onClose={() => setRequestOpen(false)}
        title="Request payout"
        description={`Available balance: ${formatCurrency(available)}`}
        footer={
          <>
            <Button variant="outline" onClick={() => setRequestOpen(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button onClick={submitRequest} loading={submitting}>
              Request payout
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            label="Amount (TZS)"
            type="number"
            inputMode="numeric"
            min={0}
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            error={amountError}
            hint={`Maximum ${formatCurrency(available)}`}
          />
          <Select
            label="Payout method"
            options={METHOD_OPTIONS}
            value={method}
            onChange={(event) => setMethod(event.target.value)}
          />
          <Input
            label="Destination account"
            placeholder={method === 'Bank transfer' ? 'Bank account number' : 'Mobile money number'}
            value={destination}
            onChange={(event) => setDestination(event.target.value)}
          />
          <p className="rounded-lg bg-ink-50 p-3 text-xs text-ink-500">
            Your seller balance is calculated from delivered, paid orders and is verified again by the server
            when the payout is processed.
          </p>
        </div>
      </Modal>

      <Modal
        open={!!detail}
        onClose={() => setDetail(null)}
        title={detail ? `Payout ${detail.payoutReference || `#${detail.id}`}` : 'Payout'}
        footer={
          <>
            <Button variant="outline" onClick={() => setDetail(null)}>
              Close
            </Button>
            {detail && (
              <Button onClick={() => downloadStatement(detail)}>
                <Download className="h-4 w-4" aria-hidden="true" />
                Download statement
              </Button>
            )}
          </>
        }
      >
        {detail && (
          <dl className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <dt className="text-ink-500">Status</dt>
              <dd>
                <StatusBadge status={detail.status} kind="payout" />
              </dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-ink-500">Amount</dt>
              <dd className="font-medium text-ink">{formatCurrency(detail.amount)}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-ink-500">Method</dt>
              <dd className="text-ink">{detail.payoutMethod ?? '—'}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-ink-500">Destination</dt>
              <dd className="text-ink">{detail.destinationLabel ?? '—'}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-ink-500">Requested</dt>
              <dd className="text-ink">{formatDate(detail.requestedAt, 'time')}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-ink-500">Processed</dt>
              <dd className="text-ink">
                {detail.processedAt ? formatDate(detail.processedAt, 'time') : 'Not yet'}
              </dd>
            </div>
            {detail.adminNote && (
              <div className="border-t border-ink-200 pt-3">
                <dt className="text-ink-500">Admin note</dt>
                <dd className="mt-1 text-ink">{detail.adminNote}</dd>
              </div>
            )}
          </dl>
        )}
      </Modal>
    </div>
  )
}
