import { Link } from 'react-router-dom'
import { ArrowRight, BadgeCheck, HeartHandshake, Leaf, ShieldCheck, Sparkles, Store, Users } from 'lucide-react'
import { Breadcrumbs } from '@/components/ui/Breadcrumbs'
import { Button } from '@/components/ui/Button'
import { SmartImage } from '@/components/ui/SmartImage'
import { TrustFeatures } from '@/components/storefront/TrustFeatures'
import { SectionHeading } from '@/components/common/SectionHeading'
import { PHOTOS, imgWide } from '@/content/images'

const VALUES = [
  {
    icon: BadgeCheck,
    title: 'Verified sellers only',
    description:
      'Every store is reviewed against a national ID or business registration before its products go live.',
  },
  {
    icon: ShieldCheck,
    title: 'Buyer protection',
    description:
      'Funds are held until delivery is confirmed. If an item is not as described, we make it right.',
  },
  {
    icon: Leaf,
    title: 'Local first',
    description:
      'We prioritise Tanzanian makers and small businesses, keeping more of every sale in the local economy.',
  },
  {
    icon: HeartHandshake,
    title: 'Fair to sellers',
    description:
      'Transparent 8–12% commission, weekly settlements and no listing fees, ever.',
  },
]

/** About page: the Shopio story and marketplace values. */
export default function AboutPage() {
  return (
    <div className="pb-16">
      <div className="border-b border-ink-200 bg-sand-50">
        <div className="container-page py-8 sm:py-10">
          <Breadcrumbs items={[{ label: 'About Us' }]} />
          <div className="mt-4 grid items-center gap-8 lg:grid-cols-[1.2fr_1fr]">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-500">Our story</p>
              <h1 className="mt-3 text-2xl font-bold tracking-tight sm:text-4xl">
                A marketplace built for Tanzanian buyers and sellers
              </h1>
              <p className="mt-4 max-w-xl text-sm leading-relaxed text-ink-600">
                Shopio connects shoppers with verified local sellers of furniture, electronics, fashion,
                home decor and accessories. We started with a simple idea: make it as easy to buy quality
                goods online in Tanzania as it is anywhere else, and give small businesses the tools to
                compete with the big players.
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
              alt="A warm, neutral living space furnished through Shopio"
              wrapperClassName="aspect-[4/3] rounded-card"
              fallbackLabel="Shopio"
            />
          </div>
        </div>
      </div>

      <section className="container-page pt-12" aria-labelledby="values">
        <SectionHeading
          eyebrow="What guides us"
          title="Our values"
          description="The principles behind every decision we make about the marketplace."
        />
        <ul className="grid gap-6 sm:grid-cols-2">
          {VALUES.map((value) => (
            <li key={value.title} className="flex gap-4 rounded-card border border-ink-200 bg-white p-5 shadow-card">
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

      <div className="container-page pt-16">
        <TrustFeatures className="border-t border-ink-200 pt-12" />
      </div>

      <section className="container-page pt-16">
        <div className="grid items-center gap-8 rounded-card border border-ink-200 bg-sand-100 p-8 sm:p-10 lg:grid-cols-[1.4fr_1fr]">
          <div>
            <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-ink-500">
              <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
              Grow with Shopio
            </p>
            <h2 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">
              Bring your products to thousands of shoppers
            </h2>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-ink-600">
              Join a marketplace designed around local businesses. Listing is free, payouts are weekly, and
              your dashboard gives you everything you need to run a store.
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
