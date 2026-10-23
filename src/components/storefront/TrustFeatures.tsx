import { Heart, PackageCheck, Store } from 'lucide-react'
import { cn } from '@/lib/utils'

const FEATURES = [
  {
    icon: Store,
    title: 'Independent sellers',
    description: 'Explore products from multiple stores in one marketplace.',
  },
  {
    icon: Heart,
    title: 'Save favourites',
    description: 'Keep products you like together in your wishlist.',
  },
  {
    icon: PackageCheck,
    title: 'Order updates',
    description: 'Check the status of your purchases in your account.',
  },
]

/**
 * Storefront feature strip. Three compact features laid out horizontally on
 * desktop and stacked on mobile.
 */
export function TrustFeatures({ className }: { className?: string }) {
  return (
    <section className={cn('container-page', className)} aria-label="Marketplace features">
      <ul className="grid gap-x-6 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map((feature) => (
          <li key={feature.title} className="flex items-start gap-3.5">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-ink-50 text-ink">
              <feature.icon className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <h3 className="text-sm font-semibold text-ink">{feature.title}</h3>
              <p className="mt-1 text-sm leading-relaxed text-ink-500">{feature.description}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}
