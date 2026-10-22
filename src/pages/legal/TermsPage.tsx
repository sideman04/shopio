import { Link } from 'react-router-dom'
import { Alert, Breadcrumbs, PageHeader } from '@/components/ui'

interface PolicySectionProps {
  number: number
  title: string
  children: React.ReactNode
}

function PolicySection({ number, title, children }: PolicySectionProps) {
  const headingId = `terms-section-${number}`
  return (
    <section aria-labelledby={headingId} className="scroll-mt-24 space-y-2">
      <h2 id={headingId} className="flex items-baseline gap-3 text-lg font-semibold">
        <span className="text-sm font-semibold text-ink-400">{number}.</span>
        {title}
      </h2>
      <div className="space-y-3 text-sm leading-relaxed text-ink-600">{children}</div>
    </section>
  )
}

export default function TermsPage() {
  return (
    <>
      <PageHeader
        variant="storefront"
        title="Terms of service"
        description="The rules for using Shopio as a shopper or as a seller."
        breadcrumbs={<Breadcrumbs items={[{ label: 'Terms of service' }]} />}
      />

      <div className="container-page py-10 sm:py-12">
        <div className="mx-auto max-w-3xl space-y-8">
          <p className="text-sm text-ink-500">Last updated 1 October 2026</p>

          <div className="space-y-8">
            <PolicySection number={1} title="Acceptance of these terms">
              <p>
                By creating an account or using Shopio, you agree to these terms. If you do not
                agree with them, please do not use the service. You must be old enough to enter a
                binding contract in your jurisdiction to open an account.
              </p>
            </PolicySection>

            <PolicySection number={2} title="Your account">
              <p>
                You are responsible for keeping your login details secure and for everything that
                happens under your account. Provide accurate information and keep it up to date. We
                may suspend or close accounts that are used fraudulently or that breach these
                terms.
              </p>
            </PolicySection>

            <PolicySection number={3} title="Buying and selling">
              <p>
                Shopio is a marketplace that connects buyers with independent sellers. When you buy
                an item, you enter a contract directly with the seller, who is responsible for the
                item's description, quality and delivery. We help resolve disputes but are not the
                seller of the goods.
              </p>
            </PolicySection>

            <PolicySection number={4} title="Seller obligations">
              <p>
                Sellers must describe their products honestly, keep stock and pricing accurate, and
                dispatch orders promptly. Sellers must hold any licence or permit required for the
                goods they sell and must respond to customer messages within a reasonable time.
              </p>
            </PolicySection>

            <PolicySection number={5} title="Payments and fees">
              <p>
                Prices are shown in Tanzanian Shillings and include any applicable taxes unless
                stated otherwise. Shopio charges sellers a commission on completed sales, which is
                deducted at settlement. Buyers pay delivery fees as shown at checkout.
              </p>
            </PolicySection>

            <PolicySection number={6} title="Prohibited items">
              <p>
                You may not list or buy illegal goods, counterfeit products, weapons, drugs,
                live animals, stolen items, or anything that infringes another party's rights. We
                remove prohibited listings and may report serious cases to the authorities.
              </p>
            </PolicySection>

            <PolicySection number={7} title="Intellectual property">
              <p>
                The Shopio name, logo and interface are owned by us or our licensors. Sellers keep
                ownership of the content they upload but grant us a licence to display it on the
                marketplace for the purpose of running the service.
              </p>
            </PolicySection>

            <PolicySection number={8} title="Limitation of liability">
              <p>
                To the extent permitted by law, Shopio is not liable for indirect or consequential
                losses arising from your use of the marketplace. Nothing in these terms limits
                rights that cannot be excluded under applicable consumer law.
              </p>
            </PolicySection>

            <PolicySection number={9} title="Changes to these terms">
              <p>
                We may update these terms from time to time. When we make material changes we will
                notify you in the app or by email. Continuing to use Shopio after a change means
                you accept the updated terms.
              </p>
            </PolicySection>

            <PolicySection number={10} title="Contact">
              <p>
                Questions about these terms? Get in touch through the{' '}
                <Link to="/contact" className="link-underline">
                  contact page
                </Link>
                .
              </p>
            </PolicySection>
          </div>
        </div>
      </div>
    </>
  )
}
