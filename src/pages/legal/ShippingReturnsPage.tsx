import {
  Alert,
  Breadcrumbs,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  PageHeader,
  Table,
  TBody,
  TD,
  TH,
  THead,
  TR,
} from '@/components/ui'
import { formatCurrency } from '@/lib/utils'
import { Clock, MapPin, PackageX, RotateCcw, Truck, Wallet } from 'lucide-react'

const deliveryRows = [
  {
    option: 'Shopio Express — Dar es Salaam',
    time: '1–2 working days',
    cost: formatCurrency(25000),
  },
  {
    option: 'Shopio Express — other regions',
    time: '3–7 working days',
    cost: formatCurrency(25000),
  },
  {
    option: 'Pickup station',
    time: '2–4 working days',
    cost: 'Free',
  },
  {
    option: 'Seller delivery (large items)',
    time: 'Arranged per seller',
    cost: 'Quoted at checkout',
  },
]

const returnSteps = [
  'Open your account and go to Orders, then select the item you want to return.',
  'Choose “Request a return” and pick a reason. Add a photo if the item arrived damaged.',
  'We review the request within 1–2 working days and email you a prepaid label or pickup slot.',
  'Pack the item in its original packaging and hand it to the courier or drop it at a pickup station.',
]

export default function ShippingReturnsPage() {
  return (
    <>
      <PageHeader
        variant="storefront"
        title="Shipping & returns"
        description="How we deliver across Tanzania, what it costs, and how returns and refunds work."
        breadcrumbs={<Breadcrumbs items={[{ label: 'Shipping & returns' }]} />}
      />

      <div className="container-page py-10 sm:py-12">
        <div className="mx-auto max-w-4xl space-y-10">
          <p className="text-sm text-ink-500">Last updated 1 October 2026</p>

          <section aria-labelledby="delivery-options" className="space-y-4">
            <div className="flex items-center gap-2">
              <Truck className="h-5 w-5 text-ink-500" aria-hidden="true" />
              <h2 id="delivery-options" className="text-lg font-semibold">
                Delivery options and timeframes
              </h2>
            </div>
            <Card>
              <Table className="min-w-[560px]">
                <THead>
                  <TR>
                    <TH>Delivery option</TH>
                    <TH>Estimated time</TH>
                    <TH>Cost</TH>
                  </TR>
                </THead>
                <TBody>
                  {deliveryRows.map((row) => (
                    <TR key={row.option}>
                      <TD className="font-medium text-ink">{row.option}</TD>
                      <TD>{row.time}</TD>
                      <TD>{row.cost}</TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </Card>
            <p className="text-sm text-ink-600">
              Timeframes start from dispatch, not from when the order is placed. Sellers prepare
              most orders within one working day. Remote regions may take an extra 1–2 days.
            </p>
          </section>

          <section aria-labelledby="delivery-costs" className="space-y-4">
            <div className="flex items-center gap-2">
              <Wallet className="h-5 w-5 text-ink-500" aria-hidden="true" />
              <h2 id="delivery-costs" className="text-lg font-semibold">
                Delivery costs
              </h2>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Card>
                <CardBody className="space-y-1">
                  <p className="text-sm font-medium text-ink">Standard delivery</p>
                  <p className="text-2xl font-bold">{formatCurrency(25000)}</p>
                  <p className="text-sm text-ink-500">Flat rate per order, nationwide.</p>
                </CardBody>
              </Card>
              <Card className="bg-sand-50">
                <CardBody className="space-y-1">
                  <p className="text-sm font-medium text-ink">Free delivery</p>
                  <p className="text-2xl font-bold">Over {formatCurrency(1000000)}</p>
                  <p className="text-sm text-ink-500">
                    Orders above {formatCurrency(1000000)} ship free.
                  </p>
                </CardBody>
              </Card>
            </div>
          </section>

          <section aria-labelledby="returns-window" className="space-y-4">
            <div className="flex items-center gap-2">
              <RotateCcw className="h-5 w-5 text-ink-500" aria-hidden="true" />
              <h2 id="returns-window" className="text-lg font-semibold">
                Returns window
              </h2>
            </div>
            <p className="text-sm leading-relaxed text-ink-600">
              You can request a return within <strong>7 days of delivery</strong>. Items must be
              unused and in their original packaging with any tags, manuals and accessories
              included. Once we receive and inspect the item, we'll confirm the outcome by email.
            </p>
          </section>

          <section aria-labelledby="how-to-return" className="space-y-4">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-ink-500" aria-hidden="true" />
              <h2 id="how-to-return" className="text-lg font-semibold">
                How to start a return
              </h2>
            </div>
            <Card>
              <CardBody>
                <ol className="space-y-4">
                  {returnSteps.map((step, index) => (
                    <li key={step} className="flex gap-3">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-ink text-xs font-semibold text-white">
                        {index + 1}
                      </span>
                      <span className="text-sm leading-relaxed text-ink-600">{step}</span>
                    </li>
                  ))}
                </ol>
              </CardBody>
            </Card>
          </section>

          <div className="grid gap-6 md:grid-cols-2">
            <section aria-labelledby="refund-timelines">
              <Card className="h-full">
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Wallet className="h-4 w-4 text-ink-500" aria-hidden="true" />
                    <CardTitle as="h2" id="refund-timelines">
                      Refund timelines
                    </CardTitle>
                  </div>
                </CardHeader>
                <CardBody>
                  <ul className="space-y-3 text-sm text-ink-600">
                    <li className="flex gap-2">
                      <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-ink-400" aria-hidden="true" />
                      Mobile money refunds usually land within 3–5 working days.
                    </li>
                    <li className="flex gap-2">
                      <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-ink-400" aria-hidden="true" />
                      Card refunds can take 5–10 working days depending on your bank.
                    </li>
                    <li className="flex gap-2">
                      <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-ink-400" aria-hidden="true" />
                      Delivery fees are refunded only when the item was faulty or incorrect.
                    </li>
                  </ul>
                </CardBody>
              </Card>
            </section>

            <section aria-labelledby="exclusions">
              <Card className="h-full">
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <PackageX className="h-4 w-4 text-ink-500" aria-hidden="true" />
                    <CardTitle as="h2" id="exclusions">
                      Exclusions
                    </CardTitle>
                  </div>
                </CardHeader>
                <CardBody>
                  <ul className="space-y-3 text-sm text-ink-600">
                    <li className="flex gap-2">
                      <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-ink-400" aria-hidden="true" />
                      Personal care and hygiene items once opened.
                    </li>
                    <li className="flex gap-2">
                      <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-ink-400" aria-hidden="true" />
                      Perishable goods and custom-made or personalised products.
                    </li>
                    <li className="flex gap-2">
                      <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-ink-400" aria-hidden="true" />
                      Digital downloads and gift cards.
                    </li>
                  </ul>
                </CardBody>
              </Card>
            </section>
          </div>
        </div>
      </div>
    </>
  )
}
