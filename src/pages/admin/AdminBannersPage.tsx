import { useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { Check, Copy, Image as ImageIcon, MoreHorizontal, Pencil, Plus, Trash2, X } from 'lucide-react'
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
  SmartImage,
  StatCard,
} from '@/components/ui'
import { adminService } from '@/services'
import { errorMessage } from '@/services/apiClient'
import { useCatalogStore } from '@/context/catalogStore'
import { toast } from '@/context/uiStore'
import { PHOTOS, imgWide } from '@/content/images'
import type { Banner } from '@/types'
import { formatDate } from '@/lib/utils'

interface BannerForm {
  title: string
  subtitle: string
  imageUrl: string
  buttonText: string
  targetUrl: string
  placement: Banner['placement']
  startsAt: string
  endsAt: string
  sortOrder: string
  status: Banner['status']
}

const EMPTY_FORM: BannerForm = {
  title: '',
  subtitle: '',
  imageUrl: '',
  buttonText: 'Shop now',
  targetUrl: '/shop',
  placement: 'home_promo',
  startsAt: '',
  endsAt: '',
  sortOrder: '1',
  status: 'draft',
}

const PLACEMENT_LABELS: Record<Banner['placement'], string> = {
  home_hero: 'Home hero',
  home_promo: 'Home promo',
  category: 'Category',
  other: 'Other',
}

const STATUS_TONES: Record<Banner['status'], 'success' | 'warning' | 'neutral'> = {
  active: 'success',
  draft: 'warning',
  inactive: 'neutral',
}

const IMAGE_SUGGESTIONS = [
  ...PHOTOS.furniture.slice(0, 2),
  ...PHOTOS.electronics.slice(0, 2),
  ...PHOTOS.fashion.slice(0, 2),
].map((id) => imgWide(id, 1600))

