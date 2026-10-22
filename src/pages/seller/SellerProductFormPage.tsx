import { useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  ChevronLeft,
  ChevronRight,
  Eye,
  ImagePlus,
  Plus,
  Save,
  Star,
  Trash2,
  X,
} from 'lucide-react'
import {
  Alert,
  Badge,
  Breadcrumbs,
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  Checkbox,
  EmptyState,
  Input,
  Modal,
  PageHeader,
  Radio,
  Select,
  Textarea,
} from '@/components/ui'
import { ProductCard } from '@/components/products/ProductCard'
import {
  useAuthStore,
  useCategories,
  useProductById,
  useSellerProducts,
  type ProductFormValues,
} from '@/context'
import { toast } from '@/context/uiStore'
import { sellerService } from '@/services'
import { PHOTOS, imgCard } from '@/content/images'
import type { ConditionType, Product, ProductStatus } from '@/types'
import { cn, discountPercent, formatCurrency, slugify } from '@/lib/utils'

interface FormValues {
  name: string
  brand: string
  categoryId: number
  conditionType: ConditionType
  shortDescription: string
  description: string
  price: number
  compareAtPrice: number
  sku: string
  stock: number
  lowStockThreshold: number
  status: ProductStatus
  guidelines: boolean
}

interface OptionDraft {
  name: string
  valuesText: string
}

const CONDITION_OPTIONS = [
  { label: 'New', value: 'new' },
  { label: 'Used', value: 'used' },
  { label: 'Refurbished', value: 'refurbished' },
]

const SHORT_DESC_MAX = 200

