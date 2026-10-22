import { useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { Check, Copy, MoreHorizontal, Pencil, Plus, Tag, Trash2, X } from 'lucide-react'
import {
  Badge,
  Button,
  ConfirmDialog,
  Dropdown,
  EmptyState,
  Input,
  Modal,
  PageHeader,
  Select,
  StatCard,
  TBody,
  TD,
  TH,
  THead,
  TR,
  Table,
  Textarea,
} from '@/components/ui'
import { BarSeriesChart, ChartCard } from '@/components/charts/Charts'
import { adminService } from '@/services'
import { useCatalogStore } from '@/context/catalogStore'
import { toast } from '@/context/uiStore'
import type { Coupon } from '@/types'
import { formatCurrency, formatDate, formatNumber } from '@/lib/utils'

interface CouponForm {
  code: string
  description: string
  discountType: 'percentage' | 'fixed'
  discountValue: string
  minimumOrderAmount: string
  maximumDiscountAmount: string
  usageLimit: string
  perUserLimit: string
  startsAt: string
  expiresAt: string
  status: 'active' | 'inactive' | 'expired'
}

const EMPTY_FORM: CouponForm = {
  code: '',
  description: '',
  discountType: 'percentage',
  discountValue: '',
  minimumOrderAmount: '',
  maximumDiscountAmount: '',
  usageLimit: '',
  perUserLimit: '',
  startsAt: '',
  expiresAt: '',
  status: 'active',
}

const toDateInput = (iso: string | null) => (iso ? new Date(iso).toISOString().slice(0, 10) : '')

function couponToForm(coupon: Coupon): CouponForm {
  return {
    code: coupon.code,
    description: coupon.description ?? '',
    discountType: coupon.discountType,
    discountValue: String(coupon.discountValue),
    minimumOrderAmount: String(coupon.minimumOrderAmount),
    maximumDiscountAmount: coupon.maximumDiscountAmount != null ? String(coupon.maximumDiscountAmount) : '',
    usageLimit: coupon.usageLimit != null ? String(coupon.usageLimit) : '',
    perUserLimit: coupon.perUserLimit != null ? String(coupon.perUserLimit) : '',
    startsAt: toDateInput(coupon.startsAt),
    expiresAt: toDateInput(coupon.expiresAt),
    status: coupon.status,
  }
}

function displayStatus(coupon: Coupon): Coupon['status'] {
  if (coupon.status === 'inactive') return 'inactive'
  if (coupon.expiresAt && new Date(coupon.expiresAt).getTime() < Date.now()) return 'expired'
  return coupon.status
}

/** Coupon management with a redemption breakdown. */
export default function AdminPromotionsPage() {
  const coupons = useCatalogStore((s) => s.coupons)

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Coupon | null>(null)
  const [busy, setBusy] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Coupon | null>(null)

  useEffect(() => {
    void adminService.fetchCoupons({ pageSize: 100 }).catch(() => undefined)
  }, [])

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<CouponForm>({ defaultValues: EMPTY_FORM })

  const discountType = watch('discountType')

  const stats = useMemo(() => {
    const active = coupons.filter((c) => displayStatus(c) === 'active').length
    const redemptions = coupons.reduce((sum, c) => sum + c.usedCount, 0)
    const scheduled = coupons.filter((c) => c.status === 'inactive').length
    const expired = coupons.filter((c) => displayStatus(c) === 'expired').length
    return { active, redemptions, scheduled, expired }
  }, [coupons])

  const redemptionData = useMemo(
    () => coupons.map((c) => ({ label: c.code, value: c.usedCount })),
    [coupons],
  )

  const openAdd = () => {
    setEditing(null)
    reset(EMPTY_FORM)
    setFormOpen(true)
  }

  const openEdit = (coupon: Coupon) => {
    setEditing(coupon)
    reset(couponToForm(coupon))
    setFormOpen(true)
  }

  const onSubmit = handleSubmit(async (values) => {
    const payload = {
      code: values.code.trim().toUpperCase(),
      description: values.description.trim() || null,
      discountType: values.discountType,
      discountValue: Number(values.discountValue),
      minimumOrderAmount: values.minimumOrderAmount ? Number(values.minimumOrderAmount) : 0,
      maximumDiscountAmount: values.maximumDiscountAmount ? Number(values.maximumDiscountAmount) : null,
      usageLimit: values.usageLimit ? Number(values.usageLimit) : null,
      perUserLimit: values.perUserLimit ? Number(values.perUserLimit) : null,
      startsAt: values.startsAt ? new Date(values.startsAt).toISOString() : null,
      expiresAt: values.expiresAt ? new Date(values.expiresAt).toISOString() : null,
      status: values.status,
    }

    const clash = coupons.find((c) => c.code.toUpperCase() === payload.code && c.id !== editing?.id)
    if (clash) {
      toast.error('Coupon code already exists', `"${payload.code}" is already in use.`)
      return
    }

    setBusy(true)
    try {
      if (editing) {
        await adminService.updateCoupon(editing.id, payload)
        toast.success('Coupon updated', `${payload.code} saved.`)
      } else {
        await adminService.createCoupon(payload)
        toast.success('Coupon created', `${payload.code} is now available at checkout.`)
      }
      setFormOpen(false)
    } finally {
      setBusy(false)
    }
  })

  const duplicate = async (coupon: Coupon) => {
    await adminService.createCoupon({
      code: `${coupon.code}-COPY`,
      description: coupon.description,
      discountType: coupon.discountType,
      discountValue: coupon.discountValue,
      minimumOrderAmount: coupon.minimumOrderAmount,
      maximumDiscountAmount: coupon.maximumDiscountAmount,
      usageLimit: coupon.usageLimit,
      perUserLimit: coupon.perUserLimit,
      startsAt: coupon.startsAt,
      expiresAt: coupon.expiresAt,
      status: 'inactive',
    })
    toast.success('Coupon duplicated', `Created ${coupon.code}-COPY as inactive.`)
  }

  const toggleStatus = async (coupon: Coupon) => {
    const next = coupon.status === 'active' ? 'inactive' : 'active'
    await adminService.updateCoupon(coupon.id, { status: next })
    toast.success(next === 'active' ? 'Coupon activated' : 'Coupon deactivated', `${coupon.code} is now ${next}.`)
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return
    setBusy(true)
    try {
      await adminService.deleteCoupon(deleteTarget.id)
      toast.success('Coupon deleted', `${deleteTarget.code} was removed.`)
      setDeleteTarget(null)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Promotions"
        description="Coupons and discount campaigns across the marketplace."
        actions={
          <Button onClick={openAdd}>
            <Plus className="h-4 w-4" />
            Add coupon
          </Button>
        }
      />

      <section aria-label="Promotion summary" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Active coupons" value={formatNumber(stats.active)} icon={<Tag className="h-4 w-4" />} hint="redeemable now" />
        <StatCard label="Total redemptions" value={formatNumber(stats.redemptions)} icon={<Check className="h-4 w-4" />} hint="all time" />
        <StatCard label="Scheduled" value={formatNumber(stats.scheduled)} icon={<Tag className="h-4 w-4" />} hint="inactive campaigns" />
        <StatCard label="Expired" value={formatNumber(stats.expired)} icon={<X className="h-4 w-4" />} hint="past expiry" />
      </section>

      <div className="rounded-card border border-ink-200 bg-white shadow-card">
        {coupons.length === 0 ? (
          <div className="p-6">
            <EmptyState
              size="sm"
              icon={<Tag className="h-5 w-5" />}
              title="No coupons yet"
              description="Create a coupon to start a discount campaign."
              action={{ label: 'Add coupon', onClick: openAdd }}
            />
          </div>
        ) : (
          <Table>
            <THead>
              <TR>
                <TH>Code</TH>
                <TH>Description</TH>
                <TH>Type</TH>
                <TH>Value</TH>
                <TH>Minimum spend</TH>
                <TH>Max discount</TH>
                <TH>Used / limit</TH>
                <TH>Window</TH>
                <TH>Status</TH>
                <TH className="text-right">Actions</TH>
              </TR>
            </THead>
            <TBody>
              {coupons.map((coupon) => {
                const status = displayStatus(coupon)
                const percent = coupon.usageLimit ? Math.min(100, (coupon.usedCount / coupon.usageLimit) * 100) : 0
                return (
                  <TR key={coupon.id}>
                    <TD>
                      <span className="rounded-md bg-ink-100 px-2 py-1 font-mono text-xs font-semibold text-ink">{coupon.code}</span>
                    </TD>
                    <TD className="max-w-[16rem] text-ink-600">{coupon.description ?? '—'}</TD>
                    <TD>
                      <Badge tone={coupon.discountType === 'percentage' ? 'info' : 'neutral'}>
                        {coupon.discountType === 'percentage' ? 'Percentage' : 'Fixed'}
                      </Badge>
                    </TD>
                    <TD className="whitespace-nowrap font-medium text-ink">
                      {coupon.discountType === 'percentage' ? `${coupon.discountValue}%` : formatCurrency(coupon.discountValue)}
                    </TD>
                    <TD className="whitespace-nowrap">{coupon.minimumOrderAmount ? formatCurrency(coupon.minimumOrderAmount) : 'None'}</TD>
                    <TD className="whitespace-nowrap">{coupon.maximumDiscountAmount != null ? formatCurrency(coupon.maximumDiscountAmount) : '—'}</TD>
                    <TD>
                      <div className="min-w-[7rem]">
                        <p className="text-xs text-ink-600">
                          {formatNumber(coupon.usedCount)} / {coupon.usageLimit != null ? formatNumber(coupon.usageLimit) : '∞'}
                        </p>
                        <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-ink-100" aria-hidden="true">
                          <div className="h-full rounded-full bg-ink" style={{ width: `${percent}%` }} />
                        </div>
                      </div>
                    </TD>
                    <TD className="whitespace-nowrap text-xs text-ink-600">
                      {coupon.startsAt ? formatDate(coupon.startsAt) : '—'} → {coupon.expiresAt ? formatDate(coupon.expiresAt) : '—'}
                    </TD>
                    <TD>
                      <Badge tone={status === 'active' ? 'success' : status === 'expired' ? 'danger' : 'neutral'}>{status}</Badge>
                    </TD>
                    <TD className="text-right">
                      <Dropdown
                        label={`Actions for ${coupon.code}`}
                        trigger={
                          <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-ink-500 hover:bg-ink-100 hover:text-ink">
                            <MoreHorizontal className="h-4 w-4" />
                          </span>
                        }
                        items={[
                          { label: 'Edit', icon: <Pencil className="h-4 w-4" />, onClick: () => openEdit(coupon) },
                          { label: 'Duplicate', icon: <Copy className="h-4 w-4" />, onClick: () => duplicate(coupon) },
                          {
                            label: coupon.status === 'active' ? 'Deactivate' : 'Activate',
                            icon: coupon.status === 'active' ? <X className="h-4 w-4" /> : <Check className="h-4 w-4" />,
                            onClick: () => toggleStatus(coupon),
                          },
                          { label: 'Delete', icon: <Trash2 className="h-4 w-4" />, tone: 'danger', divider: true, onClick: () => setDeleteTarget(coupon) },
                        ]}
                      />
                    </TD>
                  </TR>
                )
              })}
            </TBody>
          </Table>
        )}
      </div>

      <ChartCard title="Redemptions by coupon" description="How many times each coupon has been redeemed.">
        <BarSeriesChart
          data={redemptionData}
          dataKey="value"
          label="Redemptions"
          valueFormat="number"
          ariaLabel="Coupon redemptions by code"
        />
      </ChartCard>

      <p className="text-xs text-ink-500">
        Redemption counts are updated by the backend each time a coupon is used on an order.
      </p>

      {/* Add / edit coupon */}
      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? 'Edit coupon' : 'Add coupon'}
        size="lg"
        footer={
          <>
            <Button variant="outline" onClick={() => setFormOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button onClick={onSubmit} loading={busy}>
              {editing ? 'Save changes' : 'Create coupon'}
            </Button>
          </>
        }
      >
        <form className="space-y-4" onSubmit={onSubmit}>
          <Input
            label="Code"
            placeholder="e.g. SHOPIO10"
            error={errors.code?.message}
            {...register('code', { required: 'Coupon code is required' })}
          />
          <Textarea
            label="Description"
            rows={2}
            error={errors.description?.message}
            {...register('description')}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <Select
              label="Discount type"
              options={[
                { label: 'Percentage', value: 'percentage' },
                { label: 'Fixed amount', value: 'fixed' },
              ]}
              error={errors.discountType?.message}
              {...register('discountType')}
            />
            <Input
              label={discountType === 'percentage' ? 'Discount value (%)' : 'Discount value (TSh)'}
              type="number"
              min={0}
              error={errors.discountValue?.message}
              {...register('discountValue', {
                required: 'Discount value is required',
                validate: (v) => {
                  const n = Number(v)
                  if (!Number.isFinite(n) || n <= 0) return 'Must be greater than zero'
                  if (discountType === 'percentage' && n > 100) return 'Percentage cannot exceed 100'
                  return true
                },
              })}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Minimum order amount (TSh)"
              type="number"
              min={0}
              error={errors.minimumOrderAmount?.message}
              {...register('minimumOrderAmount', {
                validate: (v) => v === '' || Number(v) >= 0 || 'Must be zero or more',
              })}
            />
            <Input
              label="Maximum discount (TSh)"
              type="number"
              min={0}
              hint="Optional cap for percentage discounts."
              error={errors.maximumDiscountAmount?.message}
              {...register('maximumDiscountAmount', {
                validate: (v) => v === '' || Number(v) > 0 || 'Must be greater than zero',
              })}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Usage limit"
              type="number"
              min={0}
              hint="Leave blank for unlimited."
              {...register('usageLimit', {
                validate: (v) => v === '' || Number(v) > 0 || 'Must be greater than zero',
              })}
            />
            <Input
              label="Per-user limit"
              type="number"
              min={0}
              hint="Leave blank for unlimited."
              {...register('perUserLimit', {
                validate: (v) => v === '' || Number(v) > 0 || 'Must be greater than zero',
              })}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Starts at" type="date" {...register('startsAt')} />
            <Input label="Expires at" type="date" {...register('expiresAt')} />
          </div>
          <Select
            label="Status"
            options={[
              { label: 'Active', value: 'active' },
              { label: 'Inactive', value: 'inactive' },
              { label: 'Expired', value: 'expired' },
            ]}
            {...register('status')}
          />
          <p className="text-xs text-ink-500">
            Coupons apply at checkout and redemption is tracked by the backend.
          </p>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        title={deleteTarget ? `Delete ${deleteTarget.code}?` : ''}
        description="This permanently removes the coupon. It cannot be undone."
        confirmLabel="Delete"
        tone="danger"
        loading={busy}
      />
    </div>
  )
}
