import { useEffect, useMemo, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { SlidersHorizontal } from 'lucide-react'
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
import { EmptyState } from '@/components/ui/EmptyState'
import { SmartImage } from '@/components/ui/SmartImage'
import { PackageSearch } from 'lucide-react'
import { PromoBanner } from '@/components/storefront/PromoBanner'
import { useCatalogStore, useCategories } from '@/context/catalogStore'
import { isBannerLive } from '@/lib/banners'
import { productService } from '@/services'

const PAGE_SIZE = 12

function countActive(filters: ProductFilters) {
  return (
    filters.colors.length +
    filters.brands.length +
    (filters.minRating ?? 0) +
    (filters.minPrice > 0 ? 1 : 0) +
    (filters.maxPrice > 0 ? 1 : 0) +
    (filters.inStockOnly ? 1 : 0)
  )
}

/** Category listing: scoped filters, sorting and pagination for one category. */
export default function CategoryDetailPage() {
  const { slug = '' } = useParams()
  const categories = useCategories()
  const banners = useCatalogStore((s) => s.banners)
  const category = categories.find((c) => c.slug === slug)
  const promo = banners.find((b) => b.placement === 'category' && isBannerLive(b))

  const [searchParams, setSearchParams] = useSearchParams()
  const sort = (searchParams.get('sort') as SortKey) ?? 'popularity'
  const page = Number(searchParams.get('page') ?? 1)

  const [filters, setFilters] = useState<ProductFilters>(EMPTY_FILTERS)
  const [items, setItems] = useState<Product[]>([])
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(true)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [draft, setDraft] = useState<ProductFilters>(EMPTY_FILTERS)

  const facets: FilterFacets = useMemo(() => productService.getFilterFacets(), [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    productService
      .queryProducts({
        categories: slug ? [slug] : undefined,
        sort,
        page,
        pageSize: PAGE_SIZE,
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
  }, [slug, sort, page, filters])

  if (!category) {
    return (
      <div className="container-page py-20">
        <EmptyState
          icon={<PackageSearch className="h-5 w-5" />}
          title="Category not found"
          description="We could not find that category. It may have been renamed or removed."
          action={{ label: 'Browse all categories', to: '/categories' }}
          secondaryAction={{ label: 'Shop everything', to: '/shop' }}
        />
      </div>
    )
  }

  const count = countActive(filters)
  const setParam = (patch: Record<string, string | null>) =>
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      Object.entries(patch).forEach(([k, v]) => (v == null ? next.delete(k) : next.set(k, v)))
      return next
    })

  return (
    <div>
      {/* Category banner */}
      <div className="border-b border-ink-200 bg-sand-50">
        <div className="container-page py-8 sm:py-10">
          <Breadcrumbs items={[{ label: 'Categories', to: '/categories' }, { label: category.name }]} />
          <div className="mt-5 grid items-center gap-6 sm:grid-cols-[1fr_auto]">
            <div>
              <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{category.name}</h1>
              {category.description && (
                <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-600">{category.description}</p>
              )}
              <p className="mt-3 text-sm text-ink-500">
                {loading ? 'Loading products…' : `${total} product${total === 1 ? '' : 's'}`}
              </p>
            </div>
            {category.imageUrl && (
              <SmartImage
                src={category.imageUrl}
                alt={category.name}
                wrapperClassName="hidden h-28 w-44 rounded-card sm:block"
                fallbackLabel={category.name}
              />
            )}
          </div>
        </div>
      </div>

      {promo && (
        <PromoBanner
          eyebrow="Featured"
          title={promo.title}
          subtitle={promo.subtitle ?? undefined}
          buttonLabel={promo.buttonText ?? 'Shop Now'}
          buttonHref={promo.targetUrl ?? '/shop'}
          imageUrl={promo.imageUrl ?? undefined}
          className="border-b border-ink-200"
        />
      )}

      <div className="container-page py-8">
        <div className="grid gap-8 lg:grid-cols-[260px_1fr]">
          <aside className="hidden lg:block" aria-label="Product filters">
            <div className="sticky top-24">
              <FilterSidebar
                filters={filters}
                facets={facets}
                categories={categories}
                onChange={(next) => {
                  setFilters(next)
                  setParam({ page: null })
                }}
                onClear={() => setFilters(EMPTY_FILTERS)}
                showCategories={false}
                activeCount={count}
              />
            </div>
          </aside>

          <div>
            <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
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
              <div className="ml-auto">
                <SortDropdown value={sort} onChange={(value) => setParam({ sort: value, page: null })} hideLabel />
              </div>
            </div>

            <ProductGrid
              products={items}
              loading={loading}
              emptyTitle={`No ${category.name.toLowerCase()} match your filters`}
              emptyDescription="Try widening your price range or clearing a filter."
              emptyAction={{ label: 'Clear filters', onClick: () => setFilters(EMPTY_FILTERS) }}
            />

            {!loading && totalPages > 1 && (
              <Pagination
                className="mt-10"
                page={page}
                totalPages={totalPages}
                totalItems={total}
                pageSize={PAGE_SIZE}
                onPageChange={(next) => {
                  setParam({ page: String(next) })
                  window.scrollTo({ top: 0, behavior: 'smooth' })
                }}
              />
            )}

            <p className="mt-10 text-sm text-ink-500">
              Looking for something else?{' '}
              <Link to="/shop" className="font-medium text-ink underline-offset-2 hover:underline">
                Browse the full catalogue
              </Link>
              .
            </p>
          </div>
        </div>
      </div>

      <Drawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title={`Filter ${category.name}`}
        side="bottom"
        footer={
          <FilterDrawerFooter
            activeCount={countActive(draft)}
            onClear={() => setDraft(EMPTY_FILTERS)}
            onApply={() => {
              setFilters(draft)
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
          showCategories={false}
          activeCount={countActive(draft)}
        />
      </Drawer>
    </div>
  )
}
