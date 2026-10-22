import { useEffect, useMemo, useState } from 'react'
import { ArrowRight, Sparkles } from 'lucide-react'
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
 * Follows the reference layout: split hero, trust strip, top categories, the
 * popular-products grid, the warm "Summer Sale" promotional band, new arrivals,
 * best sellers and a newsletter block. Product data loads through the product
 * service backed by the PHP API.
 */
export default function HomePage() {
  const categories = useCategories()
  const counts = useCategoryCounts()
  const banners = useCatalogStore((s) => s.banners)

  const [popular, setPopular] = useState<Product[]>([])
  const [newArrivals, setNewArrivals] = useState<Product[]>([])
  const [bestSellers, setBestSellers] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    Promise.all([
      productService.getFeaturedProducts(8),
      productService.getNewArrivals(8),
      productService.getBestSellers(8),
    ])
      .then(([featured, fresh, best]) => {
        if (cancelled) return
        setPopular(featured)
        setNewArrivals(fresh)
        setBestSellers(best)
      })
      .catch(() => {
        // Products may be unavailable on a first-ever offline visit. The
        // product grid renders its empty state instead of an unhandled error.
        if (cancelled) return
        setPopular([])
        setNewArrivals([])
        setBestSellers([])
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

  return (
    <div className="pb-16">
      <HeroSection banner={hero} />

      <TrustFeatures className="border-b border-ink-200 py-10" />

      {/* ------------------------------ Categories ---------------------------- */}
      <section className="container-page pt-14" aria-labelledby="top-categories">
        <SectionHeading
          eyebrow="Browse the marketplace"
          title="Top Categories"
          description="Shop the five categories our customers return to most, from hand-finished furniture to everyday electronics."
          action={{ label: 'All categories', to: '/categories' }}
        />
        <CategoryTiles categories={tiles} />
      </section>

      {/* ------------------------------- Popular ------------------------------ */}
      <section className="container-page pt-16" aria-labelledby="popular-products">
        <SectionHeading
          eyebrow="Loved by shoppers"
          title="Popular Products"
          description="Highly rated pieces across the marketplace, updated as new stock lands."
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
        <div className="pt-16">
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
      <ProductRail
        eyebrow="Just landed"
        title="New Arrivals"
        description="The latest listings from verified sellers across Tanzania."
        products={newArrivals}
        loading={loading}
        viewAllHref="/shop?sort=newest"
        className="pt-16"
      />

      {/* ---------------------------- Best sellers ---------------------------- */}
      <ProductRail
        eyebrow="Proven favourites"
        title="Best Sellers"
        description="The products our community buys again and again."
        products={bestSellers}
        loading={loading}
        viewAllHref="/shop?sort=popularity"
        className="pt-16"
      />

      {/* --------------------------- Sell on Shopio --------------------------- */}
      <section className="container-page pt-16">
        <div className="grid items-center gap-8 rounded-card border border-ink-200 bg-ink-50/60 p-8 sm:p-10 lg:grid-cols-[1.4fr_1fr]">
          <div>
            <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-ink-500">
              <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
              Sell on Shopio
            </p>
            <h2 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">
              Reach shoppers across Tanzania
            </h2>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-ink-600">
              Open a store in minutes, list your catalogue, and manage orders, inventory and payouts
              from a single dashboard. Low commission, weekly settlements and delivery support included.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Button to="/sell" size="lg">
                Start selling
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Button>
              <Button to="/sell#payouts" variant="outline" size="lg">
                Payouts &amp; fees
              </Button>
            </div>
          </div>
          <dl className="grid grid-cols-2 gap-6">
            <div>
              <dt className="text-xs uppercase tracking-wide text-ink-500">Commission from</dt>
              <dd className="mt-1 text-2xl font-bold text-ink">8%</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-ink-500">Payouts</dt>
              <dd className="mt-1 text-2xl font-bold text-ink">Weekly</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-ink-500">Listing fee</dt>
              <dd className="mt-1 text-2xl font-bold text-ink">Free</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-ink-500">Support</dt>
              <dd className="mt-1 text-2xl font-bold text-ink">7 days</dd>
            </div>
          </dl>
        </div>
      </section>

      {/* ------------------------------ Newsletter ---------------------------- */}
      <section className="container-page pt-16">
        <div className="rounded-card border border-ink-200 bg-white p-8 shadow-card sm:p-10">
          <div className="grid items-center gap-6 lg:grid-cols-[1.2fr_1fr]">
            <div>
              <h2 className="text-xl font-bold tracking-tight sm:text-2xl">
                Get new arrivals and offers first
              </h2>
              <p className="mt-2 text-sm text-ink-500">
                Join the Shopio newsletter for weekly drops, seasonal promotions and seller spotlights.
                Unsubscribe at any time.
              </p>
            </div>
            <NewsletterForm />
          </div>
        </div>
      </section>
    </div>
  )
}
