import { ArrowRight } from 'lucide-react'
import { BannerLink } from '@/components/storefront/BannerLink'
import { cn } from '@/lib/utils'

interface PromoBannerProps {
  eyebrow?: string
  title: string
  subtitle?: string
  buttonLabel?: string
  buttonHref?: string
  imageUrl?: string
  /** `split` places the copy beside the image; `overlay` sits on top of it. */
  variant?: 'split' | 'overlay'
  className?: string
}

/**
 * Warm beige promotional band. Used for the "Summer Sale" block on the
 * homepage and for category-level campaigns.
 */
export function PromoBanner({
  eyebrow,
  title,
  subtitle,
  buttonLabel = 'Shop Now',
  buttonHref = '/shop',
  imageUrl,
  variant = 'split',
  className,
}: PromoBannerProps) {
  if (variant === 'overlay') {
    return (
      <div className={cn('relative overflow-hidden rounded-card bg-ink', className)}>
        {imageUrl && (
          <img
            src={imageUrl}
            alt=""
            aria-hidden="true"
            className="absolute inset-0 h-full w-full object-cover opacity-60"
          />
        )}
        <div className="relative flex min-h-[280px] flex-col justify-center gap-3 bg-gradient-to-r from-ink/85 via-ink/60 to-transparent p-8 sm:p-12">
          {eyebrow && <p className="text-xs font-semibold uppercase tracking-[0.14em] text-white/80">{eyebrow}</p>}
          <h2 className="max-w-md text-3xl font-bold text-white sm:text-4xl">{title}</h2>
          {subtitle && <p className="max-w-sm text-sm text-white/85">{subtitle}</p>}
          <div className="mt-2">
            <BannerLink
              href={buttonHref}
              className="inline-flex h-11 items-center gap-2 rounded-lg bg-white px-5 text-sm font-medium text-ink transition hover:bg-white/90"
            >
              {buttonLabel}
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </BannerLink>
          </div>
        </div>
      </div>
    )
  }

  return (
    <section className={cn('bg-sand-100', className)}>
      <div className="container-page">
        <div className="grid items-center gap-8 py-12 lg:grid-cols-2 lg:gap-16 lg:py-0">
          <div className="lg:py-20">
            {eyebrow && (
              <p className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-ink-500">{eyebrow}</p>
            )}
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl lg:text-[40px]">{title}</h2>
            {subtitle && <p className="mt-4 max-w-md text-base leading-relaxed text-ink-600">{subtitle}</p>}
            <div className="mt-7 flex flex-wrap items-center gap-3">
              <BannerLink
                href={buttonHref}
                className="inline-flex h-12 items-center gap-2 rounded-lg bg-ink px-6 text-sm font-medium text-white transition hover:bg-ink-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/70 focus-visible:ring-offset-2"
              >
                {buttonLabel}
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </BannerLink>
            </div>
          </div>

          {imageUrl && (
            <div className="relative lg:py-12">
              <img
                src={imageUrl}
                alt=""
                aria-hidden="true"
                className="h-64 w-full rounded-card object-cover sm:h-80 lg:h-[420px]"
                loading="lazy"
              />
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
