import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Archive,
  Copy,
  Download,
  MoreHorizontal,
  Pencil,
  Plus,
  ShoppingBag,
  Trash2,
  Upload,
} from 'lucide-react'
import {
  Alert,
  Badge,
  Button,
  Card,
  Checkbox,
  ConfirmDialog,
  Dropdown,
  EmptyState,
  PageHeader,
  Pagination,
  Select,
  StatusBadge,
  Table,
  TBody,
  TD,
  TH,
  THead,
  TR,
} from '@/components/ui'
import { DataToolbar } from '@/components/tables/DataToolbar'
import { SORT_OPTIONS } from '@/components/products/SortDropdown'
import { useAuthStore, useCategories, useSellerProducts, type ProductFormValues } from '@/context'
import { toast } from '@/context/uiStore'
import { sellerService } from '@/services'
import type { Product, ProductStatus, SortKey } from '@/types'
import { cn, formatCurrency, formatNumber } from '@/lib/utils'

const PAGE_SIZE = 8

function totalStock(product: Product) {
  return product.variants.reduce((sum, variant) => sum + variant.stock, 0)
}

function priceRange(product: Product) {
  const prices = product.variants.map((variant) => variant.price).filter((price) => price > 0)
  return {
    min: prices.length ? Math.min(...prices) : (product.minPrice ?? 0),
    max: prices.length ? Math.max(...prices) : (product.maxPrice ?? 0),
  }
}

const STATUS_OPTIONS = [
  { label: 'All statuses', value: 'all' },
  { label: 'Draft', value: 'draft' },
  { label: 'Pending review', value: 'pending_review' },
  { label: 'Active', value: 'active' },
  { label: 'Rejected', value: 'rejected' },
  { label: 'Archived', value: 'archived' },
]

