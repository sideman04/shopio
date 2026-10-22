import { Link } from 'react-router-dom'
import { Alert, Breadcrumbs, PageHeader } from '@/components/ui'

interface PolicySectionProps {
  number: number
  title: string
  children: React.ReactNode
}

function PolicySection({ number, title, children }: PolicySectionProps) {
  const headingId = `privacy-section-${number}`
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

export default function PrivacyPolicyPage() {
  return (
    <>
      <PageHeader
        variant="storefront"
        title="Privacy policy"
        description="What information Shopio collects, why we collect it, and the choices you have."
        breadcrumbs={<Breadcrumbs items={[{ label: 'Privacy policy' }]} />}
      />

      <div className="container-page py-10 sm:py-12">
        <div className="mx-auto max-w-3xl space-y-8">
          <p className="text-sm text-ink-500">Last updated 1 October 2026</p>

          <div className="space-y-8">
            <PolicySection number={1} title="Information we collect">
              <p>
                We collect the details you provide when you create an account or place an order:
                your name, email address, phone number, delivery address and order history. If you
                open a store, we also collect the business details you submit for verification.
              </p>
              <p>
                We automatically record limited technical information, such as your browser type
                and the pages you visit, to keep the service working and secure.
              </p>
            </PolicySection>

            <PolicySection number={2} title="How we use it">
              <p>
                We use your information to create and secure your account, process and deliver
                orders, handle returns and refunds, and respond to support requests. We also use it
                to detect fraud and abuse, and to send service messages such as order updates.
              </p>
            </PolicySection>

            <PolicySection number={3} title="Sharing">
              <p>
                We share only what is necessary to complete an order: sellers receive the delivery
                details they need to fulfil your purchase, and couriers receive your address and
                phone number. Payment providers receive the information required to process a
                transaction.
              </p>
              <p>
                We do not sell your personal information. We may disclose it when the law requires
                it or to protect the rights and safety of Shopio, our users and the public.
              </p>
            </PolicySection>

            <PolicySection number={4} title="Cookies and local storage">
              <p>
                We use cookies and similar technologies to keep you signed in, remember your cart
                and measure how the storefront performs. You can control cookies through your
                browser settings; blocking essential cookies may break parts of the service.
              </p>
            </PolicySection>

            <PolicySection number={5} title="Data retention">
              <p>
                We keep account and order records for as long as your account is active and for a
                reasonable period afterwards to meet tax, accounting and legal obligations. When
                information is no longer needed, we delete or anonymise it.
              </p>
            </PolicySection>

            <PolicySection number={6} title="Your rights">
              <p>
                You can access and update most of your information from your account settings. You
                may also ask us to provide a copy of your data, correct it, or delete your account,
                subject to records we are required to keep by law.
              </p>
            </PolicySection>

            <PolicySection number={7} title="Security">
              <p>
                We use reasonable technical and organisational measures to protect your
                information, including encryption in transit and access controls for staff. No
                method of transmission or storage is completely secure, so we cannot guarantee
                absolute security.
              </p>
            </PolicySection>

            <PolicySection number={8} title="Contact">
              <p>
                Questions about this policy or your data? Reach us through the{' '}
                <Link to="/contact" className="link-underline">
                  contact page
                </Link>{' '}
                and we will respond as soon as we can.
              </p>
            </PolicySection>
          </div>
        </div>
      </div>
    </>
  )
}
