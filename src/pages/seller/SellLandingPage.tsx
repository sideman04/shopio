import { useState } from 'react'
import {
  ArrowRight,
  BarChart3,
  BadgeCheck,
  Check,
  ChevronDown,
  LayoutDashboard,
  PackagePlus,
  ShieldCheck,
  Store,
  Truck,
  Wallet,
} from 'lucide-react'
import { Button, Card, CardBody } from '@/components/ui'
import { sellerFaqs } from '@/content/marketing'
import { cn } from '@/lib/utils'

const BENEFITS = [
  {
    icon: Store,
    title: 'Reach thousands of shoppers',
    body: 'Your products appear alongside established Tanzanian stores in search, category and home feeds — no separate website to build or maintain.',
  },
  {
    icon: BadgeCheck,
    title: 'Low, transparent commission',
    body: 'We take 8–12% per completed sale depending on category. No listing fees, no monthly subscription, no charge on orders that never ship.',
  },
  {
    icon: Wallet,
    title: 'Weekly payouts',
    body: 'Earnings clear after the buyer’s return window closes and are paid out to your bank account or mobile money wallet on a weekly cycle.',
  },
  {
    icon: Truck,
    title: 'Delivery support',
    body: 'Use Shopio Express or ship with your own courier. Add tracking, update fulfilment and keep buyers informed from one dashboard.',
  },
  {
    icon: BarChart3,
    title: 'Built-in analytics',
    body: 'See views, conversion, revenue by category and your best-selling products so you know exactly what to restock and promote.',
  },
  {
    icon: ShieldCheck,
    title: 'Seller protection',
    body: 'Order and payout records are logged, disputes are reviewed by our team, and payout holds are always explained before they are applied.',
  },
]

const STEPS = [
  {
    icon: Store,
    step: 'Step 1',
    title: 'Create your store',
    body: 'Tell us about your business, set your store name and upload your verification documents. Most applications are reviewed within two business days.',
  },
  {
    icon: PackagePlus,
    step: 'Step 2',
    title: 'List your products',
    body: 'Add photos, pricing, variants and stock. Publish immediately or save as a draft, and edit everything later from the catalogue.',
  },
  {
    icon: Wallet,
    step: 'Step 3',
    title: 'Get paid',
    body: 'Orders land in your dashboard. Fulfil them, mark them shipped, and request a payout once your balance becomes available.',
  },
]

