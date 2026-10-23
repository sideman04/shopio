import { useEffect, useMemo, useState } from 'react'
import { ArrowRight, Boxes, PackageCheck, Store } from 'lucide-react'
import type { Product } from '@/types'
import { HeroSection } from '@/components/storefront/HeroSection'
import { TrustFeatures } from '@/components/storefront/TrustFeatures'
import { CategoryTiles } from '@/components/storefront/CategoryTiles'
import { ProductRail } from '@/components/storefront/ProductRail'
import { PromoBanner } from '@/components/storefront/PromoBanner'
import { NewsletterForm } from '@/components/storefront/NewsletterForm'
import { SectionHeading } from '@/components/common/SectionHeading'
import { ProductGrid } from '@/components/products/ProductGrid'
import { Button } from '@/components/ui/Button'
import { useCatalogStore, useCategories, useCategoryCounts } from '@/context/catalogStore'
import { productService } from '@/services'
import { isBannerLive } from '@/lib/banners'
import { PROMO_IMAGE } from '@/content/images'

/**
 * Storefront homepage.
 *
 * Compact storefront home built around marketplace data: featured listings,
 * categories, active admin promotions and recently listed products.
 */
export default function HomePage() {
  const categories = useCategories()
  const counts = useCategoryCounts()
  const banners = useCatalogStore((s) => s.banners)

  const [popular, setPopular] = useState<Product[]>([])
  const [newArrivals, setNewArrivals] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    Promise.all([productService.getFeaturedProducts(8), productService.getNewArrivals(8)])
      .then(([featured, fresh]) => {
        if (cancelled) return
        setPopular(featured)
        setNewArrivals(fresh)
      })
      .catch(() => {
        // Products may be unavailable on a first-ever offline visit. The
        // product grid renders its empty state instead of an unhandled error.
        if (cancelled) return
        setPopular([])
        setNewArrivals([])
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const tiles = useMemo(
    () => categories.map((category) => ({ ...category, productCount: counts[category.slug] ?? 0 })),
    [categories, counts],
  )

  const hero = banners.find((b) => b.placement === 'home_hero' && isBannerLive(b))
  const promo = banners.find((b) => b.placement === 'home_promo' && isBannerLive(b))
  const featuredIds = new Set(popular.map((product) => product.id))
  const distinctNewArrivals = newArrivals.filter((product) => !featuredIds.has(product.id))

  return (
    <div className="pb-16">
      <HeroSection banner={hero} />

      <TrustFeatures className="border-b border-ink-200 py-6 sm:py-7" />

      {/* ------------------------------ Categories ---------------------------- */}
      <section className="container-page pt-10 sm:pt-12" aria-labelledby="top-categories">
        <SectionHeading
          eyebrow="Explore Shopio"
          title="Shop by category"
          action={{ label: 'All categories', to: '/categories' }}
        />
        <CategoryTiles categories={tiles} />
      </section>

      {/* ------------------------------- Popular ------------------------------ */}
      <section className="container-page pt-12 sm:pt-14" aria-labelledby="popular-products">
        <SectionHeading
          eyebrow="Selected from the marketplace"
          title="Featured products"
          description="Browse current listings from sellers on Shopio."
          action={{ label: 'Shop all', to: '/shop' }}
        />
        <ProductGrid
          products={popular}
          loading={loading}
          emptyTitle="No products to show yet"
          emptyDescription="Once sellers list products they will appear here."
        />
      </section>

      {/* ----------------------------- Promotion ----------------------------- */}
      {promo && (
        <div className="pt-12 sm:pt-14">
          <PromoBanner
            eyebrow="Limited time"
            title={promo.title}
            subtitle={promo.subtitle ?? ''}
            buttonLabel={promo.buttonText ?? 'Shop Now'}
            buttonHref={promo.targetUrl ?? '/shop'}
            imageUrl={promo.imageUrl ?? PROMO_IMAGE}
          />
        </div>
      )}

      {/* ---------------------------- New arrivals ---------------------------- */}
      {!loading && distinctNewArrivals.length > 0 && (
        <ProductRail
          eyebrow="Just landed"
          title="New Arrivals"
          description="Recently listed products from across the marketplace."
          products={distinctNewArrivals}
          viewAllHref="/shop?sort=newest"
          className="pt-12 sm:pt-14"
        />
      )}

      {/* --------------------------- Sell on Shopio --------------------------- */}
      <section className="container-page pt-12 sm:pt-14">
        <div className="grid items-center gap-6 border-y border-ink-200 py-7 sm:py-9 lg:grid-cols-[1.4fr_1fr]">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-500">For sellers</p>
            <h2 className="mt-2 text-2xl font-bold tracking-tight sm:text-[28px]">
              Bring your products to Shopio
            </h2>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-ink-600">
              Create a seller account, publish your catalogue, and manage inventory and orders from one place.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Button to="/sell" size="lg">
                Start selling
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Button>
              <Button to="/sell#payouts" variant="outline" size="lg">
                Payouts &amp; fees
              </Button>
            </div>
          </div>
          <ul className="grid gap-4 border-t border-ink-200 pt-5 sm:grid-cols-3 lg:border-l lg:border-t-0 lg:pl-7 lg:pt-0">
            <li className="flex items-center gap-3 text-sm font-medium text-ink-700"><Store className="h-4 w-4 text-ink-500" />Store profile</li>
            <li className="flex items-center gap-3 text-sm font-medium text-ink-700"><Boxes className="h-4 w-4 text-ink-500" />Inventory tools</li>
            <li className="flex items-center gap-3 text-sm font-medium text-ink-700"><PackageCheck className="h-4 w-4 text-ink-500" />Order management</li>
          </ul>
        </div>
      </section>

      {/* ------------------------------ Newsletter ---------------------------- */}
      <section className="container-page pt-12 sm:pt-14">
        <div className="border-t border-ink-200 py-7 sm:py-9">
          <div className="grid items-center gap-6 lg:grid-cols-[1.2fr_1fr]">
            <div>
              <h2 className="text-xl font-bold tracking-tight sm:text-2xl">
                Get new arrivals and offers first
              </h2>
              <p className="mt-2 text-sm text-ink-500">
                Get occasional updates about new products and marketplace offers.
              </p>
            </div>
            <NewsletterForm />
          </div>
        </div>
      </section>
    </div>
  )
}