export default function SellerProductFormPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.session?.user)
  const sellerId = user?.sellerId ?? null
  const productId = id ? Number(id) : null
  const isEdit = productId != null
  const product = useProductById(productId)
  const categories = useCategories()

  useEffect(() => {
    if (!isEdit || !sellerId) return
    void sellerService.fetchSellerProducts({ pageSize: 100 }).catch(() => undefined)
  }, [isEdit, sellerId])

  const [images, setImages] = useState<string[]>([])
  const [options, setOptions] = useState<OptionDraft[]>([])
  const [imageUrlInput, setImageUrlInput] = useState('')
  const [saving, setSaving] = useState(false)
  const [previewOpen, setPreviewOpen] = useState(false)

  const defaultValues = useMemo<FormValues>(
    () => ({
      name: product?.name ?? '',
      brand: product?.brand ?? '',
      categoryId: product?.categoryId ?? categories[0]?.id ?? 1,
      conditionType: product?.conditionType ?? 'new',
      shortDescription: product?.shortDescription ?? '',
      description: product?.description ?? '',
      price: product?.variants[0]?.price ?? 0,
      compareAtPrice: product?.variants[0]?.compareAtPrice ?? 0,
      sku: product?.variants[0]?.sku ?? '',
      stock: product ? product.variants.reduce((sum, variant) => sum + variant.stock, 0) : 0,
      lowStockThreshold: product?.variants[0]?.lowStockThreshold ?? 5,
      status: product?.status ?? 'draft',
      guidelines: false,
    }),
    // Recompute defaults only when the product identity changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [productId],
  )

  const {
    register,
    handleSubmit,
    watch,
    reset,
    getValues,
    formState: { errors },
  } = useForm<FormValues>({ mode: 'onTouched', defaultValues })

  // Reset the form when editing an existing product.
  useEffect(() => {
    if (isEdit && product) {
      reset(defaultValues)
      setImages(product.images.map((image) => image.imageUrl))
      setOptions(product.optionTypes.map((option) => ({ name: option.name, valuesText: option.values.join(', ') })))
    } else if (!isEdit) {
      setImages([])
      setOptions([])
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId])

  const nameValue = watch('name') ?? ''
  const priceValue = watch('price') || 0
  const compareAtValue = watch('compareAtPrice') || 0
  const stockValue = watch('stock') || 0
  const categoryIdValue = watch('categoryId')
  const statusValue = watch('status')
  const shortDescriptionValue = watch('shortDescription') ?? ''

  const categorySlug = categories.find((c) => c.id === categoryIdValue)?.slug
  const photoGroup: readonly string[] =
    categorySlug && categorySlug in PHOTOS ? PHOTOS[categorySlug as keyof typeof PHOTOS] : PHOTOS.furniture
  const suggestions = photoGroup.slice(0, 8)

  const discount = discountPercent(priceValue, compareAtValue || null)

  const parsedOptions = useMemo(
    () =>
      options
        .map((option) => ({
          name: option.name.trim(),
          values: option.valuesText
            .split(',')
            .map((value) => value.trim())
            .filter(Boolean),
        }))
        .filter((option) => option.name && option.values.length > 0),
    [options],
  )

  const variantPreview = useMemo(() => {
    if (parsedOptions.length === 0) {
      return [{ name: 'Default', price: priceValue, stock: stockValue }]
    }
    let combos: Array<Record<string, string>> = [{}]
    parsedOptions.forEach((option) => {
      combos = combos.flatMap((combo) => option.values.map((value) => ({ ...combo, [option.name]: value })))
    })
    const perVariant = Math.max(1, Math.floor(stockValue / combos.length))
    return combos.map((combo, index) => ({
      name: Object.values(combo).join(' / ') || 'Default',
      price: priceValue,
      stock: index === 0 ? stockValue - perVariant * (combos.length - 1) : perVariant,
    }))
  }, [parsedOptions, priceValue, stockValue])

  const completion = useMemo(() => {
    const checks = [
      nameValue.trim().length > 1,
      !!categoryIdValue,
      shortDescriptionValue.trim().length > 10,
      (watch('description') ?? '').trim().length > 20,
      priceValue > 0,
      (watch('sku') ?? '').trim().length > 0,
      images.length > 0,
    ]
    return Math.round((checks.filter(Boolean).length / checks.length) * 100)
  }, [nameValue, categoryIdValue, shortDescriptionValue, priceValue, images, watch])

  if (isEdit && (!product || product.sellerId !== sellerId)) {
    return (
      <div className="space-y-6">
        <PageHeader title="Edit product" breadcrumbs={<Breadcrumbs items={[{ label: 'Products', to: '/seller/products' }, { label: 'Edit' }]} />} />
        <EmptyState
          icon={<ImagePlus className="h-5 w-5" />}
          title="Product not found"
          description="This product does not exist or does not belong to your store."
          action={{ label: 'Back to products', to: '/seller/products' }}
        />
      </div>
    )
  }

  const addImage = (url: string) => {
    const trimmed = url.trim()
    if (!trimmed) return
    setImages((prev) => (prev.includes(trimmed) ? prev : [...prev, trimmed]))
    setImageUrlInput('')
  }

  const removeImage = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index))
  }

  const moveImage = (index: number, direction: -1 | 1) => {
    setImages((prev) => {
      const next = [...prev]
      const target = index + direction
      if (target < 0 || target >= next.length) return prev
      ;[next[index], next[target]] = [next[target], next[index]]
      return next
    })
  }

  const makePrimary = (index: number) => {
    setImages((prev) => {
      const next = [...prev]
      const [item] = next.splice(index, 1)
      return [item, ...next]
    })
  }

  const addOption = () => setOptions((prev) => [...prev, { name: '', valuesText: '' }])
  const removeOption = (index: number) => setOptions((prev) => prev.filter((_, i) => i !== index))
  const updateOption = (index: number, patch: Partial<OptionDraft>) =>
    setOptions((prev) => prev.map((option, i) => (i === index ? { ...option, ...patch } : option)))

  const previewProduct: Product = {
    id: product?.id ?? -1,
    sellerId: sellerId ?? 0,
    categoryId: categoryIdValue ?? null,
    name: nameValue || 'Untitled product',
    slug: slugify(nameValue || 'preview'),
    shortDescription: watch('shortDescription') ?? null,
    description: watch('description') ?? null,
    brand: watch('brand') ?? null,
    conditionType: watch('conditionType') ?? 'new',
    status: 'active',
    currency: 'TZS',
    createdAt: product?.createdAt ?? new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    categoryName: categories.find((c) => c.id === categoryIdValue)?.name,
    images: images.map((url, index) => ({
      id: index,
      productId: -1,
      imageUrl: url,
      altText: nameValue,
      sortOrder: index,
      isPrimary: index === 0,
    })),
    variants: variantPreview.map((variant, index) => ({
      id: index,
      productId: -1,
      sku: `${watch('sku') || 'SKU'}-${index + 1}`,
      variantName: variant.name,
      price: variant.price,
      compareAtPrice: compareAtValue > priceValue ? compareAtValue : null,
      costPrice: null,
      weightGrams: null,
      isDefault: index === 0,
      isActive: true,
      options: {},
      stock: variant.stock,
      lowStockThreshold: watch('lowStockThreshold') ?? 5,
    })),
    optionTypes: parsedOptions,
    rating: product?.rating ?? 0,
    reviewCount: product?.reviewCount ?? 0,
    soldCount: product?.soldCount ?? 0,
    tags: [],
  }

  const save = (status: ProductStatus) => {
    void handleSubmit(async (values) => {
      if (images.length === 0) {
        toast.error('At least one image is required', 'Add a product photo before saving.')
        return
      }
      if (status !== 'draft' && !values.guidelines) {
        toast.error('Confirm the guidelines', 'Please confirm the product meets Shopio guidelines before publishing.')
        return
      }

      const payload: ProductFormValues = {
        name: values.name.trim(),
        categoryId: values.categoryId,
        shortDescription: values.shortDescription.trim(),
        description: values.description.trim(),
        brand: values.brand.trim(),
        conditionType: values.conditionType,
        status,
        images,
        price: values.price,
        compareAtPrice:
          values.compareAtPrice && values.compareAtPrice > values.price ? values.compareAtPrice : null,
        sku: values.sku.trim(),
        stock: values.stock,
        lowStockThreshold: values.lowStockThreshold,
        options: parsedOptions,
        sellerId: sellerId ?? 0,
      }

      setSaving(true)
      try {
        if (isEdit && product) {
          await sellerService.updateSellerProduct(product.id, payload)
          toast.success('Product updated', values.name.trim())
        } else {
          await sellerService.createSellerProduct(payload)
          toast.success('Product created', values.name.trim())
        }
        navigate('/seller/products')
      } finally {
        setSaving(false)
      }
    })()
  }

  const primaryLabel = statusValue === 'active' ? 'Publish' : statusValue === 'pending_review' ? 'Submit for review' : 'Save draft'

  return (
    <div className="space-y-6">
      <PageHeader
        title={isEdit ? 'Edit product' : 'Add product'}
        description={isEdit ? 'Update details, pricing, imagery and stock.' : 'Create a new listing for your store.'}
        breadcrumbs={
          <Breadcrumbs
            items={[{ label: 'Products', to: '/seller/products' }, { label: isEdit ? 'Edit' : 'New' }]}
          />
        }
        actions={
          <>
            <Button variant="outline" to="/seller/products">
              Cancel
            </Button>
            <Button variant="outline" onClick={() => setPreviewOpen(true)}>
              <Eye className="h-4 w-4" aria-hidden="true" />
              Preview
            </Button>
            <Button onClick={() => save('draft')} loading={saving} variant="secondary">
              Save draft
            </Button>
            <Button onClick={() => save(statusValue === 'active' ? 'active' : statusValue)} loading={saving}>
              {primaryLabel}
            </Button>
          </>
        }
      />

      <form className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start" onSubmit={(event) => event.preventDefault()}>
        <div className="space-y-6">
          {/* Basics */}
          <Card>
            <CardHeader>
              <CardTitle>Basics</CardTitle>
            </CardHeader>
            <CardBody className="grid gap-5 sm:grid-cols-2">
              <Input
                className="sm:col-span-2"
                label="Product name"
                placeholder="e.g. 3-Seater Fabric Sofa"
                error={errors.name?.message}
                {...register('name', {
                  required: 'A product name is required',
                  minLength: { value: 3, message: 'Use at least 3 characters' },
                })}
              />
              <Input
                label="Brand"
                placeholder="e.g. Your store name"
                error={errors.brand?.message}
                {...register('brand')}
              />
              <Select
                label="Category"
                placeholder="Select a category"
                options={categories.map((c) => ({ label: c.name, value: c.id }))}
                error={errors.categoryId?.message}
                {...register('categoryId', {
                  required: 'Choose a category',
                  valueAsNumber: true,
                })}
              />
              <Select
                label="Condition"
                options={CONDITION_OPTIONS}
                error={errors.conditionType?.message}
                {...register('conditionType', { required: 'Select a condition' })}
              />
              <Input
                label="SKU"
                placeholder="e.g. MAV-SOFA-3S"
                error={errors.sku?.message}
                {...register('sku', { required: 'A SKU is required' })}
              />
              <div className="sm:col-span-2">
                <Textarea
                  label="Short description"
                  rows={2}
                  placeholder="A one-line summary shown on product cards."
                  error={errors.shortDescription?.message}
                  {...register('shortDescription', {
                    required: 'A short description is required',
                    maxLength: { value: SHORT_DESC_MAX, message: `Keep it under ${SHORT_DESC_MAX} characters` },
                  })}
                />
                <p
                  className={cn(
                    'mt-1.5 text-right text-xs',
                    shortDescriptionValue.length > SHORT_DESC_MAX ? 'text-danger-600' : 'text-ink-500',
                  )}
                >
                  {shortDescriptionValue.length}/{SHORT_DESC_MAX}
                </p>
              </div>
              <Textarea
                className="sm:col-span-2"
                label="Full description"
                rows={5}
                placeholder="Describe materials, dimensions and what is included."
                error={errors.description?.message}
                {...register('description', {
                  required: 'A full description is required',
                  minLength: { value: 20, message: 'Please write at least 20 characters' },
                })}
              />
            </CardBody>
          </Card>

          {/* Pricing */}
          <Card>
            <CardHeader>
              <CardTitle>Pricing &amp; stock</CardTitle>
            </CardHeader>
            <CardBody className="grid gap-5 sm:grid-cols-2">
              <Input
                label="Price (TZS)"
                type="number"
                inputMode="numeric"
                min={0}
                error={errors.price?.message}
                {...register('price', {
                  required: 'A price is required',
                  valueAsNumber: true,
                  min: { value: 1, message: 'Price must be greater than zero' },
                })}
              />
              <Input
                label="Compare-at price (TZS)"
                type="number"
                inputMode="numeric"
                min={0}
                hint="Optional. Shown crossed out to indicate a discount."
                error={errors.compareAtPrice?.message}
                {...register('compareAtPrice', {
                  valueAsNumber: true,
                  validate: (value) =>
                    !value || value > getValues('price') || 'Compare-at price must be higher than the price',
                })}
              />
              <Input
                label="Stock quantity"
                type="number"
                inputMode="numeric"
                min={0}
                error={errors.stock?.message}
                {...register('stock', {
                  required: 'Stock is required',
                  valueAsNumber: true,
                  min: { value: 0, message: 'Stock cannot be negative' },
                })}
              />
              <Input
                label="Low-stock threshold"
                type="number"
                inputMode="numeric"
                min={0}
                hint="Alert when stock falls to this level."
                error={errors.lowStockThreshold?.message}
                {...register('lowStockThreshold', {
                  valueAsNumber: true,
                  min: { value: 0, message: 'Threshold cannot be negative' },
                })}
              />
              {discount > 0 && (
                <div className="sm:col-span-2">
                  <Alert tone="success" title={`${discount}% discount`}>
                    Customers will see {formatCurrency(priceValue)} against a {formatCurrency(compareAtValue)}{' '}
                    compare-at price.
                  </Alert>
                </div>
              )}
            </CardBody>
          </Card>

          {/* Images */}
          <Card>
            <CardHeader>
              <CardTitle>Images</CardTitle>
              <Badge tone={images.length ? 'success' : 'warning'} size="sm">
                {images.length} added
              </Badge>
            </CardHeader>
            <CardBody className="space-y-5">
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input
                  className="flex-1"
                  label="Image URL"
                  placeholder="https://…"
                  value={imageUrlInput}
                  onChange={(event) => setImageUrlInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault()
                      addImage(imageUrlInput)
                    }
                  }}
                />
                <Button className="sm:mt-7" variant="outline" onClick={() => addImage(imageUrlInput)}>
                  <Plus className="h-4 w-4" aria-hidden="true" />
                  Add image
                </Button>
              </div>

              <div>
                <p className="mb-2 text-sm font-medium text-ink">Suggested photos</p>
                <div className="grid grid-cols-4 gap-3 sm:grid-cols-6">
                  {suggestions.map((photo) => {
                    const url = imgCard(photo)
                    return (
                      <button
                        key={photo}
                        type="button"
                        aria-label="Add suggested image"
                        onClick={() => addImage(url)}
                        className="group relative aspect-square overflow-hidden rounded-lg border border-ink-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/70"
                      >
                        <img src={url} alt="" className="h-full w-full object-cover" loading="lazy" />
                        <span className="absolute inset-0 flex items-center justify-center bg-ink/0 text-white opacity-0 transition group-hover:bg-ink/40 group-hover:opacity-100">
                          <Plus className="h-5 w-5" aria-hidden="true" />
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>

              {images.length === 0 ? (
                <p className="rounded-lg border border-dashed border-ink-200 px-4 py-6 text-center text-sm text-ink-500">
                  No images yet. Add at least one — the first image becomes the primary.
                </p>
              ) : (
                <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                  {images.map((url, index) => (
                    <li key={`${url}-${index}`} className="space-y-2">
                      <div className="relative aspect-square overflow-hidden rounded-lg border border-ink-200">
                        <img src={url} alt="" className="h-full w-full object-cover" loading="lazy" />
                        {index === 0 && (
                          <span className="absolute left-2 top-2">
                            <Badge tone="dark" size="sm" icon={<Star className="h-3 w-3" aria-hidden="true" />}>
                              Primary
                            </Badge>
                          </span>
                        )}
                        <button
                          type="button"
                          aria-label="Remove image"
                          onClick={() => removeImage(index)}
                          className="absolute right-2 top-2 inline-flex h-7 w-7 items-center justify-center rounded-full bg-white/90 text-danger-600 shadow-card transition hover:bg-white"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          aria-label="Move image left"
                          disabled={index === 0}
                          onClick={() => moveImage(index, -1)}
                          className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-ink-200 text-ink transition hover:bg-ink-50 disabled:opacity-40"
                        >
                          <ChevronLeft className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          aria-label="Move image right"
                          disabled={index === images.length - 1}
                          onClick={() => moveImage(index, 1)}
                          className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-ink-200 text-ink transition hover:bg-ink-50 disabled:opacity-40"
                        >
                          <ChevronRight className="h-3.5 w-3.5" />
                        </button>
                        {index !== 0 && (
                          <button
                            type="button"
                            onClick={() => makePrimary(index)}
                            className="ml-auto text-xs font-medium text-ink link-underline"
                          >
                            Make primary
                          </button>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}

              <p className="text-xs text-ink-500">
                Upload JPG, PNG or WebP files up to 5 MB.
              </p>
            </CardBody>
          </Card>

          {/* Options & variants */}
          <Card>
            <CardHeader>
              <CardTitle>Options &amp; variants</CardTitle>
              <Button size="sm" variant="outline" onClick={addOption}>
                <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                Add option
              </Button>
            </CardHeader>
            <CardBody className="space-y-5">
              {options.length === 0 ? (
                <p className="text-sm text-ink-500">
                  No options. The product will have a single default variant. Add an option such as “Colour” or
                  “Size” to create variants.
                </p>
              ) : (
                <div className="space-y-4">
                  {options.map((option, index) => (
                    <div key={index} className="grid gap-3 sm:grid-cols-[1fr_2fr_auto] sm:items-end">
                      <Input
                        label="Option name"
                        placeholder="e.g. Colour"
                        value={option.name}
                        onChange={(event) => updateOption(index, { name: event.target.value })}
                      />
                      <Input
                        label="Values (comma separated)"
                        placeholder="e.g. Stone Beige, Charcoal, Sand"
                        value={option.valuesText}
                        onChange={(event) => updateOption(index, { valuesText: event.target.value })}
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Remove option"
                        onClick={() => removeOption(index)}
                      >
                        <Trash2 className="h-4 w-4 text-danger-600" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              <div className="rounded-lg border border-ink-200">
                <div className="border-b border-ink-200 px-4 py-2.5">
                  <p className="text-sm font-medium text-ink">Variant preview</p>
                  <p className="text-xs text-ink-500">
                    {variantPreview.length} variant{variantPreview.length === 1 ? '' : 's'} generated from your
                    options.
                  </p>
                </div>
                <ul className="divide-y divide-ink-100">
                  {variantPreview.slice(0, 8).map((variant, index) => (
                    <li key={index} className="flex items-center justify-between gap-4 px-4 py-2.5 text-sm">
                      <span className="truncate text-ink">{variant.name}</span>
                      <span className="flex items-center gap-4 text-ink-500">
                        <span>{formatCurrency(variant.price)}</span>
                        <span>~{variant.stock} in stock</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </CardBody>
          </Card>

          {/* Publish */}
          <Card>
            <CardHeader>
              <CardTitle>Publish</CardTitle>
            </CardHeader>
            <CardBody className="space-y-4">
              <fieldset className="space-y-3">
                <legend className="text-sm font-medium text-ink">Visibility when you save</legend>
                {[
                  { value: 'draft', label: 'Save as draft', description: 'Only visible to you.' },
                  { value: 'pending_review', label: 'Submit for review', description: 'Shopio reviews it before it goes live.' },
                  { value: 'active', label: 'Publish now', description: 'Immediately visible to shoppers.' },
                ].map((option) => (
                  <Radio
                    key={option.value}
                    value={option.value}
                    label={option.label}
                    description={option.description}
                    {...register('status')}
                  />
                ))}
              </fieldset>

              <div className="border-t border-ink-200 pt-4">
                <Checkbox
                  label="This product meets Shopio's catalogue guidelines."
                  description="Accurate description, genuine imagery and no prohibited items."
                  error={errors.guidelines?.message}
                  {...register('guidelines')}
                />
              </div>
            </CardBody>
          </Card>
        </div>

        {/* Summary */}
        <aside className="space-y-6 lg:sticky lg:top-24">
          <Card>
            <CardBody className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold text-ink">Listing summary</h2>
                <span className="text-sm font-medium text-ink">{completion}%</span>
              </div>
              <div className="h-2 rounded-full bg-ink-100">
                <div className="h-2 rounded-full bg-ink transition-all" style={{ width: `${completion}%` }} />
              </div>
              <dl className="space-y-3 text-sm">
                <div className="flex items-center justify-between">
                  <dt className="text-ink-500">Price</dt>
                  <dd className="font-medium text-ink">{priceValue > 0 ? formatCurrency(priceValue) : '—'}</dd>
                </div>
                {discount > 0 && (
                  <div className="flex items-center justify-between">
                    <dt className="text-ink-500">Discount</dt>
                    <dd className="font-medium text-success-700">{discount}% off</dd>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <dt className="text-ink-500">Variants</dt>
                  <dd className="font-medium text-ink">{variantPreview.length}</dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="text-ink-500">Images</dt>
                  <dd className="font-medium text-ink">{images.length}</dd>
                </div>
              </dl>
            </CardBody>
          </Card>

          <Alert tone="info" title="How saving works">
            Changes are validated by the backend. Submitting a listing sends it for moderation before it goes
            live.
          </Alert>

          <Button variant="outline" fullWidth onClick={() => setPreviewOpen(true)}>
            <Eye className="h-4 w-4" aria-hidden="true" />
            Preview listing
          </Button>
        </aside>
      </form>

      {/* Preview modal */}
      <Modal
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        title="Product preview"
        description="How this listing will look in the catalogue."
        size="lg"
        footer={
          <Button variant="outline" onClick={() => setPreviewOpen(false)}>
            Close
          </Button>
        }
      >
        <div className="max-w-xs">
          <ProductCard product={previewProduct} />
        </div>
        <p className="mt-4 text-xs text-ink-500">
          Preview only — the live listing uses the status you choose when saving.
        </p>
      </Modal>

      <div className="flex items-center gap-2 text-sm text-ink-500">
        <Save className="h-4 w-4" aria-hidden="true" />
        <span>
          Need help? Read the{' '}
          <Link to="/faq" className="link-underline">
            seller FAQ
          </Link>
          .
        </span>
      </div>
    </div>
  )
}
