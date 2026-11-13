import { useEffect, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { Store } from 'lucide-react'
import type { Product, Seller } from '@/types'
import { ProductGrid } from '@/components/products/ProductGrid'
import { Breadcrumbs } from '@/components/ui/Breadcrumbs'
import { EmptyState } from '@/components/ui/EmptyState'
import { Pagination } from '@/components/ui/Pagination'
import { Alert } from '@/components/ui/Alert'
import { Avatar } from '@/components/ui/Avatar'
import { SmartImage } from '@/components/ui/SmartImage'
import { catalogService, productService } from '@/services'
import { errorMessage } from '@/services/apiClient'
import { formatNumber } from '@/lib/utils'

const PAGE_SIZE = 12

/** Public seller storefront and its active products. */
export default function StorePage() {
  const { slug = '' } = useParams()
  const [searchParams, setSearchParams] = useSearchParams()
  const requestedPage = Number(searchParams.get('page') ?? 1)
  const page = Number.isFinite(requestedPage) ? Math.max(1, Math.floor(requestedPage)) : 1
  const [seller, setSeller] = useState<Seller>()
  const [products, setProducts] = useState<Product[]>([])
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string>()

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setSeller(undefined)
    setProducts([])
    setError(undefined)

    Promise.all([
      catalogService.fetchStore(slug),
      productService.queryProducts({ sellerSlug: slug, page, pageSize: PAGE_SIZE, sort: 'popularity' }),
    ])
      .then(([store, result]) => {
        if (cancelled) return
        setSeller(store)
        setProducts(result.items)
        setTotal(result.total)
        setTotalPages(result.totalPages)
      })
      .catch((cause: unknown) => {
        if (cancelled) return
        setSeller(undefined)
        setProducts([])
        setTotal(0)
        setTotalPages(1)
        setError(errorMessage(cause))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [slug, page])

  const changePage = (nextPage: number) => {
    setSearchParams((previous) => {
      const next = new URLSearchParams(previous)
      if (nextPage === 1) next.delete('page')
      else next.set('page', String(nextPage))
      return next
    })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <div>
      {seller && (
        <div className="relative border-b border-ink-200 bg-sand-50">
          <div className="absolute inset-0">
            <SmartImage
              src={seller.bannerUrl ?? undefined}
              alt=""
              aria-hidden="true"
              wrapperClassName="h-full w-full"
              className="opacity-25"
            />
          </div>
          <div className="container-page relative py-8 sm:py-10">
            <Breadcrumbs items={[{ label: 'Shop', to: '/shop' }, { label: seller.storeName }]} />
            <div className="mt-6 flex items-center gap-4">
              <Avatar name={seller.storeName} src={seller.logoUrl} size="xl" className="rounded-xl" />
              <div className="min-w-0">
                <h1 className="truncate text-2xl font-bold tracking-tight text-ink sm:text-3xl">{seller.storeName}</h1>
                {seller.businessCategory && <p className="mt-1 text-sm text-ink-600">{seller.businessCategory}</p>}
              </div>
            </div>
            {seller.storeDescription && (
              <p className="mt-5 max-w-3xl whitespace-pre-line text-sm leading-relaxed text-ink-700">
                {seller.storeDescription}
              </p>
            )}
            <p className="mt-4 text-sm text-ink-600">
              {loading ? 'Loading products…' : `${formatNumber(total)} product${total === 1 ? '' : 's'}`}
            </p>
          </div>
        </div>
      )}

      {!seller && loading && (
        <div className="container-page py-8">
          <p className="text-sm text-ink-500" role="status">Loading store…</p>
          <div className="mt-6">
            <ProductGrid products={[]} loading />
          </div>
        </div>
      )}

      <div className="container-page py-8">
        {!seller && !loading && (
          <div className="mx-auto max-w-2xl">
            <Breadcrumbs items={[{ label: 'Store' }]} />
            <div className="mt-6">
              {error ? (
                <Alert tone="danger" title="Could not load this store">{error}</Alert>
              ) : (
                <EmptyState
                  icon={<Store className="h-5 w-5" />}
                  title="Store not found"
                  description="This store may be unavailable or the link may be incorrect."
                  action={{ label: 'Browse all products', to: '/shop' }}
                />
              )}
              {error && (
                <Link to="/shop" className="mt-4 inline-block text-sm font-medium text-ink underline">
                  Browse all products
                </Link>
              )}
            </div>
          </div>
        )}

        {seller && (
          <>
            <h2 className="mb-5 text-xl font-semibold text-ink">Products from {seller.storeName}</h2>
            <ProductGrid
              products={products}
              loading={loading}
              emptyTitle="No products available yet"
              emptyDescription="This store has not listed any available products."
              emptyAction={{ label: 'Browse all products', to: '/shop' }}
            />
            {!loading && totalPages > 1 && (
              <Pagination
                className="mt-10"
                page={page}
                totalPages={totalPages}
                totalItems={total}
                pageSize={PAGE_SIZE}
                onPageChange={changePage}
              />
            )}
          </>
        )}
      </div>
    </div>
  )
}