const toDateInput = (iso: string | null) => {
  if (!iso) return ''
  const date = new Date(iso)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function bannerToForm(banner: Banner): BannerForm {
  return {
    title: banner.title,
    subtitle: banner.subtitle ?? '',
    imageUrl: banner.imageUrl ?? '',
    buttonText: banner.buttonText ?? '',
    targetUrl: banner.targetUrl ?? '',
    placement: banner.placement,
    startsAt: toDateInput(banner.startsAt),
    endsAt: toDateInput(banner.endsAt),
    sortOrder: String(banner.sortOrder),
    status: banner.status,
  }
}

/** Promotional banner management with live previews. */
export default function AdminBannersPage() {
  const banners = useCatalogStore((s) => s.banners)

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Banner | null>(null)
  const [busy, setBusy] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Banner | null>(null)

  useEffect(() => {
    void adminService
      .fetchBanners({ pageSize: 100 })
      .catch((error) => toast.error('Could not load banners', errorMessage(error)))
  }, [])

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<BannerForm>({ defaultValues: EMPTY_FORM })

  const stats = useMemo(
    () => ({
      total: banners.length,
      active: banners.filter((b) => b.status === 'active').length,
      drafts: banners.filter((b) => b.status === 'draft').length,
      inactive: banners.filter((b) => b.status === 'inactive').length,
    }),
    [banners],
  )

  const openAdd = () => {
    setEditing(null)
    reset({ ...EMPTY_FORM, sortOrder: String(banners.length + 1) })
    setFormOpen(true)
  }

  const openEdit = (banner: Banner) => {
    setEditing(banner)
    reset(bannerToForm(banner))
    setFormOpen(true)
  }

  const onSubmit = handleSubmit(async (values) => {
    if (values.startsAt && values.endsAt && values.endsAt < values.startsAt) {
      toast.error('Check the schedule', 'The end date must be on or after the start date.')
      return
    }

    const payload = {
      title: values.title.trim(),
      subtitle: values.subtitle.trim() || null,
      imageUrl: values.imageUrl || null,
      buttonText: values.buttonText.trim() || null,
      targetUrl: values.targetUrl.trim() || null,
      placement: values.placement,
      startsAt: values.startsAt ? new Date(`${values.startsAt}T00:00:00`).toISOString() : null,
      endsAt: values.endsAt ? new Date(`${values.endsAt}T23:59:59`).toISOString() : null,
      sortOrder: Number(values.sortOrder) || 1,
      status: values.status,
    }

    setBusy(true)
    try {
      if (editing) {
        await adminService.updateBanner(editing.id, payload)
        toast.success('Banner updated', `${payload.title} saved.`)
      } else {
        await adminService.createBanner(payload)
        toast.success('Banner created', `${payload.title} added to the rotation.`)
      }
      setFormOpen(false)
    } catch (error) {
      toast.error(editing ? 'Banner not updated' : 'Banner not created', errorMessage(error))
    } finally {
      setBusy(false)
    }
  })

  const duplicate = async (banner: Banner) => {
    try {
      await adminService.createBanner({
        title: `${banner.title} (copy)`,
        subtitle: banner.subtitle,
        imageUrl: banner.imageUrl,
        buttonText: banner.buttonText,
        targetUrl: banner.targetUrl,
        placement: banner.placement,
        startsAt: banner.startsAt,
        endsAt: banner.endsAt,
        sortOrder: banner.sortOrder + 1,
        status: 'draft',
      })
      toast.success('Banner duplicated', 'Created as a draft so it is not published immediately.')
    } catch (error) {
      toast.error('Could not duplicate banner', errorMessage(error))
    }
  }

  const toggleStatus = async (banner: Banner) => {
    const next: Banner['status'] = banner.status === 'active' ? 'inactive' : 'active'
    try {
      await adminService.updateBanner(banner.id, { status: next })
      toast.success(next === 'active' ? 'Banner activated' : 'Banner deactivated', `${banner.title} is now ${next}.`)
    } catch (error) {
      toast.error('Could not update banner', errorMessage(error))
    }
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return
    setBusy(true)
    try {
      await adminService.deleteBanner(deleteTarget.id)
      toast.success('Banner deleted', `${deleteTarget.title} was removed.`)
      setDeleteTarget(null)
    } catch (error) {
      toast.error('Could not delete banner', errorMessage(error))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Banners"
        description="Promotional placements across the storefront homepage and category pages."
        actions={
          <Button onClick={openAdd}>
            <Plus className="h-4 w-4" />
            Add banner
          </Button>
        }
      />

      <section aria-label="Banner summary" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total banners" value={String(stats.total)} icon={<ImageIcon className="h-4 w-4" />} hint="all placements" />
        <StatCard label="Active" value={String(stats.active)} icon={<Check className="h-4 w-4" />} hint="live now" />
        <StatCard label="Drafts" value={String(stats.drafts)} icon={<ImageIcon className="h-4 w-4" />} hint="not published" />
        <StatCard label="Inactive" value={String(stats.inactive)} icon={<ImageIcon className="h-4 w-4" />} hint="not shown on the storefront" />
      </section>

      {banners.length === 0 ? (
        <EmptyState
          icon={<ImageIcon className="h-5 w-5" />}
          title="No banners yet"
          description="Add a banner to promote a campaign on the storefront."
          action={{ label: 'Add banner', onClick: openAdd }}
        />
      ) : (
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {banners.map((banner) => (
            <div key={banner.id} className="overflow-hidden rounded-card border border-ink-200 bg-white shadow-card">
              <div className="relative">
                {banner.imageUrl ? (
                  <SmartImage
                    src={banner.imageUrl}
                    alt={banner.title}
                    wrapperClassName="aspect-[16/9] w-full"
                    fallbackLabel={banner.title}
                  />
                ) : (
                  <div className="flex aspect-[16/9] w-full items-center justify-center bg-sand-100 text-sand-500">
                    <ImageIcon className="h-8 w-8" aria-hidden="true" />
                  </div>
                )}
                <div className="absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-ink/70 to-transparent p-4">
                  <p className="text-base font-semibold text-white">{banner.title}</p>
                  {banner.subtitle && <p className="mt-0.5 line-clamp-2 text-xs text-white/85">{banner.subtitle}</p>}
                  {banner.buttonText && (
                    <span className="mt-2 inline-flex w-fit rounded-md bg-white px-2.5 py-1 text-xs font-medium text-ink">
                      {banner.buttonText}
                    </span>
                  )}
                </div>
              </div>

              <div className="space-y-3 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone="info">{PLACEMENT_LABELS[banner.placement]}</Badge>
                  <Badge tone={STATUS_TONES[banner.status]}>{banner.status}</Badge>
                  <span className="ml-auto text-xs text-ink-500">Sort {banner.sortOrder}</span>
                </div>
                <p className="text-xs text-ink-500">
                  {banner.startsAt ? formatDate(banner.startsAt) : '—'} → {banner.endsAt ? formatDate(banner.endsAt) : '—'}
                </p>
                <div className="flex items-center justify-between gap-2 border-t border-ink-100 pt-3">
                  <span className="truncate text-xs text-ink-500">{banner.targetUrl ?? 'No target'}</span>
                  <Dropdown
                    label={`Actions for ${banner.title}`}
                    trigger={
                      <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-ink-500 hover:bg-ink-100 hover:text-ink">
                        <MoreHorizontal className="h-4 w-4" />
                      </span>
                    }
                    items={[
                      { label: 'Edit', icon: <Pencil className="h-4 w-4" />, onClick: () => openEdit(banner) },
                      {
                        label: banner.status === 'active' ? 'Deactivate' : 'Activate',
                        icon: banner.status === 'active' ? <X className="h-4 w-4" /> : <Check className="h-4 w-4" />,
                        onClick: () => toggleStatus(banner),
                      },
                      { label: 'Duplicate', icon: <Copy className="h-4 w-4" />, onClick: () => duplicate(banner) },
                      { label: 'Delete', icon: <Trash2 className="h-4 w-4" />, tone: 'danger', divider: true, onClick: () => setDeleteTarget(banner) },
                    ]}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <p className="text-xs text-ink-500">
        <span className="font-medium text-ink">Home promo</span> banners appear on the storefront homepage,{' '}
        <span className="font-medium text-ink">Home hero</span> banners replace the homepage hero, and{' '}
        <span className="font-medium text-ink">Category</span> banners appear on category pages.
      </p>

      {/* Add / edit banner */}
      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? 'Edit banner' : 'Add banner'}
        size="lg"
        footer={
          <>
            <Button variant="outline" onClick={() => setFormOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button onClick={onSubmit} loading={busy}>
              {editing ? 'Save changes' : 'Create banner'}
            </Button>
          </>
        }
      >
        <form className="space-y-4" onSubmit={onSubmit}>
          <Input label="Title" error={errors.title?.message} {...register('title', { required: 'Title is required' })} />
          <Input label="Subtitle" {...register('subtitle')} />
          <Input
            label="Image URL"
            placeholder="https://…"
            error={errors.imageUrl?.message}
            hint="Leave blank to render a sand placeholder."
            {...register('imageUrl', {
              validate: (v) => !v || /^https?:\/\//i.test(v) || 'Use a full http(s) image URL',
            })}
          />
          <div>
            <p className="mb-1.5 text-sm font-medium text-ink">Suggested images</p>
            <div className="flex flex-wrap gap-2">
              {IMAGE_SUGGESTIONS.map((url) => (
                <button
                  key={url}
                  type="button"
                  aria-label="Use this image"
                  className="overflow-hidden rounded-lg border border-ink-200 hover:border-ink-400"
                  onClick={() => reset((current) => ({ ...current, imageUrl: url }))}
                >
                  <SmartImage src={url} alt="Banner suggestion" wrapperClassName="h-12 w-20" />
                </button>
              ))}
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Button text" {...register('buttonText')} />
            <Input
              label="Target URL"
              placeholder="/shop"
              error={errors.targetUrl?.message}
              {...register('targetUrl', {
                validate: (v) => {
                  if (!v) return true
                  if (/^https?:\/\//i.test(v)) return true
                  if (/^\/(?![/\\])[^\s]*$/.test(v)) return true
                  return 'Use an internal path starting with / or a full http(s) URL'
                },
              })}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Select
              label="Placement"
              options={(Object.keys(PLACEMENT_LABELS) as Banner['placement'][]).map((key) => ({
                label: PLACEMENT_LABELS[key],
                value: key,
              }))}
              {...register('placement')}
            />
            <Input label="Sort order" type="number" min={1} {...register('sortOrder')} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Starts at" type="date" {...register('startsAt')} />
            <Input label="Ends at" type="date" {...register('endsAt')} />
          </div>
          <Select
            label="Status"
            options={[
              { label: 'Draft', value: 'draft' },
              { label: 'Active', value: 'active' },
              { label: 'Inactive', value: 'inactive' },
            ]}
            {...register('status')}
          />
          <p className="text-xs text-ink-500">
            Active banners appear on the storefront immediately. Hero banners replace the homepage hero;
            category banners appear on category pages.
          </p>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        title={deleteTarget ? `Delete "${deleteTarget.title}"?` : ''}
        description="This permanently removes the banner. It cannot be undone."
        confirmLabel="Delete"
        tone="danger"
        loading={busy}
      />
    </div>
  )
}
