import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { SlidersHorizontal, X } from 'lucide-react'
import type { Product, SortKey } from '@/types'
import { ProductGrid } from '@/components/products/ProductGrid'
import {
  EMPTY_FILTERS,
  FilterDrawerFooter,
  FilterSidebar,
  type FilterFacets,
  type ProductFilters,
} from '@/components/products/FilterSidebar'
import { SortDropdown } from '@/components/products/SortDropdown'
import { Breadcrumbs } from '@/components/ui/Breadcrumbs'
import { Button } from '@/components/ui/Button'
import { Drawer } from '@/components/ui/Drawer'
import { Pagination } from '@/components/ui/Pagination'
import { Badge } from '@/components/ui/Badge'
import { useCategories } from '@/context/catalogStore'
import { productService } from '@/services'

const PAGE_SIZE = 12

function activeFilterCount(filters: ProductFilters) {
  return (
    filters.categories.length +
    filters.colors.length +
    filters.brands.length +
    (filters.minRating ?? 0) +
    (filters.minPrice > 0 ? 1 : 0) +
    (filters.maxPrice > 0 ? 1 : 0) +
    (filters.inStockOnly ? 1 : 0)
  )
}

/** Build a fresh query string from a filter object plus the current sort/page. */
function buildParams(filters: ProductFilters, sort: SortKey, q: string, page: number) {
  const next = new URLSearchParams()
  if (q) next.set('q', q)
  if (sort !== 'popularity') next.set('sort', sort)
  filters.categories.forEach((c) => next.append('category', c))
  filters.colors.forEach((c) => next.append('color', c))
  filters.brands.forEach((b) => next.append('brand', b))
  if (filters.minRating) next.set('rating', String(filters.minRating))
  if (filters.minPrice > 0) next.set('minPrice', String(filters.minPrice))
  if (filters.maxPrice > 0) next.set('maxPrice', String(filters.maxPrice))
  if (filters.inStockOnly) next.set('inStock', '1')
  if (page > 1) next.set('page', String(page))
  return next
}

/**
 * Full catalogue page. The URL query string is the single source of truth for
 * filters, sorting and pagination, so any view can be shared or bookmarked —
 * exactly as the future `/api/products` endpoint will support.
 */
