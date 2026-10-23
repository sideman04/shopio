import { Link } from 'react-router-dom'
import { ArrowRight, Heart, PackageCheck, Search, Store, Users } from 'lucide-react'
import { Breadcrumbs } from '@/components/ui/Breadcrumbs'
import { Button } from '@/components/ui/Button'
import { SmartImage } from '@/components/ui/SmartImage'
import { SectionHeading } from '@/components/common/SectionHeading'
import { PHOTOS, imgWide } from '@/content/images'

const VALUES = [
  {
    icon: Store,
    title: 'Independent stores',
    description: 'Browse products from independent sellers across the Shopio marketplace.',
  },
  {
    icon: Search,
    title: 'Easy to explore',
    description: 'Find products by category, search, and use filters to narrow your options.',
  },
  {
    icon: Heart,
    title: 'Save favourites',
    description: 'Keep products you are considering together in your wishlist.',
  },
  {
    icon: PackageCheck,
    title: 'Order management',
    description: 'See order details and status updates from your customer account.',
  },
]

/** About page: the Shopio story and marketplace values. */
export default function AboutPage() {
  return (
    <div className="pb-16">
      <div className="border-b border-ink-200 bg-sand-50">
        <div className="container-page py-6 sm:py-8">
          <Breadcrumbs items={[{ label: 'About Us' }]} />
          <div className="mt-4 grid items-center gap-8 lg:grid-cols-[1.2fr_1fr]">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-500">Our story</p>
              <h1 className="mt-3 text-2xl font-bold tracking-tight sm:text-4xl">
                A marketplace built for Tanzanian buyers and sellers
              </h1>
              <p className="mt-4 max-w-xl text-sm leading-relaxed text-ink-600">
                Shopio brings shoppers and independent stores together in one place. Browse furniture,
                electronics, fashion, home decor and accessories, then manage saved items and orders from
                your account.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Button to="/shop" size="lg">
                  Shop the marketplace
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Button>
                <Button to="/sell" variant="outline" size="lg">
                  Start selling
                </Button>
              </div>
            </div>
            <SmartImage
              src={imgWide(PHOTOS.furniture[2], 1000)}
              alt=""
              wrapperClassName="aspect-[4/3]"
              fallbackLabel="Shopio"
            />
          </div>
        </div>
      </div>

      <section className="container-page pt-10 sm:pt-12" aria-label="Inside Shopio">
        <SectionHeading
          eyebrow="Inside Shopio"
          title="One marketplace, useful tools"
        />
        <ul className="grid gap-6 sm:grid-cols-2">
          {VALUES.map((value) => (
            <li key={value.title} className="flex gap-4 border-t border-ink-200 py-4">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-ink-50 text-ink">
                <value.icon className="h-5 w-5" aria-hidden="true" />
              </span>
              <div>
                <h3 className="text-sm font-semibold text-ink">{value.title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-ink-500">{value.description}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="container-page pt-10 sm:pt-12">
        <div className="grid items-center gap-6 border-y border-ink-200 py-7 sm:py-9 lg:grid-cols-[1.4fr_1fr]">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-500">For sellers</p>
            <h2 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">
              Bring your products to Shopio
            </h2>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-ink-600">
              Create a seller account, publish your catalogue, and manage inventory and orders in your dashboard.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Button to="/sell" size="lg">
                <Store className="h-4 w-4" />
                Start selling
              </Button>
              <Button to="/contact" variant="outline" size="lg">
                <Users className="h-4 w-4" />
                Talk to our team
              </Button>
            </div>
          </div>
          <p className="text-sm text-ink-600">
            Questions about the marketplace?{' '}
            <Link to="/faq" className="font-medium text-ink underline-offset-2 hover:underline">
              Read our FAQ
            </Link>{' '}
            or{' '}
            <Link to="/contact" className="font-medium text-ink underline-offset-2 hover:underline">
              contact support
            </Link>
            .
          </p>
        </div>
      </section>
    </div>
  )
}
