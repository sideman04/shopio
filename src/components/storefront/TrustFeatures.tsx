import { BadgeCheck, Headphones, RefreshCcw, Truck } from 'lucide-react'
import { cn } from '@/lib/utils'

const FEATURES = [
  {
    icon: Truck,
    title: 'Free Shipping',
    description: 'Free countrywide delivery on orders above TSh 1,000,000.',
  },
  {
    icon: BadgeCheck,
    title: 'Money Guarantee',
    description: 'Full refund within 7 days if an item is not as described.',
  },
  {
    icon: Headphones,
    title: 'Online Support',
    description: 'Real people on chat and phone, seven days a week.',
  },
  {
    icon: RefreshCcw,
    title: 'Secure Payment',
    description: 'Mobile money, cards and bank transfer — encrypted end to end.',
  },
]

/**
 * Storefront trust strip. Four compact icon features laid out horizontally on
 * desktop and stacked on mobile, matching the reference layout.
 */
export function TrustFeatures({ className }: { className?: string }) {
  return (
    <section className={cn('container-page', className)} aria-label="Why shop with Shopio">
      <ul className="grid gap-x-6 gap-y-8 sm:grid-cols-2 lg:grid-cols-4">
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
