import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import type { Banner } from '@/types'
import { BannerLink } from '@/components/storefront/BannerLink'
import { HERO_IMAGE, img } from '@/content/images'
import { SmartImage } from '@/components/ui/SmartImage'

const DEFAULT_TITLE = 'Good finds from sellers across Tanzania.'
const DEFAULT_SUBTITLE =
  'Explore furniture, electronics, fashion and home essentials in one marketplace.'

/**
 * Storefront hero — split layout with a warm neutral palette, matching the
 * reference: a compact eyebrow, the headline, a short promo
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
    <section className="home-hero bg-ink text-white">
      <div className="container-page">
        <div className="grid items-center gap-7 py-8 sm:py-10 lg:min-h-[460px] lg:grid-cols-[0.95fr_1.05fr] lg:gap-12 lg:py-9">
          <div className="order-1 py-2 lg:py-8">
            <p className="flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.18em] text-gold-400">
              <span className="h-px w-8 bg-gold-400" aria-hidden="true" />
              Shopio marketplace
            </p>

            <h1 className="mt-4 max-w-xl text-[34px] font-semibold leading-[1.05] tracking-tight text-white sm:text-5xl lg:text-[58px]">
              {title}
            </h1>

            {subtitle && (
              <p className="mt-4 max-w-lg text-sm leading-relaxed text-white/70 sm:text-base">{subtitle}</p>
            )}

            <div className="mt-5 flex flex-wrap items-center gap-3">
              <BannerLink
                href={buttonHref}
                className="inline-flex h-12 items-center gap-2 rounded-lg bg-gold-400 px-6 text-sm font-semibold text-ink transition-all duration-200 hover:-translate-y-0.5 hover:bg-gold-500 hover:shadow-lift focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-400 focus-visible:ring-offset-2 focus-visible:ring-offset-ink"
              >
                {buttonLabel}
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </BannerLink>
              <Link
                to="/sell"
                className="inline-flex h-12 items-center rounded-lg border border-white/30 px-5 text-sm font-medium text-white transition-colors hover:border-white hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-ink"
              >
                Sell Now
              </Link>
            </div>

          </div>

          <div className="order-2">
            <div className="home-hero-image relative overflow-hidden bg-ink-800">
              <SmartImage
                src={imageUrl}
                alt={title}
                fallbackLabel="Shopio marketplace"
                wrapperClassName="h-[250px] w-full bg-ink-800 sm:h-[340px] lg:h-[390px]"
                loadingClassName="bg-ink-800"
                fetchPriority="high"
              />
              <span className="pointer-events-none absolute inset-y-0 left-0 w-1 bg-gold-400" aria-hidden="true" />
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
