import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertTriangle,
  Boxes,
  CheckCircle2,
  Download,
  PackageX,
  Save,
} from 'lucide-react'
import {
  Badge,
  Button,
  Card,
  EmptyState,
  PageHeader,
  Pagination,
  Select,
  StatCard,
  Table,
  TBody,
  TD,
  TH,
  THead,
  TR,
} from '@/components/ui'
import { DataToolbar } from '@/components/tables/DataToolbar'
import { useAuthStore, useCategories, useSellerProducts } from '@/context'
import { toast } from '@/context/uiStore'
import { sellerService } from '@/services'
import { formatCurrency, formatNumber } from '@/lib/utils'

const PAGE_SIZE = 10

const STOCK_LEVELS = [
  { label: 'All stock levels', value: 'all' },
  { label: 'Low stock', value: 'low' },
  { label: 'Out of stock', value: 'out' },
  { label: 'Healthy', value: 'healthy' },
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

export default function SellerInventoryPage() {
  const user = useAuthStore((s) => s.session?.user)
  const sellerId = user?.sellerId ?? null
  const products = useSellerProducts(sellerId)

  useEffect(() => {
    if (!sellerId) return
    void sellerService.fetchSellerProducts({ pageSize: 100 }).catch(() => undefined)
  }, [sellerId])
  const categories = useCategories()

  const [search, setSearch] = useState('')
  const [stockLevel, setStockLevel] = useState('all')
  const [categoryId, setCategoryId] = useState('all')
  const [page, setPage] = useState(1)
  const [edits, setEdits] = useState<Record<number, string>>({})
  const [savingId, setSavingId] = useState<number | null>(null)

  const rows = useMemo(
    () => products.flatMap((product) => product.variants.map((variant) => ({ product, variant }))),
    [products],
  )

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase()
    return rows.filter(({ product, variant }) => {
      if (categoryId !== 'all' && String(product.categoryId) !== categoryId) return false
      if (stockLevel === 'low' && !(variant.stock > 0 && variant.stock <= variant.lowStockThreshold)) return false
      if (stockLevel === 'out' && variant.stock !== 0) return false
      if (stockLevel === 'healthy' && variant.stock <= variant.lowStockThreshold) return false
      if (needle) {
        const haystack = `${product.name} ${variant.variantName} ${variant.sku}`.toLowerCase()
        if (!haystack.includes(needle)) return false
      }
      return true
    })
  }, [rows, search, stockLevel, categoryId])

  const totalSkus = rows.length
  const unitsOnHand = rows.reduce((total, { variant }) => total + variant.stock, 0)
  const lowCount = rows.filter(({ variant }) => variant.stock > 0 && variant.stock <= variant.lowStockThreshold).length
  const outCount = rows.filter(({ variant }) => variant.stock === 0).length

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const pageItems = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  const categoryOptions = useMemo(
    () => [{ label: 'All categories', value: 'all' }, ...categories.map((c) => ({ label: c.name, value: String(c.id) }))],
    [categories],
  )

  const valueFor = (variantId: number, current: number) => edits[variantId] ?? String(current)

  const saveStock = async (variantId: number, current: number, productName: string) => {
    const raw = edits[variantId] ?? String(current)
    const next = Number(raw)
    if (Number.isNaN(next) || next < 0) {
      toast.error('Invalid stock value', 'Enter a whole number of zero or more.')
      return
    }
    setSavingId(variantId)
    await sellerService.setStock(variantId, next)
    setSavingId(null)
    setEdits((prev) => {
      const copy = { ...prev }
      delete copy[variantId]
      return copy
    })
    toast.success('Stock saved', `${productName} — ${next} units on hand.`)
  }

  const adjust = async (variantId: number, delta: number, productName: string) => {
    await sellerService.adjustStock(variantId, delta, productName)
    toast.success(delta > 0 ? 'Stock increased' : 'Stock decreased', `${productName} — ${delta > 0 ? '+' : ''}${delta}.`)
  }

  const exportCsv = () => {
    const csvRows: Array<Array<string | number>> = [
      ['Product', 'Variant', 'SKU', 'Price', 'On hand', 'Threshold', 'Status'],
      ...filtered.map(({ product, variant }) => [
        product.name,
        variant.variantName,
        variant.sku,
        variant.price,
        variant.stock,
        variant.lowStockThreshold,
        variant.stock === 0 ? 'Out of stock' : variant.stock <= variant.lowStockThreshold ? 'Low' : 'In stock',
      ]),
    ]
    downloadCsv(`shopio-inventory-${Date.now()}.csv`, csvRows)
    toast.success('Export ready', `${filtered.length} rows exported to CSV.`)
  }

  const stockBadge = (stock: number, threshold: number) => {
    if (stock === 0) return <Badge tone="danger">Out of stock</Badge>
    if (stock <= threshold) return <Badge tone="warning">Low</Badge>
    return <Badge tone="success">In stock</Badge>
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Inventory"
        description="Track stock across every variant and top up before you run out."
        actions={
          <Button variant="outline" onClick={exportCsv}>
            <Download className="h-4 w-4" aria-hidden="true" />
            Export CSV
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total SKUs" value={formatNumber(totalSkus)} icon={<Boxes className="h-4 w-4" aria-hidden="true" />} />
        <StatCard label="Units on hand" value={formatNumber(unitsOnHand)} icon={<CheckCircle2 className="h-4 w-4" aria-hidden="true" />} />
        <StatCard label="Low stock" value={formatNumber(lowCount)} icon={<AlertTriangle className="h-4 w-4" aria-hidden="true" />} />
        <StatCard label="Out of stock" value={formatNumber(outCount)} icon={<PackageX className="h-4 w-4" aria-hidden="true" />} />
      </div>

      <Card>
        <DataToolbar
          searchValue={search}
          onSearchChange={(value) => {
            setSearch(value)
            setPage(1)
          }}
          searchPlaceholder="Search by product, variant or SKU"
        >
          <Select
            aria-label="Filter by stock level"
            value={stockLevel}
            options={STOCK_LEVELS}
            onChange={(event) => {
              setStockLevel(event.target.value)
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
        </DataToolbar>

        {pageItems.length === 0 ? (
          <div className="p-5">
            <EmptyState
              icon={<Boxes className="h-5 w-5" />}
              title={rows.length === 0 ? 'No inventory yet' : 'No variants match your filters'}
              description={
                rows.length === 0
                  ? 'Add a product to start tracking stock.'
                  : 'Try a different search term or stock level.'
              }
              action={rows.length === 0 ? { label: 'Add product', to: '/seller/products/new' } : undefined}
            />
          </div>
        ) : (
          <>
            <Table>
              <THead>
                <TR>
                  <TH>Product</TH>
                  <TH>Variant</TH>
                  <TH>SKU</TH>
                  <TH>Price</TH>
                  <TH>On hand</TH>
                  <TH>Threshold</TH>
                  <TH>Status</TH>
                  <TH className="text-right">Update stock</TH>
                </TR>
              </THead>
              <TBody>
                {pageItems.map(({ product, variant }) => {
                  const dirty = edits[variant.id] != null && edits[variant.id] !== String(variant.stock)
                  return (
                    <TR key={variant.id}>
                      <TD className="max-w-[14rem]">
                        <div className="flex items-center gap-3">
                          <span className="flex h-9 w-9 shrink-0 overflow-hidden rounded-lg bg-ink-100">
                            {product.images[0]?.imageUrl ? (
                              <img src={product.images[0].imageUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
                            ) : null}
                          </span>
                          <Link to={`/seller/products/${product.id}/edit`} className="truncate font-medium text-ink hover:underline">
                            {product.name}
                          </Link>
                        </div>
                      </TD>
                      <TD>{variant.variantName}</TD>
                      <TD className="whitespace-nowrap text-ink-500">{variant.sku}</TD>
                      <TD className="whitespace-nowrap">{formatCurrency(variant.price)}</TD>
                      <TD className="font-medium text-ink">{formatNumber(variant.stock)}</TD>
                      <TD className="text-ink-500">{formatNumber(variant.lowStockThreshold)}</TD>
                      <TD>{stockBadge(variant.stock, variant.lowStockThreshold)}</TD>
                      <TD>
                        <div className="flex items-center justify-end gap-2">
                          <input
                            type="number"
                            min={0}
                            inputMode="numeric"
                            aria-label={`Stock for ${product.name} ${variant.variantName}`}
                            value={valueFor(variant.id, variant.stock)}
                            onChange={(event) =>
                              setEdits((prev) => ({ ...prev, [variant.id]: event.target.value }))
                            }
                            className="h-9 w-20 rounded-lg border border-ink-200 px-2 text-sm text-ink focus:border-ink focus:outline-none focus:ring-2 focus:ring-ink/60"
                          />
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={!dirty}
                            loading={savingId === variant.id}
                            onClick={() => saveStock(variant.id, variant.stock, product.name)}
                          >
                            <Save className="h-3.5 w-3.5" aria-hidden="true" />
                            Save
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => adjust(variant.id, 10, product.name)}>
                            +10
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => adjust(variant.id, -1, product.name)}>
                            −1
                          </Button>
                        </div>
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
    </div>
  )
}
