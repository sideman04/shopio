import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Search, Sparkles } from 'lucide-react'
import type { Product, SortKey } from '@/types'
import { ProductGrid } from '@/components/products/ProductGrid'
import { SortDropdown } from '@/components/products/SortDropdown'
import { Breadcrumbs } from '@/components/ui/Breadcrumbs'
import { Pagination } from '@/components/ui/Pagination'
import { EmptyState } from '@/components/ui/EmptyState'
import { useCategories } from '@/context/catalogStore'
import { useBrowseStore } from '@/context/uiStore'
import { productService } from '@/services'
import { formatNumber } from '@/lib/utils'

const PAGE_SIZE = 12

/** Search results page — driven entirely by the `q` query parameter. */
export default function SearchPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const q = searchParams.get('q')?.trim() ?? ''
  const sort = (searchParams.get('sort') as SortKey) ?? 'popularity'
  const page = Number(searchParams.get('page') ?? 1)

  const categories = useCategories()
  const recentSearches = useBrowseStore((s) => s.recentSearches)
  const clearSearches = useBrowseStore((s) => s.clearSearches)

  const [items, setItems] = useState<Product[]>([])
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    productService
      .queryProducts({ q: q || undefined, sort, page, pageSize: PAGE_SIZE })
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
  }, [q, sort, page])

  const setParam = (patch: Record<string, string | null>) =>
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      Object.entries(patch).forEach(([k, v]) => (v == null ? next.delete(k) : next.set(k, v)))
      return next
    })

  return (
    <div>
      <div className="border-b border-ink-200 bg-sand-50">
        <div className="container-page py-8 sm:py-10">
          <Breadcrumbs items={[{ label: 'Search' }]} />
          <h1 className="mt-4 text-2xl font-bold tracking-tight sm:text-3xl">
            {q ? `Search results for “${q}”` : 'Search Shopio'}
          </h1>
          <p className="mt-2 text-sm text-ink-600">
            {loading ? 'Searching…' : `${formatNumber(total)} matching product${total === 1 ? '' : 's'}`}
          </p>
        </div>
      </div>

      <div className="container-page py-8">
        {!q && (
          <div className="mb-8 space-y-6">
            {recentSearches.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium text-ink-500">Recent:</span>
                {recentSearches.map((term) => (
                  <Link
                    key={term}
                    to={`/search?q=${encodeURIComponent(term)}`}
                    className="rounded-full border border-ink-200 px-3 py-1 text-sm text-ink-600 transition hover:border-ink-400"
                  >
                    {term}
                  </Link>
                ))}
                <button
                  type="button"
                  onClick={clearSearches}
                  className="text-xs font-medium text-ink-400 underline-offset-2 hover:text-ink hover:underline"
                >
                  Clear
                </button>
              </div>
            )}

            <div>
              <p className="mb-3 inline-flex items-center gap-2 text-sm font-semibold text-ink">
                <Sparkles className="h-4 w-4 text-gold-500" aria-hidden="true" />
                Popular categories
              </p>
              <div className="flex flex-wrap gap-2">
                {categories.map((category) => (
                  <Link
                    key={category.id}
                    to={`/categories/${category.slug}`}
                    className="rounded-lg border border-ink-200 px-3.5 py-2 text-sm text-ink-700 transition hover:border-ink-400 hover:bg-ink-50"
                  >
                    {category.name}
                  </Link>
                ))}
              </div>
            </div>
          </div>
        )}

        {q && (
          <div className="mb-6 flex items-center justify-end">
            <SortDropdown value={sort} onChange={(value) => setParam({ sort: value, page: null })} hideLabel />
          </div>
        )}

        {q ? (
          <>
            <ProductGrid
              products={items}
              loading={loading}
              emptyTitle={`No results for “${q}”`}
              emptyDescription="Check your spelling, try a broader term, or browse a category instead."
              emptyAction={{ label: 'Browse all products', to: '/shop' }}
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
          </>
        ) : (
          <EmptyState
            icon={<Search className="h-5 w-5" />}
            title="Start typing to search"
            description="Search across every product, brand and seller on the marketplace."
            action={{ label: 'Shop all products', to: '/shop' }}
          />
        )}
      </div>
    </div>
  )
}
