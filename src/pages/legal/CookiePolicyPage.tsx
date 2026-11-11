import { CookieSettingsButton } from '@/components/privacy/CookieSettingsButton'
import { Breadcrumbs, PageHeader } from '@/components/ui'

const categories = [
  {
    title: 'Strictly necessary cookies',
    description:
      'These support sign-in sessions, shopping cart and checkout functionality, fraud prevention and essential security. They are always active because the service cannot work safely without them.',
  },
  {
    title: 'Functional cookies',
    description:
      'These remember choices such as language and shopping preferences so your experience is more convenient.',
  },
  {
    title: 'Analytics cookies',
    description:
      'These help us understand visits and measure site performance. Analytics tools are not loaded unless you allow this category.',
  },
  {
    title: 'Marketing cookies',
    description:
      'These support relevant advertising and marketing measurement. Marketing tools are not loaded unless you allow this category.',
  },
]

export default function CookiePolicyPage() {
  return (
    <>
      <PageHeader
        variant="storefront"
        title="Cookie policy"
        description="How cookies help RAGIZE work, and how you can manage your choices."
        breadcrumbs={<Breadcrumbs items={[{ label: 'Cookie policy' }]} />}
      />

      <div className="container-page py-10 sm:py-12">
        <article className="mx-auto max-w-3xl space-y-8 text-sm leading-relaxed text-ink-600">
          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-ink">How RAGIZE uses cookies</h2>
            <p>
              Cookies are small files saved by your browser. RAGIZE uses strictly necessary cookies
              to provide core marketplace features. Optional cookies can help remember preferences,
              improve our service and measure marketing, but remain off unless you choose to enable
              them.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-lg font-semibold text-ink">Cookie categories</h2>
            {categories.map((category) => (
              <div key={category.title}>
                <h3 className="font-semibold text-ink">{category.title}</h3>
                <p className="mt-1">{category.description}</p>
              </div>
            ))}
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-ink">Manage your choices</h2>
            <p>
              Your optional cookie choices are saved in this browser and can be changed at any time.
              You can also use your browser settings to remove or block cookies. Blocking necessary
              cookies may prevent some parts of RAGIZE from working correctly.
            </p>
            <CookieSettingsButton className="rounded-lg border border-ink-300 px-4 py-2 text-sm font-semibold text-ink transition-colors hover:border-ink hover:bg-ink-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/70" />
          </section>
        </article>
      </div>
    </>
  )
}
