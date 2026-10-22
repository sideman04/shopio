import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronDown, HelpCircle, Package, Truck } from 'lucide-react'
import { Breadcrumbs, Button, Card, CardBody, CardHeader, CardTitle, PageHeader } from '@/components/ui'
import { generalFaqs, sellerFaqs } from '@/content/marketing'
import { cn } from '@/lib/utils'

interface FaqItem {
  question: string
  answer: string
}

/** Accessible accordion used for both the general and seller question lists. */
function FaqAccordion({ items, idPrefix }: { items: FaqItem[]; idPrefix: string }) {
  const [open, setOpen] = useState<number | null>(0)

  return (
    <div className="divide-y divide-ink-200 overflow-hidden rounded-card border border-ink-200 bg-white">
      {items.map((item, index) => {
        const isOpen = open === index
        const panelId = `${idPrefix}-panel-${index}`
        const buttonId = `${idPrefix}-button-${index}`
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
                  className={cn(
                    'h-4 w-4 shrink-0 text-ink-500 transition-transform',
                    isOpen && 'rotate-180',
                  )}
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

export default function FaqPage() {
  return (
    <>
      <PageHeader
        variant="storefront"
        title="Frequently asked questions"
        description="Answers to the things shoppers ask us most — from delivery times to returns and payments."
        breadcrumbs={<Breadcrumbs items={[{ label: 'FAQ' }]} />}
      />

      <div className="container-page py-10 sm:py-12">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-10">
            <section aria-labelledby="faq-shopping" className="space-y-4">
              <h2 id="faq-shopping" className="text-lg font-semibold">
                Shopping and orders
              </h2>
              <FaqAccordion items={generalFaqs} idPrefix="faq-general" />
            </section>

            <section aria-labelledby="faq-selling" className="space-y-4">
              <h2 id="faq-selling" className="text-lg font-semibold">
                Selling on Shopio
              </h2>
              <p className="text-sm text-ink-600">
                Thinking of opening a store? These cover the essentials for sellers.
              </p>
              <FaqAccordion items={sellerFaqs} idPrefix="faq-seller" />
            </section>
          </div>

          <aside className="lg:pt-1">
            <Card className="lg:sticky lg:top-24">
              <CardHeader>
                <CardTitle>Still need help?</CardTitle>
              </CardHeader>
              <CardBody className="space-y-4">
                <p className="text-sm text-ink-600">
                  Can't find your answer? Our support team is happy to help.
                </p>
                <Button to="/contact" fullWidth>
                  <HelpCircle className="h-4 w-4" aria-hidden="true" />
                  Contact support
                </Button>
                <ul className="space-y-2 border-t border-ink-200 pt-4 text-sm">
                  <li>
                    <Link
                      to="/shipping-returns"
                      className="flex items-center gap-2 text-ink-600 transition hover:text-ink"
                    >
                      <Truck className="h-4 w-4 text-ink-400" aria-hidden="true" />
                      Shipping &amp; returns policy
                    </Link>
                  </li>
                  <li>
                    <Link
                      to="/account/orders"
                      className="flex items-center gap-2 text-ink-600 transition hover:text-ink"
                    >
                      <Package className="h-4 w-4 text-ink-400" aria-hidden="true" />
                      Track an existing order
                    </Link>
                  </li>
                </ul>
              </CardBody>
            </Card>
          </aside>
        </div>
      </div>
    </>
  )
}
