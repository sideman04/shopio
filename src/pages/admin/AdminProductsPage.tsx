import { useEffect, useMemo, useState } from 'react'
import {
  Archive,
  Check,
  Download,
  MoreHorizontal,
  Package,
  Pencil,
  Trash2,
  X,
} from 'lucide-react'
import {
  Badge,
  Button,
  Checkbox,
  ConfirmDialog,
  Dropdown,
  EmptyState,
  Input,
  Modal,
  PageHeader,
  Pagination,
  Select,
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
import { useCatalogStore } from '@/context/catalogStore'
import { usePeopleStore } from '@/context/peopleStore'
import { toast } from '@/context/uiStore'
import type { Product, ProductStatus } from '@/types'
import { formatCurrency, formatDate, formatNumber, truncate } from '@/lib/utils'

const PAGE_SIZE = 8

const TABS: Array<{ id: string; label: string; match: (p: Product) => boolean }> = [
  { id: 'all', label: 'All', match: () => true },
  { id: 'pending_review', label: 'Pending review', match: (p) => p.status === 'pending_review' },
  { id: 'active', label: 'Active', match: (p) => p.status === 'active' },
  { id: 'draft', label: 'Draft', match: (p) => p.status === 'draft' },
  { id: 'rejected', label: 'Rejected', match: (p) => p.status === 'rejected' },
  { id: 'archived', label: 'Archived', match: (p) => p.status === 'archived' },
]

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

interface EditDraft {
  name: string
  brand: string
  categoryId: string
  price: string
  status: ProductStatus
}

/** Product catalogue moderation: approve, reject, edit, archive and delete. */
export default function AdminProductsPage() {
  const products = useCatalogStore((s) => s.products)
  const categories = useCatalogStore((s) => s.categories)
  const sellers = usePeopleStore((s) => s.sellers)

  const [tab, setTab] = useState('all')
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('all')
  const [sellerId, setSellerId] = useState('all')
  const [sort, setSort] = useState('newest')
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<number[]>([])

  const [reviewProduct, setReviewProduct] = useState<Product | null>(null)
  const [rejectMode, setRejectMode] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [busy, setBusy] = useState(false)

  const [editProduct, setEditProduct] = useState<Product | null>(null)
  const [editDraft, setEditDraft] = useState<EditDraft | null>(null)

  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null)
  const [bulk, setBulk] = useState<{ ids: number[]; action: 'approve' | 'archive' | 'delete' } | null>(null)

  useEffect(() => {
    setPage(1)
  }, [tab, search, category, sellerId, sort])

  useEffect(() => {
    void Promise.allSettled([
      adminService.fetchProducts({ pageSize: 100 }),
      adminService.fetchSellers({ pageSize: 100 }),
      adminService.fetchCategories(),
    ])
  }, [])

  const counts = useMemo(
    () => ({
      all: products.length,
      pending_review: products.filter((p) => p.status === 'pending_review').length,
      active: products.filter((p) => p.status === 'active').length,
      draft: products.filter((p) => p.status === 'draft').length,
      rejected: products.filter((p) => p.status === 'rejected').length,
      archived: products.filter((p) => p.status === 'archived').length,
    }),
    [products],
  )

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase()
    const activeTab = TABS.find((t) => t.id === tab)
    const list = products.filter((product) => {
      if (activeTab && !activeTab.match(product)) return false
      if (category !== 'all' && product.categorySlug !== category) return false
      if (sellerId !== 'all' && String(product.sellerId) !== sellerId) return false
      if (needle) {
        const haystack = [product.name, product.brand ?? '', product.variants.map((v) => v.sku).join(' '), product.sellerName ?? '']
          .join(' ')
          .toLowerCase()
        if (!haystack.includes(needle)) return false
      }
      return true
    })

    return list.sort((a, b) => {
      switch (sort) {
        case 'price':
          return (a.variants[0]?.price ?? 0) - (b.variants[0]?.price ?? 0)
        case 'rating':
          return b.rating - a.rating
        case 'sales':
          return b.soldCount - a.soldCount
        case 'newest':
        default:
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      }
    })
  }, [products, tab, category, sellerId, search, sort])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const paged = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  const outOfStockVariants = useMemo(
    () => products.reduce((sum, p) => sum + p.variants.filter((v) => v.stock <= 0).length, 0),
    [products],
  )

  const allOnPageSelected = paged.length > 0 && paged.every((p) => selected.includes(p.id))

  const toggleOne = (id: number) =>
    setSelected((current) => (current.includes(id) ? current.filter((x) => x !== id) : [...current, id]))

  const togglePage = () => {
    if (allOnPageSelected) {
      setSelected((current) => current.filter((id) => !paged.some((p) => p.id === id)))
    } else {
      setSelected((current) => Array.from(new Set([...current, ...paged.map((p) => p.id)])))
    }
  }

  const openReview = (product: Product) => {
    setReviewProduct(product)
    setRejectMode(false)
    setRejectReason('')
  }

  const approve = async (product: Product) => {
    setBusy(true)
    try {
      await adminService.moderateProduct(product.id, 'active')
      toast.success('Product approved', `${product.name} is now live in the catalogue.`)
      setReviewProduct(null)
    } finally {
      setBusy(false)
    }
  }

  const reject = async (product: Product, reason: string) => {
    if (!reason.trim()) {
      toast.error('A reason is required', 'Tell the seller what needs to change before resubmitting.')
      return
    }
    setBusy(true)
    try {
      await adminService.moderateProduct(product.id, 'rejected', reason.trim())
      toast.success('Product rejected', `${product.name} was returned to the seller with your reason.`)
      setReviewProduct(null)
      setRejectMode(false)
      setRejectReason('')
    } finally {
      setBusy(false)
    }
  }

  const openEdit = (product: Product) => {
    setEditProduct(product)
    setEditDraft({
      name: product.name,
      brand: product.brand ?? '',
      categoryId: String(product.categoryId ?? categories[0]?.id ?? ''),
      price: String(product.variants[0]?.price ?? 0),
      status: product.status,
    })
  }

  const saveEdit = async () => {
    if (!editProduct || !editDraft) return
    const price = Number(editDraft.price)
    if (!editDraft.name.trim()) {
      toast.error('Name is required', 'Give the product a descriptive name.')
      return
    }
    if (!Number.isFinite(price) || price <= 0) {
      toast.error('Enter a valid price', 'Price must be greater than zero.')
      return
    }
    setBusy(true)
    try {
      await adminService.adminUpdateProduct(editProduct.id, {
        name: editDraft.name.trim(),
        brand: editDraft.brand.trim(),
        categoryId: Number(editDraft.categoryId),
        price,
        status: editDraft.status,
      })
      toast.success('Product updated', `${editDraft.name} saved.`)
      setEditProduct(null)
      setEditDraft(null)
    } finally {
      setBusy(false)
    }
  }

  const setActive = async (product: Product) => {
    setBusy(true)
    try {
      await adminService.moderateProduct(product.id, 'active')
      toast.success('Product is active', `${product.name} is visible in the storefront.`)
    } finally {
      setBusy(false)
    }
  }

  const archive = async (product: Product) => {
    setBusy(true)
    try {
      await adminService.moderateProduct(product.id, 'archived')
      toast.success('Product archived', `${product.name} was moved out of the active catalogue.`)
    } finally {
      setBusy(false)
    }
  }

  const remove = async (product: Product) => {
    setBusy(true)
    try {
      await adminService.moderateProduct(product.id, 'archived')
      toast.success('Product archived', `${product.name} was removed from the active catalogue.`)
      setDeleteTarget(null)
      setSelected((current) => current.filter((id) => id !== product.id))
    } finally {
      setBusy(false)
    }
  }

  const runBulk = async () => {
    if (!bulk) return
    setBusy(true)
    try {
      if (bulk.action === 'approve') {
        await Promise.all(bulk.ids.map((id) => adminService.moderateProduct(id, 'active')))
        toast.success('Products approved', `${bulk.ids.length} listing${bulk.ids.length === 1 ? '' : 's'} published.`)
      } else if (bulk.action === 'archive') {
        await Promise.all(bulk.ids.map((id) => adminService.moderateProduct(id, 'archived')))
        toast.success('Products archived', `${bulk.ids.length} listing${bulk.ids.length === 1 ? '' : 's'} archived.`)
      } else {
        await Promise.all(bulk.ids.map((id) => adminService.moderateProduct(id, 'archived')))
        toast.success('Products archived', `${bulk.ids.length} listing${bulk.ids.length === 1 ? '' : 's'} removed from the active catalogue.`)
      }
      setBulk(null)
      setSelected([])
    } finally {
      setBusy(false)
    }
  }

  const handleExport = () => {
    downloadCsv('shopio-products.csv', [
      ['ID', 'Name', 'Brand', 'Seller', 'Category', 'Price', 'Stock', 'Status', 'Rating', 'Sold'],
      ...filtered.map((p) => [
        p.id,
        p.name,
        p.brand ?? '',
        p.sellerName ?? '',
        p.categoryName ?? '',
        p.variants[0]?.price ?? 0,
        p.variants.reduce((sum, v) => sum + v.stock, 0),
        p.status,
        p.rating,
        p.soldCount,
      ]),
    ])
    toast.success('Export ready', `${filtered.length} products exported to CSV.`)
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Products"
        description="Moderate listings, correct catalogue data and manage stock across every seller."
        actions={
          <Button variant="outline" onClick={handleExport}>
            <Download className="h-4 w-4" />
            Export CSV
          </Button>
        }
      />

      <section aria-label="Product summary" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total products" value={formatNumber(counts.all)} icon={<Package className="h-4 w-4" />} hint="all listings" />
        <StatCard label="Active" value={formatNumber(counts.active)} icon={<Check className="h-4 w-4" />} hint="live in storefront" />
        <StatCard label="Pending review" value={formatNumber(counts.pending_review)} icon={<Package className="h-4 w-4" />} hint="awaiting moderation" />
        <StatCard label="Out of stock variants" value={formatNumber(outOfStockVariants)} icon={<Archive className="h-4 w-4" />} hint="zero inventory" />
      </section>

      <Tabs
        value={tab}
        onChange={setTab}
        items={TABS.map((t) => ({
          id: t.id,
          label: t.label,
          badge: (
            <Badge
              tone={t.id === 'pending_review' ? 'warning' : t.id === 'rejected' ? 'danger' : t.id === 'active' ? 'success' : 'neutral'}
              size="sm"
            >
              {counts[t.id as keyof typeof counts]}
            </Badge>
          ),
        }))}
      />

      <div className="rounded-card border border-ink-200 bg-white shadow-card">
        <DataToolbar searchValue={search} onSearchChange={setSearch} searchPlaceholder="Search name, SKU or seller">
          <label className="sr-only" htmlFor="products-category-filter">Category</label>
          <Select
            id="products-category-filter"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            options={[{ label: 'All categories', value: 'all' }, ...categories.map((c) => ({ label: c.name, value: c.slug }))]}
            className="w-44"
          />
          <label className="sr-only" htmlFor="products-seller-filter">Seller</label>
          <Select
            id="products-seller-filter"
            value={sellerId}
            onChange={(e) => setSellerId(e.target.value)}
            options={[{ label: 'All sellers', value: 'all' }, ...sellers.map((s) => ({ label: s.storeName, value: String(s.id) }))]}
            className="w-48"
          />
          <label className="sr-only" htmlFor="products-sort">Sort</label>
          <Select
            id="products-sort"
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            options={[
              { label: 'Newest', value: 'newest' },
              { label: 'Price', value: 'price' },
              { label: 'Rating', value: 'rating' },
              { label: 'Best selling', value: 'sales' },
            ]}
            className="w-40"
          />
        </DataToolbar>

        {selected.length > 0 && (
          <div className="flex flex-wrap items-center gap-3 border-b border-ink-200 bg-sand-50 px-4 py-3">
            <p className="text-sm font-medium text-ink">{selected.length} selected</p>
            <div className="ml-auto flex flex-wrap gap-2">
              <Button size="sm" onClick={() => setBulk({ ids: selected, action: 'approve' })}>
                Approve
              </Button>
              <Button size="sm" variant="outline" onClick={() => setBulk({ ids: selected, action: 'archive' })}>
                Archive
              </Button>
              <Button size="sm" variant="danger" onClick={() => setBulk({ ids: selected, action: 'delete' })}>
                Delete
              </Button>
            </div>
          </div>
        )}

        {paged.length === 0 ? (
          <div className="p-6">
            <EmptyState
              size="sm"
              icon={<Package className="h-5 w-5" />}
              title="No products in this view"
              description="Change the tab, search or filters to find listings."
            />
          </div>
        ) : (
          <>
            <Table>
              <THead>
                <TR>
                  <TH className="w-10">
                    <Checkbox checked={allOnPageSelected} onChange={togglePage} aria-label="Select all products on this page" />
                  </TH>
                  <TH>Product</TH>
                  <TH>Seller</TH>
                  <TH>Category</TH>
                  <TH>Price</TH>
                  <TH>Stock</TH>
                  <TH>Status</TH>
                  <TH>Rating</TH>
                  <TH>Sold</TH>
                  <TH className="text-right">Actions</TH>
                </TR>
              </THead>
              <TBody>
                {paged.map((product) => {
                  const prices = product.variants.map((v) => v.price)
                  const min = prices.length ? Math.min(...prices) : 0
                  const max = prices.length ? Math.max(...prices) : 0
                  const stock = product.variants.reduce((sum, v) => sum + v.stock, 0)
                  return (
                    <TR key={product.id}>
                      <TD>
                        <Checkbox
                          checked={selected.includes(product.id)}
                          onChange={() => toggleOne(product.id)}
                          aria-label={`Select ${product.name}`}
                        />
                      </TD>
                      <TD>
                        <div className="flex items-center gap-3">
                          <SmartImage
                            src={product.images[0]?.imageUrl}
                            alt={product.name}
                            wrapperClassName="h-10 w-10 shrink-0 rounded-lg"
                            fallbackLabel={product.name}
                          />
                          <div className="min-w-0">
                            <p className="truncate font-medium text-ink">{product.name}</p>
                            <p className="truncate text-xs text-ink-500">{product.brand ?? 'No brand'}</p>
                          </div>
                        </div>
                      </TD>
                      <TD className="whitespace-nowrap">{product.sellerName ?? '—'}</TD>
                      <TD className="whitespace-nowrap">{product.categoryName ?? '—'}</TD>
                      <TD className="whitespace-nowrap">
                        {min === max ? formatCurrency(min) : `${formatCurrency(min, { compact: true })}–${formatCurrency(max, { compact: true })}`}
                      </TD>
                      <TD>
                        <span className={stock <= 0 ? 'font-medium text-danger-600' : undefined}>{formatNumber(stock)}</span>
                      </TD>
                      <TD>
                        <div className="flex flex-col gap-1">
                          <StatusBadge status={product.status} kind="product" />
                          {product.rejectionReason && (
                            <span className="max-w-[12rem] truncate text-xs text-danger-600" title={product.rejectionReason}>
                              {truncate(product.rejectionReason, 40)}
                            </span>
                          )}
                        </div>
                      </TD>
                      <TD>
                        <Stars rating={product.rating} size="sm" showValue reviewCount={product.reviewCount} />
                      </TD>
                      <TD>{formatNumber(product.soldCount)}</TD>
                      <TD className="text-right">
                        <Dropdown
                          label={`Actions for ${product.name}`}
                          trigger={
                            <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-ink-500 hover:bg-ink-100 hover:text-ink">
                              <MoreHorizontal className="h-4 w-4" />
                            </span>
                          }
                          items={[
                            ...(product.status === 'pending_review'
                              ? [{ label: 'Review', icon: <Check className="h-4 w-4" />, onClick: () => openReview(product) }]
                              : []),
                            { label: 'Edit', icon: <Pencil className="h-4 w-4" />, onClick: () => openEdit(product) },
                            { label: 'Set active', icon: <Check className="h-4 w-4" />, divider: true, onClick: () => setActive(product) },
                            { label: 'Archive', icon: <Archive className="h-4 w-4" />, onClick: () => archive(product) },
                            { label: 'Delete', icon: <Trash2 className="h-4 w-4" />, tone: 'danger', onClick: () => setDeleteTarget(product) },
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

      {/* Review product */}
      <Modal
        open={!!reviewProduct}
        onClose={() => setReviewProduct(null)}
        title="Review product listing"
        description={reviewProduct ? `Submitted ${formatDate(reviewProduct.createdAt, 'long')}` : undefined}
        size="xl"
        footer={
          reviewProduct ? (
            rejectMode ? (
              <>
                <Button variant="outline" onClick={() => setRejectMode(false)} disabled={busy}>
                  Back
                </Button>
                <Button variant="danger" onClick={() => reject(reviewProduct, rejectReason)} loading={busy}>
                  Confirm rejection
                </Button>
              </>
            ) : (
              <>
                <Button variant="outline" onClick={() => setRejectMode(true)} disabled={busy}>
                  <X className="h-4 w-4" />
                  Reject
                </Button>
                <Button onClick={() => approve(reviewProduct)} loading={busy}>
                  <Check className="h-4 w-4" />
                  Approve
                </Button>
              </>
            )
          ) : undefined
        }
      >
        {reviewProduct && (
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {reviewProduct.images.map((image) => (
                <SmartImage
                  key={image.id}
                  src={image.imageUrl}
                  alt={image.altText ?? reviewProduct.name}
                  wrapperClassName="aspect-square rounded-lg"
                  fallbackLabel={reviewProduct.name}
                />
              ))}
            </div>

            <div>
              <h3 className="text-base font-semibold text-ink">{reviewProduct.name}</h3>
              <p className="mt-1 text-sm text-ink-600">{reviewProduct.description ?? reviewProduct.shortDescription}</p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-lg border border-ink-200 p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-ink-500">Seller</p>
                <p className="mt-1 text-sm font-medium text-ink">{reviewProduct.sellerName ?? '—'}</p>
                <p className="mt-0.5 text-xs text-ink-500">Category: {reviewProduct.categoryName ?? '—'}</p>
                <p className="mt-0.5 text-xs text-ink-500">Brand: {reviewProduct.brand ?? '—'}</p>
              </div>
              <div className="rounded-lg border border-ink-200 p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-ink-500">Pricing</p>
                <p className="mt-1 text-sm font-medium text-ink">{formatCurrency(reviewProduct.variants[0]?.price ?? 0)}</p>
                <p className="mt-0.5 text-xs text-ink-500">Rating: {reviewProduct.rating.toFixed(1)} ({formatNumber(reviewProduct.reviewCount)} reviews)</p>
                <p className="mt-0.5 text-xs text-ink-500">Sold: {formatNumber(reviewProduct.soldCount)}</p>
              </div>
            </div>

            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-ink-500">Variants</p>
              <div className="overflow-hidden rounded-lg border border-ink-200">
                <table className="w-full text-sm">
                  <thead className="bg-ink-50/60">
                    <tr>
                      <th scope="col" className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-ink-500">Variant</th>
                      <th scope="col" className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-ink-500">SKU</th>
                      <th scope="col" className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-ink-500">Price</th>
                      <th scope="col" className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-ink-500">Stock</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-ink-100">
                    {reviewProduct.variants.map((variant) => (
                      <tr key={variant.id}>
                        <td className="px-3 py-2 text-ink">{variant.variantName}</td>
                        <td className="px-3 py-2 text-ink-500">{variant.sku}</td>
                        <td className="px-3 py-2 text-ink">{formatCurrency(variant.price)}</td>
                        <td className="px-3 py-2 text-ink">{formatNumber(variant.stock)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {reviewProduct.rejectionReason && (
              <div className="rounded-lg border border-danger-100 bg-danger-50 px-3.5 py-3 text-sm text-danger-700">
                <p className="font-medium">Previous rejection reason</p>
                <p className="mt-0.5">{reviewProduct.rejectionReason}</p>
              </div>
            )}

            {rejectMode && (
              <Textarea
                label="Reason for rejection"
                hint="Shared with the seller so they can correct the listing."
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                required
              />
            )}

            <p className="text-xs text-ink-500">
              Moderation updates the catalogue and writes an audit-log entry.
            </p>
          </div>
        )}
      </Modal>

      {/* Edit product */}
      <Modal
        open={!!editProduct}
        onClose={() => {
          setEditProduct(null)
          setEditDraft(null)
        }}
        title="Edit product"
        size="lg"
        footer={
          <>
            <Button
              variant="outline"
              onClick={() => {
                setEditProduct(null)
                setEditDraft(null)
              }}
            >
              Cancel
            </Button>
            <Button onClick={saveEdit} loading={busy}>
              Save changes
            </Button>
          </>
        }
      >
        {editDraft && (
          <div className="space-y-4">
            <Input label="Product name" value={editDraft.name} onChange={(e) => setEditDraft({ ...editDraft, name: e.target.value })} required />
            <Input label="Brand" value={editDraft.brand} onChange={(e) => setEditDraft({ ...editDraft, brand: e.target.value })} />
            <Select
              label="Category"
              value={editDraft.categoryId}
              onChange={(e) => setEditDraft({ ...editDraft, categoryId: e.target.value })}
              options={categories.map((c) => ({ label: c.name, value: String(c.id) }))}
            />
            <Input
              label="Price (TSh)"
              type="number"
              min={0}
              value={editDraft.price}
              onChange={(e) => setEditDraft({ ...editDraft, price: e.target.value })}
              required
            />
            <Select
              label="Status"
              value={editDraft.status}
              onChange={(e) => setEditDraft({ ...editDraft, status: e.target.value as ProductStatus })}
              options={[
                { label: 'Draft', value: 'draft' },
                { label: 'Pending review', value: 'pending_review' },
                { label: 'Active', value: 'active' },
                { label: 'Rejected', value: 'rejected' },
                { label: 'Archived', value: 'archived' },
              ]}
            />
            <p className="text-xs text-ink-500">Changes are applied to the catalogue.</p>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && remove(deleteTarget)}
        title={deleteTarget ? `Delete ${deleteTarget.name}?` : ''}
        description="This permanently removes the listing. It cannot be undone."
        confirmLabel="Delete"
        tone="danger"
      />

      <ConfirmDialog
        open={!!bulk}
        onClose={() => setBulk(null)}
        onConfirm={runBulk}
        title={
          bulk?.action === 'approve'
            ? 'Approve selected products?'
            : bulk?.action === 'archive'
              ? 'Archive selected products?'
              : 'Delete selected products?'
        }
        description={`This affects ${bulk?.ids.length ?? 0} listing(s).`}
        confirmLabel={bulk?.action === 'delete' ? 'Delete' : bulk?.action === 'archive' ? 'Archive' : 'Approve'}
        tone={bulk?.action === 'delete' ? 'danger' : 'default'}
        loading={busy}
      />
    </div>
  )
}
