import { useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import {
  CalendarDays,
  Check,
  ExternalLink,
  Percent,
  Save,
  ShieldCheck,
  Star,
  Store,
  X,
} from 'lucide-react'
import {
  Alert,
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  Input,
  PageHeader,
  Select,
  SmartImage,
  StatusBadge,
  Stars,
  Textarea,
} from '@/components/ui'
import { useAuthStore, useSeller, useSellerProducts } from '@/context'
import { toast } from '@/context/uiStore'
import { geoService, sellerService } from '@/services'
import { PHOTOS, imgSquare, imgWide } from '@/content/images'
import { businessCategories } from '@/content/marketing'
import { formatCurrency, formatDate } from '@/lib/utils'
import type { City, Region } from '@/types'

interface StoreFormValues {
  storeName: string
  storeSlug: string
  businessCategory: string
  regionId: string
  cityId: string
  address: string
  phone: string
  storeDescription: string
  logoUrl: string
  bannerUrl: string
}

export default function SellerStorePage() {
  const user = useAuthStore((s) => s.session?.user)
  const sellerId = user?.sellerId ?? null
  const seller = useSeller(sellerId)
  const products = useSellerProducts(sellerId)

  useEffect(() => {
    if (!sellerId) return
    void sellerService.fetchStore().catch(() => undefined)
  }, [sellerId])

  const [saving, setSaving] = useState(false)
  const [regions, setRegions] = useState<Region[]>([])
  const [cities, setCities] = useState<City[]>([])

  // Geography is reference data served by the API, not bundled with the app.
  useEffect(() => {
    let active = true
    geoService
      .fetchRegions()
      .then((rows) => active && setRegions(rows))
      .catch(() => undefined)
    geoService
      .fetchCities()
      .then((rows) => active && setCities(rows))
      .catch(() => undefined)
    return () => {
      active = false
    }
  }, [])

  const defaultValues = useMemo<StoreFormValues>(
    () => ({
      storeName: seller?.storeName ?? '',
      storeSlug: seller?.storeSlug ?? '',
      businessCategory: seller?.businessCategory ?? businessCategories[0],
      regionId: seller?.regionId ? String(seller.regionId) : '',
      cityId: seller?.cityId ? String(seller.cityId) : '',
      address: seller?.address ?? '',
      phone: seller?.contactPhone ?? seller?.ownerPhone ?? '',
      storeDescription: seller?.storeDescription ?? '',
      logoUrl: seller?.logoUrl ?? '',
      bannerUrl: seller?.bannerUrl ?? '',
    }),
    [seller],
  )

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<StoreFormValues>({ mode: 'onTouched', defaultValues })

  const regionId = watch('regionId')
  const logoUrl = watch('logoUrl')
  const bannerUrl = watch('bannerUrl')

  // Hydrate the form once the store (or a refreshed copy) arrives.
  useEffect(() => {
    reset(defaultValues)
  }, [defaultValues, reset])

  const cityOptions = useMemo(
    () => cities.filter((c) => String(c.regionId) === regionId).map((c) => ({ label: c.name, value: String(c.id) })),
    [regionId],
  )

  const logoSuggestions = useMemo(
    () => [...PHOTOS.furniture.slice(0, 4), ...PHOTOS['home-decor'].slice(0, 4)],
    [],
  )
  const bannerSuggestions = useMemo(
    () => [...PHOTOS.furniture.slice(0, 3), ...PHOTOS.electronics.slice(0, 3)],
    [],
  )

  const onSubmit = handleSubmit(async (values) => {
    setSaving(true)
    await sellerService.updateSellerStore({
      storeName: values.storeName.trim(),
      businessCategory: values.businessCategory,
      storeDescription: values.storeDescription.trim(),
      contactPhone: values.phone.trim() || null,
      regionId: values.regionId ? Number(values.regionId) : null,
      cityId: values.cityId ? Number(values.cityId) : null,
      address: values.address.trim() || null,
      logoUrl: values.logoUrl.trim() || null,
      bannerUrl: values.bannerUrl.trim() || null,
    })
    setSaving(false)
    toast.success('Store updated', 'Your store profile has been saved.')
  })

  const healthChecks = [
    { label: 'Complete your profile', done: !!seller?.storeDescription && !!seller?.logoUrl && !!seller?.bannerUrl },
    { label: 'List at least 3 products', done: products.length >= 3 },
    { label: 'Add product images', done: products.some((p) => p.images.length > 0) },
    { label: 'Make your first sale', done: (seller?.totalSales ?? 0) > 0 },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Store profile"
        description="How your store appears to shoppers across Shopio."
        actions={
          <>
            <Button
              variant="outline"
              to={`/search?q=${encodeURIComponent(seller?.storeName ?? '')}`}
            >
              <ExternalLink className="h-4 w-4" aria-hidden="true" />
              View public store
            </Button>
            <Button onClick={onSubmit} loading={saving}>
              <Save className="h-4 w-4" aria-hidden="true" />
              Save changes
            </Button>
          </>
        }
      />

      <form className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start" onSubmit={onSubmit}>
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Store details</CardTitle>
            </CardHeader>
            <CardBody className="grid gap-5 sm:grid-cols-2">
              <Input
                label="Store name"
                error={errors.storeName?.message}
                {...register('storeName', { required: 'A store name is required' })}
              />
              <div>
                <span className="mb-1.5 block text-sm font-medium text-ink">Store URL</span>
                <div className="flex h-10 items-center rounded-lg border border-ink-200 bg-ink-50 px-3 text-sm text-ink-500">
                  shopio.co.tz/store/{watch('storeSlug')}
                </div>
                <p className="mt-1.5 text-xs text-ink-500">Store URLs are fixed once your store is approved.</p>
              </div>
              <Select
                label="Business category"
                options={businessCategories.map((c) => ({ label: c, value: c }))}
                error={errors.businessCategory?.message}
                {...register('businessCategory', { required: 'Choose a business category' })}
              />
              <Input
                label="Contact phone"
                type="tel"
                inputMode="tel"
                error={errors.phone?.message}
                {...register('phone', {
                  validate: (value) => !value || value.replace(/\D/g, '').length >= 9 || 'Enter a valid phone number',
                })}
              />
              <Select
                label="Region"
                options={regions.map((r) => ({ label: r.name, value: String(r.id) }))}
                error={errors.regionId?.message}
                {...register('regionId', {
                  validate: (value) => (regions.length === 0 || value ? true : 'Select a region'),
                  onChange: () => setValue('cityId', ''),
                })}
              />
              <Select
                label="City / district"
                options={cityOptions}
                error={errors.cityId?.message}
                {...register('cityId', {
                  validate: (value) => (cities.length === 0 || value ? true : 'Select a city'),
                })}
              />
              <Input
                className="sm:col-span-2"
                label="Street address"
                error={errors.address?.message}
                {...register('address', { required: 'A street address is required' })}
              />
              <Textarea
                className="sm:col-span-2"
                label="Store description"
                rows={4}
                hint="Shown on your public store page and in search results."
                error={errors.storeDescription?.message}
                {...register('storeDescription', {
                  required: 'A store description is required',
                  minLength: { value: 20, message: 'Please write at least 20 characters' },
                })}
              />
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Logo &amp; banner</CardTitle>
            </CardHeader>
            <CardBody className="space-y-6">
              <div className="grid gap-5 sm:grid-cols-2">
                <div className="space-y-3">
                  <Input
                    label="Logo URL"
                    placeholder="https://…"
                    error={errors.logoUrl?.message}
                    {...register('logoUrl')}
                  />
                  <SmartImage
                    src={logoUrl || undefined}
                    alt="Store logo preview"
                    wrapperClassName="aspect-square w-32 rounded-card border border-ink-200"
                    fallbackLabel="Logo"
                  />
                </div>
                <div className="space-y-3">
                  <Input
                    label="Banner URL"
                    placeholder="https://…"
                    error={errors.bannerUrl?.message}
                    {...register('bannerUrl')}
                  />
                  <SmartImage
                    src={bannerUrl || undefined}
                    alt="Store banner preview"
                    wrapperClassName="aspect-[16/6] w-full rounded-card border border-ink-200"
                    fallbackLabel="Banner"
                  />
                </div>
              </div>

              <div>
                <p className="mb-2 text-sm font-medium text-ink">Suggested logos</p>
                <div className="flex flex-wrap gap-3">
                  {logoSuggestions.map((photo) => {
                    const url = imgSquare(photo, 160)
                    return (
                      <button
                        key={photo}
                        type="button"
                        aria-label="Use suggested logo"
                        onClick={() => setValue('logoUrl', url, { shouldDirty: true })}
                        className="h-16 w-16 overflow-hidden rounded-lg border border-ink-200 transition hover:border-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/70"
                      >
                        <img src={url} alt="" className="h-full w-full object-cover" loading="lazy" />
                      </button>
                    )
                  })}
                </div>
              </div>

              <div>
                <p className="mb-2 text-sm font-medium text-ink">Suggested banners</p>
                <div className="flex flex-wrap gap-3">
                  {bannerSuggestions.map((photo) => {
                    const url = imgWide(photo, 400)
                    return (
                      <button
                        key={photo}
                        type="button"
                        aria-label="Use suggested banner"
                        onClick={() => setValue('bannerUrl', url, { shouldDirty: true })}
                        className="h-16 w-28 overflow-hidden rounded-lg border border-ink-200 transition hover:border-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/70"
                      >
                        <img src={url} alt="" className="h-full w-full object-cover" loading="lazy" />
                      </button>
                    )
                  })}
                </div>
              </div>

              <p className="text-xs text-ink-500">
                Upload JPG, PNG or WebP files up to 5 MB.
              </p>
            </CardBody>
          </Card>

          <div className="flex justify-end">
            <Button type="submit" loading={saving}>
              <Save className="h-4 w-4" aria-hidden="true" />
              Save changes
            </Button>
          </div>
        </div>

        <aside className="space-y-6 lg:sticky lg:top-24">
          <Card>
            <CardHeader>
              <CardTitle>Store health</CardTitle>
            </CardHeader>
            <CardBody>
              <ul className="space-y-3">
                {healthChecks.map((check) => (
                  <li key={check.label} className="flex items-center gap-3 text-sm">
                    <span
                      className={
                        check.done
                          ? 'flex h-5 w-5 items-center justify-center rounded-full bg-success-50 text-success-600'
                          : 'flex h-5 w-5 items-center justify-center rounded-full bg-ink-100 text-ink-400'
                      }
                    >
                      {check.done ? <Check className="h-3 w-3" aria-hidden="true" /> : <X className="h-3 w-3" aria-hidden="true" />}
                    </span>
                    <span className={check.done ? 'text-ink' : 'text-ink-500'}>{check.label}</span>
                  </li>
                ))}
              </ul>
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Status</CardTitle>
            </CardHeader>
            <CardBody className="space-y-4 text-sm">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-ink-500">
                  <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                  Verification
                </span>
                <StatusBadge status={seller?.verificationStatus ?? 'not_submitted'} kind="verification" />
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-ink-500">
                  <Store className="h-4 w-4" aria-hidden="true" />
                  Store status
                </span>
                <StatusBadge status={seller?.status ?? 'active'} kind="user" />
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-ink-500">
                  <Percent className="h-4 w-4" aria-hidden="true" />
                  Commission
                </span>
                <span className="font-medium text-ink">{seller?.commissionRate ?? 0}%</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-ink-500">
                  <CalendarDays className="h-4 w-4" aria-hidden="true" />
                  Member since
                </span>
                <span className="font-medium text-ink">{seller ? formatDate(seller.createdAt) : '—'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-ink-500">
                  <Star className="h-4 w-4" aria-hidden="true" />
                  Rating
                </span>
                <Stars rating={seller?.rating ?? 0} size="sm" showValue reviewCount={seller?.reviewCount} />
              </div>
              <div className="flex items-center justify-between border-t border-ink-200 pt-4">
                <span className="text-ink-500">Total sales</span>
                <span className="font-medium text-ink">{formatCurrency(seller?.totalSales ?? 0, { compact: true })}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-ink-500">Products</span>
                <span className="font-medium text-ink">{products.length}</span>
              </div>
            </CardBody>
          </Card>

          {seller?.verificationStatus === 'rejected' && seller.verificationNotes && (
            <Alert tone="warning" title="Verification needs attention">
              {seller.verificationNotes}
            </Alert>
          )}
        </aside>
      </form>
    </div>
  )
}