function SellerFaq() {
  const [open, setOpen] = useState<number | null>(0)

  return (
    <div className="divide-y divide-ink-200 overflow-hidden rounded-card border border-ink-200 bg-white">
      {sellerFaqs.map((item, index) => {
        const isOpen = open === index
        const panelId = `sell-faq-panel-${index}`
        const buttonId = `sell-faq-button-${index}`
        return (
          <div key={item.question}>
            <h3>
              <button
                id={buttonId}
                type="button"
                aria-expanded={isOpen}
                aria-controls={panelId}
                onClick={() => setOpen(isOpen ? null : index)}
                className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition hover:bg-ink-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ink/70"
              >
                <span className="text-sm font-medium text-ink">{item.question}</span>
                <ChevronDown
                  className={cn('h-4 w-4 shrink-0 text-ink-500 transition-transform', isOpen && 'rotate-180')}
                  aria-hidden="true"
                />
              </button>
            </h3>
            {isOpen && (
              <div
                id={panelId}
                role="region"
                aria-labelledby={buttonId}
                className="px-5 pb-4 text-sm leading-relaxed text-ink-600"
              >
                {item.answer}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

export default function SellLandingPage() {
  return (
    <>
      {/* Hero */}
      <section className="border-b border-ink-200 bg-sand-50">
        <div className="container-page grid items-center gap-10 py-14 sm:py-20 lg:grid-cols-2 lg:gap-16">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-ink-200 bg-white px-3 py-1 text-xs font-medium text-ink-600">
              <BadgeCheck className="h-3.5 w-3.5 text-gold-500" aria-hidden="true" />
              Selling on Shopio
            </span>
            <h1 className="mt-5 text-3xl font-bold tracking-tight text-balance sm:text-4xl lg:text-5xl">
              Sell to thousands of shoppers across Tanzania
            </h1>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-ink-600">
              Open a store in minutes, list your products and reach customers in Dar es Salaam, Arusha, Mwanza
              and beyond. You keep control of pricing, stock and fulfilment — we handle discovery, checkout and
              payouts.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Button to="/seller/register" size="lg">
                Start selling
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Button>
              <Button to="/sell#payouts" variant="outline" size="lg">
                <LayoutDashboard className="h-4 w-4" aria-hidden="true" />
                Payouts &amp; fees
              </Button>
            </div>

            <dl className="mt-10 grid max-w-lg grid-cols-3 gap-6 border-t border-ink-200 pt-6">
              <div>
                <dt className="text-xs uppercase tracking-wide text-ink-500">Listing fee</dt>
                <dd className="mt-1 text-lg font-bold text-ink">Free</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-ink-500">Commission</dt>
                <dd className="mt-1 text-lg font-bold text-ink">8–12%</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-ink-500">Payouts</dt>
                <dd className="mt-1 text-lg font-bold text-ink">Weekly</dd>
              </div>
            </dl>
          </div>

          {/* Dashboard capabilities */}
          <div className="relative">
            <Card className="p-6">
              <p className="text-sm font-semibold text-ink">Everything in one dashboard</p>
              <ul className="mt-4 space-y-3 text-sm text-ink-600">
                {[
                  'Track orders and fulfilment in real time.',
                  'See revenue, payouts and commission at a glance.',
                  'Manage stock and low-stock alerts.',
                  'Reply to customer reviews.',
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2.5">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-success-600" aria-hidden="true" />
                    {item}
                  </li>
                ))}
              </ul>
            </Card>
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section className="section-y">
        <div className="container-page">
          <div className="max-w-2xl">
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">Everything you need to sell online</h2>
            <p className="mt-3 text-ink-600">
              Shopio gives small and growing businesses the same tools the big stores use — without the setup cost
              or a developer.
            </p>
          </div>

          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {BENEFITS.map((benefit) => (
              <Card key={benefit.title} className="h-full">
                <CardBody className="space-y-3">
                  <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-ink-50 text-ink">
                    <benefit.icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <h3 className="text-base font-semibold text-ink">{benefit.title}</h3>
                  <p className="text-sm leading-relaxed text-ink-600">{benefit.body}</p>
                </CardBody>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="border-y border-ink-200 bg-ink-50/50 section-y">
        <div className="container-page">
          <div className="max-w-2xl">
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">How it works</h2>
            <p className="mt-3 text-ink-600">Three steps from application to your first payout.</p>
          </div>

          <ol className="mt-10 grid gap-6 lg:grid-cols-3">
            {STEPS.map((step, index) => (
              <li key={step.title} className="relative">
                <Card className="h-full">
                  <CardBody className="space-y-3">
                    <div className="flex items-center gap-3">
                      <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-ink text-white">
                        <step.icon className="h-5 w-5" aria-hidden="true" />
                      </span>
                      <span className="text-xs font-semibold uppercase tracking-wider text-ink-400">
                        {step.step}
                      </span>
                    </div>
                    <h3 className="text-base font-semibold text-ink">{step.title}</h3>
                    <p className="text-sm leading-relaxed text-ink-600">{step.body}</p>
                  </CardBody>
                </Card>
                {index < STEPS.length - 1 && (
                  <ArrowRight
                    className="absolute -right-3 top-1/2 hidden h-6 w-6 -translate-y-1/2 text-ink-300 lg:block"
                    aria-hidden="true"
                  />
                )}
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Commission explainer */}
      <section id="payouts" className="section-y scroll-mt-24">
        <div className="container-page grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:items-start">
          <div>
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">Fees you can plan around</h2>
            <p className="mt-3 text-ink-600">
              There are no hidden charges. Here is exactly what Shopio takes and what you keep on a typical order.
            </p>
            <ul className="mt-6 space-y-3 text-sm text-ink-600">
              {[
                'No listing fee and no monthly subscription.',
                'Commission is deducted automatically at settlement.',
                'You are only charged on completed, paid orders.',
                'Payouts go to a bank account or mobile money wallet in the store’s name.',
              ].map((point) => (
                <li key={point} className="flex items-start gap-2.5">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-success-600" aria-hidden="true" />
                  {point}
                </li>
              ))}
            </ul>
          </div>

          <Card className="p-6">
            <h3 className="text-base font-semibold text-ink">Worked example — a TSh 1,000,000 order</h3>
            <dl className="mt-4 divide-y divide-ink-100 text-sm">
              <div className="flex items-center justify-between py-3">
                <dt className="text-ink-600">Item subtotal</dt>
                <dd className="font-medium text-ink">TSh 1,000,000</dd>
              </div>
              <div className="flex items-center justify-between py-3">
                <dt className="text-ink-600">Shopio commission (10%)</dt>
                <dd className="font-medium text-danger-700">− TSh 100,000</dd>
              </div>
              <div className="flex items-center justify-between py-3">
                <dt className="font-medium text-ink">You receive</dt>
                <dd className="text-lg font-bold text-ink">TSh 900,000</dd>
              </div>
            </dl>
            <p className="mt-4 text-xs leading-relaxed text-ink-500">
              Commission rates range from 8% to 12% depending on category and are confirmed when your store is
              approved. The exact rate is always shown on your payout statements.
            </p>
          </Card>
        </div>
      </section>

      {/* FAQ */}
      <section className="section-y">
        <div className="container-page">
          <div className="max-w-2xl">
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">Seller questions, answered</h2>
            <p className="mt-3 text-ink-600">The things new sellers ask us most before opening a store.</p>
          </div>
          <div className="mt-8 max-w-3xl">
            <SellerFaq />
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="bg-sand-100">
        <div className="container-page py-14 sm:py-20">
          <div className="flex flex-col items-start justify-between gap-8 lg:flex-row lg:items-center">
            <div className="max-w-xl">
              <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">Ready to open your store?</h2>
              <p className="mt-3 text-ink-700">
                Apply today and start listing. It takes about ten minutes, and you can save your progress and come
                back later.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Button to="/seller/register" size="lg">
                Start selling
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Button>
              <Button to="/faq" variant="outline" size="lg">
                Read the seller FAQ
              </Button>
            </div>
          </div>
        </div>
      </section>
    </>
  )
}
