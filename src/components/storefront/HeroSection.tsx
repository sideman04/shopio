import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import type { Banner } from '@/types'
import { BannerLink } from '@/components/storefront/BannerLink'
import { HERO_IMAGE, img } from '@/content/images'

const DEFAULT_TITLE = 'Discover Stylish Products For You'
const DEFAULT_SUBTITLE =
  'Furniture, electronics, fashion and home decor from verified Tanzanian sellers — curated, quality checked and delivered to your door.'

/**
 * Storefront hero — split layout with a warm neutral palette, matching the
 * reference: a small "NEW COLLECTION" eyebrow, the headline, a short promo
 * description, a black primary call to action and a subordinate seller action
 * alongside a large lifestyle photograph.
 *
 * An active `home_hero` banner managed from the admin console overrides the
 * default copy, image and primary action.
 */
export function HeroSection({ banner }: { banner?: Banner | null }) {
  const title = banner?.title ?? DEFAULT_TITLE
  const subtitle = banner ? banner.subtitle : DEFAULT_SUBTITLE
  const imageUrl = banner?.imageUrl ?? img(HERO_IMAGE, 1200, 1400)
  const buttonLabel = banner?.buttonText ?? 'Shop Now'
  const buttonHref = banner?.targetUrl ?? '/shop'

  return (
    <section className="bg-sand-50">
      <div className="container-page">
        <div className="grid items-center gap-10 py-12 lg:grid-cols-2 lg:gap-16 lg:py-20">
          <div className="order-2 lg:order-1">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-ink-500">New collection</p>

            <h1 className="mt-4 text-[34px] font-bold leading-[1.08] tracking-tight sm:text-5xl lg:text-[56px]">
              {title}
            </h1>

            {subtitle && (
              <p className="mt-5 max-w-lg text-base leading-relaxed text-ink-600">{subtitle}</p>
            )}

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <BannerLink
                href={buttonHref}
                className="inline-flex h-12 items-center gap-2 rounded-lg bg-ink px-7 text-sm font-medium text-white transition hover:bg-ink-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/70 focus-visible:ring-offset-2"
              >
                {buttonLabel}
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </BannerLink>
              <Link
                to="/sell"
                className="inline-flex h-12 items-center rounded-lg border border-ink-300 px-6 text-sm font-medium text-ink transition hover:border-ink hover:bg-white/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/70 focus-visible:ring-offset-2"
              >
                Sell Now
              </Link>
            </div>

            <dl className="mt-10 flex flex-wrap gap-x-10 gap-y-5">
              <div>
                <dt className="text-xs uppercase tracking-wide text-ink-500">Delivery</dt>
                <dd className="mt-1 text-xl font-bold text-ink">2–5 days</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-ink-500">Returns</dt>
                <dd className="mt-1 text-xl font-bold text-ink">7 days</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-ink-500">Support</dt>
                <dd className="mt-1 text-xl font-bold text-ink">7 days a week</dd>
              </div>
            </dl>
          </div>

          <div className="order-1 lg:order-2">
            <div className="relative">
              <img
                src={imageUrl}
                alt={title}
                className="h-[320px] w-full rounded-card object-cover sm:h-[440px] lg:h-[560px]"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