export default function ShopPage() {
  const categories = useCategories()
  const [searchParams, setSearchParams] = useSearchParams()

  const q = searchParams.get('q') ?? ''
  const sort = (searchParams.get('sort') as SortKey) ?? 'popularity'
  const page = Number(searchParams.get('page') ?? 1)
  const searchKey = searchParams.toString()

  // Derive filters from the URL rather than keeping a parallel state object.
  const filters: ProductFilters = useMemo(
    () => ({
      ...EMPTY_FILTERS,
      categories: searchParams.getAll('category'),
      colors: searchParams.getAll('color'),
      brands: searchParams.getAll('brand'),
      minRating: searchParams.get('rating') ? Number(searchParams.get('rating')) : null,
      minPrice: Number(searchParams.get('minPrice') ?? 0),
      maxPrice: Number(searchParams.get('maxPrice') ?? 0),
      inStockOnly: searchParams.get('inStock') === '1',
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [searchKey],
  )

  const [items, setItems] = useState<Product[]>([])
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(true)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [draft, setDraft] = useState<ProductFilters>(filters)

  const facets: FilterFacets = useMemo(() => productService.getFilterFacets(), [])

  const applyFilters = (next: ProductFilters) => {
    setSearchParams(buildParams(next, sort, q, 1))
  }

  const setSort = (value: SortKey) => setSearchParams(buildParams(filters, value, q, 1))
  const setPage = (value: number) => setSearchParams(buildParams(filters, sort, q, value))

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    productService
      .queryProducts({
        q: q || undefined,
        sort,
        page,
        pageSize: PAGE_SIZE,
        categories: filters.categories,
        colors: filters.colors,
        brands: filters.brands,
        minPrice: filters.minPrice || undefined,
        maxPrice: filters.maxPrice || undefined,
        minRating: filters.minRating ?? undefined,
        inStockOnly: filters.inStockOnly,
      })
      .then((result) => {
        if (cancelled) return
        setItems(result.items)
        setTotal(result.total)
        setTotalPages(result.totalPages)
      })
      .catch(() => {
        if (cancelled) return
        setItems([])
        setTotal(0)
        setTotalPages(1)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchKey])

  const count = activeFilterCount(filters)

  return (
    <div>
      {/* Header band */}
      <div className="border-b border-ink-200 bg-sand-50">
        <div className="container-page py-6 sm:py-8">
          <Breadcrumbs items={[{ label: 'Shop' }]} />
          <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
                {q ? `Results for “${q}”` : 'All products'}
              </h1>
              <p className="mt-2 text-sm text-ink-600">
                {loading ? 'Loading products…' : `${total} product${total === 1 ? '' : 's'} available`}
              </p>
            </div>
            <SortDropdown value={sort} onChange={setSort} hideLabel />
          </div>
        </div>
      </div>

      <div className="container-page py-8">
        <div className="grid gap-8 lg:grid-cols-[260px_1fr]">
          {/* Desktop filters */}
          <aside className="hidden lg:block" aria-label="Product filters">
            <div className="sticky top-24">
              <FilterSidebar
                filters={filters}
                facets={facets}
                categories={categories}
                onChange={applyFilters}
                onClear={() => applyFilters(EMPTY_FILTERS)}
                activeCount={count}
              />
            </div>
          </aside>

          <div>
            {/* Mobile filter trigger + active chips */}
            <div className="mb-6 flex flex-wrap items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setDraft(filters)
                  setDrawerOpen(true)
                }}
                className="lg:hidden"
              >
                <SlidersHorizontal className="h-4 w-4" />
                Filters
                {count > 0 && <Badge tone="dark" size="sm">{count}</Badge>}
              </Button>
              {filters.categories.map((slug) => (
                <button
                  key={slug}
                  type="button"
                  onClick={() => applyFilters({ ...filters, categories: filters.categories.filter((c) => c !== slug) })}
                  className="inline-flex items-center gap-1.5 rounded-full border border-ink-200 px-3 py-1 text-xs font-medium text-ink-600 transition hover:border-ink-400"
                >
                  {categories.find((c) => c.slug === slug)?.name ?? slug}
                  <X className="h-3 w-3" />
                </button>
              ))}
              {count > 0 && (
                <button
                  type="button"
                  onClick={() => applyFilters(EMPTY_FILTERS)}
                  className="text-xs font-medium text-ink-500 underline-offset-2 hover:text-ink hover:underline"
                >
                  Clear all filters
                </button>
              )}
            </div>

            <ProductGrid
              products={items}
              loading={loading}
              emptyTitle="No products match your filters"
              emptyDescription="Try removing a filter or broadening your price range."
              emptyAction={{ label: 'Clear all filters', onClick: () => applyFilters(EMPTY_FILTERS) }}
            />

            {!loading && totalPages > 1 && (
              <Pagination
                className="mt-10"
                page={page}
                totalPages={totalPages}
                totalItems={total}
                pageSize={PAGE_SIZE}
                onPageChange={(next) => {
                  setPage(next)
                  window.scrollTo({ top: 0, behavior: 'smooth' })
                }}
              />
            )}
          </div>
        </div>
      </div>

      {/* Mobile filter drawer */}
      <Drawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title="Filters"
        side="bottom"
        footer={
          <FilterDrawerFooter
            activeCount={activeFilterCount(draft)}
            onClear={() => setDraft(EMPTY_FILTERS)}
            onApply={() => {
              applyFilters(draft)
              setDrawerOpen(false)
            }}
          />
        }
      >
        <FilterSidebar
          filters={draft}
          facets={facets}
          categories={categories}
          onChange={setDraft}
          onClear={() => setDraft(EMPTY_FILTERS)}
          activeCount={activeFilterCount(draft)}
        />
      </Drawer>
    </div>
  )
}