function downloadCsv(filename: string, rows: Array<Array<string | number>>) {
  const csv = rows
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

export default function SellerProductsPage() {
  const user = useAuthStore((s) => s.session?.user)
  const sellerId = user?.sellerId ?? 1
  const products = useSellerProducts(sellerId)
  const categories = useCategories()

  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('all')
  const [categoryId, setCategoryId] = useState('all')
  const [sort, setSort] = useState<SortKey>('newest')
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<number[]>([])
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null)
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false)
  const [working, setWorking] = useState(false)

  useEffect(() => {
    if (!sellerId) return
    void sellerService
      .fetchSellerProducts({ pageSize: 100 })
      .catch((error) => toast.error('Could not load products', error instanceof Error ? error.message : 'Please try again.'))
  }, [sellerId])

  const categoryOptions = useMemo(
    () => [{ label: 'All categories', value: 'all' }, ...categories.map((c) => ({ label: c.name, value: String(c.id) }))],
    [categories],
  )

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase()
    const list = products.filter((product) => {
      if (status !== 'all' && product.status !== status) return false
      if (categoryId !== 'all' && String(product.categoryId) !== categoryId) return false
      if (needle) {
        const haystack = [product.name, product.brand ?? '', ...product.variants.map((v) => v.sku)]
          .join(' ')
          .toLowerCase()
        if (!haystack.includes(needle)) return false
      }
      return true
    })

    return list.sort((a, b) => {
      switch (sort) {
        case 'price-asc':
          return priceRange(a).min - priceRange(b).min
        case 'price-desc':
          return priceRange(b).min - priceRange(a).min
        case 'rating':
          return b.rating - a.rating
        case 'name-asc':
          return a.name.localeCompare(b.name)
        case 'popularity':
          return b.soldCount - a.soldCount
        case 'newest':
        default:
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      }
    })
  }, [products, search, status, categoryId, sort])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const pageItems = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  const allOnPageSelected = pageItems.length > 0 && pageItems.every((p) => selected.includes(p.id))

  const toggleAllOnPage = () => {
    if (allOnPageSelected) {
      setSelected((prev) => prev.filter((id) => !pageItems.some((p) => p.id === id)))
    } else {
      setSelected((prev) => Array.from(new Set([...prev, ...pageItems.map((p) => p.id)])))
    }
  }

  const toggleOne = (id: number) => {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  const exportCsv = () => {
    const rows: Array<Array<string | number>> = [
      ['Name', 'SKU', 'Brand', 'Category', 'Price', 'Stock', 'Status', 'Sold'],
      ...filtered.map((product) => [
        product.name,
        product.variants[0]?.sku ?? '',
        product.brand ?? '',
        product.categoryName ?? '',
        priceRange(product).min,
        totalStock(product),
        product.status,
        product.soldCount,
      ]),
    ]
    downloadCsv(`shopio-products-${Date.now()}.csv`, rows)
    toast.success('Export ready', `${filtered.length} products exported to CSV.`)
  }

  const duplicate = async (product: Product) => {
    const values: ProductFormValues = {
      name: `${product.name} (copy)`,
      categoryId: product.categoryId ?? categories[0]?.id ?? 1,
      shortDescription: product.shortDescription ?? '',
      description: product.description ?? '',
      brand: product.brand ?? '',
      conditionType: product.conditionType,
      status: 'draft',
      images: product.images.map((image) => image.imageUrl),
      price: product.variants[0]?.price ?? 0,
      compareAtPrice: product.variants[0]?.compareAtPrice ?? null,
      sku: `${product.variants[0]?.sku ?? 'SKU'}-COPY`,
      stock: totalStock(product),
      lowStockThreshold: product.variants[0]?.lowStockThreshold ?? 5,
      options: product.optionTypes,
      sellerId,
    }
    try {
      await sellerService.createSellerProduct(values)
      toast.success('Product duplicated', `“${product.name} (copy)” was created as a draft.`)
    } catch (error) {
      toast.error('Could not duplicate', error instanceof Error ? error.message : 'Please try again.')
    }
  }

  const setProductStatus = async (product: Product, next: ProductStatus) => {
    try {
      await sellerService.setProductStatus(product.id, next)
      toast.success('Status updated', `${product.name} is now ${next.replace('_', ' ')}.`)
    } catch (error) {
      toast.error('Status not updated', error instanceof Error ? error.message : 'Please try again.')
    }
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return
    setWorking(true)
    try {
      await sellerService.deleteSellerProduct(deleteTarget.id)
      toast.success('Product deleted', deleteTarget.name)
      setSelected((prev) => prev.filter((id) => id !== deleteTarget.id))
      setDeleteTarget(null)
    } catch (error) {
      toast.error('Product not deleted', error instanceof Error ? error.message : 'Please try again.')
    } finally {
      setWorking(false)
    }
  }

  const applyBulk = async (next: ProductStatus) => {
    setWorking(true)
    try {
      await Promise.all(selected.map((id) => sellerService.setProductStatus(id, next)))
      toast.success(
        'Bulk update complete',
        `${selected.length} products set to ${next.replace('_', ' ')}.`,
      )
      setSelected([])
    } catch (error) {
      toast.error('Bulk update failed', error instanceof Error ? error.message : 'Please try again.')
    } finally {
      setWorking(false)
    }
  }

  const confirmBulkDelete = async () => {
    setWorking(true)
    await Promise.all(selected.map((id) => sellerService.deleteSellerProduct(id)))
    setWorking(false)
    toast.success('Products deleted', `${selected.length} products removed.`)
    setSelected([])
    setBulkDeleteOpen(false)
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Products"
        description="Manage your catalogue, pricing and publishing status."
        actions={
          <>
            <Button variant="outline" onClick={exportCsv}>
              <Download className="h-4 w-4" aria-hidden="true" />
              Export CSV
            </Button>
            <Button to="/seller/products/new">
              <Plus className="h-4 w-4" aria-hidden="true" />
              Add product
            </Button>
          </>
        }
      />

      {selected.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-card border border-ink-200 bg-sand-50 px-4 py-3">
          <span className="text-sm font-medium text-ink">{selected.length} selected</span>
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => applyBulk('active')}>
              <Upload className="h-3.5 w-3.5" aria-hidden="true" />
              Publish
            </Button>
            <Button size="sm" variant="outline" onClick={() => applyBulk('archived')}>
              <Archive className="h-3.5 w-3.5" aria-hidden="true" />
              Archive
            </Button>
            <Button size="sm" variant="danger" onClick={() => setBulkDeleteOpen(true)}>
              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
              Delete
            </Button>
          </div>
          <Button size="sm" variant="ghost" className="ml-auto" onClick={() => setSelected([])}>
            Clear
          </Button>
        </div>
      )}

      <Card>
        <DataToolbar
          searchValue={search}
          onSearchChange={(value) => {
            setSearch(value)
            setPage(1)
          }}
          searchPlaceholder="Search by name or SKU"
        >
          <Select
            aria-label="Filter by status"
            value={status}
            options={STATUS_OPTIONS}
            onChange={(event) => {
              setStatus(event.target.value)
              setPage(1)
            }}
          />
          <Select
            aria-label="Filter by category"
            value={categoryId}
            options={categoryOptions}
            onChange={(event) => {
              setCategoryId(event.target.value)
              setPage(1)
            }}
          />
          <Select
            aria-label="Sort products"
            value={sort}
            options={SORT_OPTIONS}
            onChange={(event) => setSort(event.target.value as SortKey)}
          />
        </DataToolbar>

        {pageItems.length === 0 ? (
          <div className="p-5">
            <EmptyState
              icon={<ShoppingBag className="h-5 w-5" />}
              title={products.length === 0 ? 'No products yet' : 'No products match your filters'}
              description={
                products.length === 0
                  ? 'Add your first product to start selling on Shopio.'
                  : 'Try adjusting your search or filters.'
              }
              action={products.length === 0 ? { label: 'Add product', to: '/seller/products/new' } : undefined}
            />
          </div>
        ) : (
          <>
            <Table>
              <THead>
                <TR>
                  <TH className="w-10">
                    <Checkbox
                      aria-label="Select all products on this page"
                      checked={allOnPageSelected}
                      onChange={toggleAllOnPage}
                    />
                  </TH>
                  <TH>Product</TH>
                  <TH>Category</TH>
                  <TH>Price</TH>
                  <TH>Stock</TH>
                  <TH>Status</TH>
                  <TH>Sales</TH>
                  <TH className="text-right">Actions</TH>
                </TR>
              </THead>
              <TBody>
                {pageItems.map((product) => {
                  const range = priceRange(product)
                  const stock = totalStock(product)
                  const low = product.variants.some((v) => v.stock <= v.lowStockThreshold)
                  const priceLabel =
                    range.min === range.max
                      ? formatCurrency(range.min)
                      : `${formatCurrency(range.min)} – ${formatCurrency(range.max)}`
                  return (
                    <TR key={product.id}>
                      <TD>
                        <Checkbox
                          aria-label={`Select ${product.name}`}
                          checked={selected.includes(product.id)}
                          onChange={() => toggleOne(product.id)}
                        />
                      </TD>
                      <TD className="max-w-[16rem]">
                        <div className="flex items-center gap-3">
                          <span className="flex h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-ink-100">
                            {product.images[0]?.imageUrl ? (
                              <img
                                src={product.images[0].imageUrl}
                                alt=""
                                className="h-full w-full object-cover"
                                loading="lazy"
                              />
                            ) : null}
                          </span>
                          <div className="min-w-0">
                            <Link
                              to={`/seller/products/${product.id}/edit`}
                              className="block truncate font-medium text-ink hover:underline"
                            >
                              {product.name}
                            </Link>
                            <p className="truncate text-xs text-ink-500">
                              {product.brand ?? 'No brand'} · {product.variants[0]?.sku ?? '—'}
                            </p>
                          </div>
                        </div>
                        {product.status === 'rejected' && (
                          <Alert tone="danger" className="mt-2 py-2">
                            {product.rejectionReason ?? 'This product was rejected. Edit and resubmit for review.'}
                          </Alert>
                        )}
                      </TD>
                      <TD>{product.categoryName ?? '—'}</TD>
                      <TD className="whitespace-nowrap">{priceLabel}</TD>
                      <TD>
                        <span className={cn('font-medium', low ? 'text-danger-600' : 'text-ink-700')}>
                          {formatNumber(stock)}
                        </span>
                        {low && (
                          <Badge tone="warning" size="sm" className="ml-2">
                            Low
                          </Badge>
                        )}
                      </TD>
                      <TD>
                        <StatusBadge status={product.status} kind="product" />
                      </TD>
                      <TD>{formatNumber(product.soldCount)}</TD>
                      <TD className="text-right">
                        <Dropdown
                          align="right"
                          label={`Actions for ${product.name}`}
                          trigger={
                            <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-ink-500 transition hover:bg-ink-100 hover:text-ink">
                              <MoreHorizontal className="h-4 w-4" />
                            </span>
                          }
                          items={[
                            { label: 'Edit', to: `/seller/products/${product.id}/edit`, icon: <Pencil className="h-4 w-4" /> },
                            { label: 'Duplicate', onClick: () => duplicate(product), icon: <Copy className="h-4 w-4" /> },
                            product.status === 'active'
                              ? { label: 'Set to draft', onClick: () => setProductStatus(product, 'draft'), icon: <Pencil className="h-4 w-4" /> }
                              : { label: 'Publish', onClick: () => setProductStatus(product, 'active'), icon: <Upload className="h-4 w-4" /> },
                            { label: 'Archive', onClick: () => setProductStatus(product, 'archived'), icon: <Archive className="h-4 w-4" /> },
                            {
                              label: 'Delete',
                              tone: 'danger' as const,
                              divider: true,
                              icon: <Trash2 className="h-4 w-4" />,
                              onClick: () => setDeleteTarget(product),
                            },
                          ]}
                        />
                      </TD>
                    </TR>
                  )
                })}
              </TBody>
            </Table>

            <div className="border-t border-ink-200 p-4">
              <Pagination
                page={safePage}
                totalPages={totalPages}
                onPageChange={setPage}
                totalItems={filtered.length}
                pageSize={PAGE_SIZE}
              />
            </div>
          </>
        )}
      </Card>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        title="Delete product"
        description={deleteTarget ? `“${deleteTarget.name}” will be removed from your catalogue. This cannot be undone.` : undefined}
        confirmLabel="Delete product"
        tone="danger"
        loading={working}
      />

      <ConfirmDialog
        open={bulkDeleteOpen}
        onClose={() => setBulkDeleteOpen(false)}
        onConfirm={confirmBulkDelete}
        title={`Delete ${selected.length} products`}
        description="The selected products will be removed from your catalogue. This cannot be undone."
        confirmLabel="Delete products"
        tone="danger"
        loading={working}
      />
    </div>
  )
}
