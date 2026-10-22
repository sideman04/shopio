import { Link } from 'react-router-dom'
import { ArrowRight, HelpCircle, LayoutGrid, Search, ShoppingBag, ShoppingCart } from 'lucide-react'
import { Button } from '@/components/ui'

const quickLinks = [
  {
    to: '/shop',
    label: 'Shop',
    description: 'Browse every product on Shopio.',
    icon: ShoppingBag,
  },
  {
    to: '/categories',
    label: 'Categories',
    description: 'Explore departments and collections.',
    icon: LayoutGrid,
  },
  {
    to: '/cart',
    label: 'Cart',
    description: 'Review the items you have picked.',
    icon: ShoppingCart,
  },
  {
    to: '/contact',
    label: 'Contact',
    description: 'Ask our support team for help.',
    icon: HelpCircle,
  },
]

export default function NotFoundPage() {
  return (
    <div className="container-page flex min-h-[60vh] flex-col items-center justify-center py-20 text-center sm:py-28">
      <p className="text-sm font-semibold uppercase tracking-[0.2em] text-ink-400">404</p>
      <h1 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">
        We couldn't find that page
      </h1>
      <p className="mt-3 max-w-md text-sm leading-relaxed text-ink-600">
        The page you're looking for may have been moved, renamed, or never existed. Let's get you
        back on track.
      </p>

      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <Button to="/shop">
          Shop all products
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Button>
        <Button to="/" variant="outline">
          Back to home
        </Button>
      </div>

      <nav aria-label="Helpful links" className="mt-14 w-full max-w-3xl">
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {quickLinks.map((link) => {
            const Icon = link.icon
            return (
              <li key={link.to}>
                <Link
                  to={link.to}
                  className="flex h-full flex-col items-start gap-2 rounded-card border border-ink-200 bg-white p-5 text-left shadow-card transition hover:border-ink-400 hover:shadow-lift focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/70"
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-ink-50 text-ink">
                    <Icon className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <span className="text-sm font-semibold text-ink">{link.label}</span>
                  <span className="text-xs text-ink-500">{link.description}</span>
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>

      <p className="mt-12 inline-flex max-w-md items-center gap-2 text-sm text-ink-500">
        <Search className="h-4 w-4 shrink-0" aria-hidden="true" />
        <span>
          Looking for something specific? Try the search bar in the header, or{' '}
          <Link to="/search" className="font-medium text-ink link-underline">
            browse all products
          </Link>
          .
        </span>
      </p>
    </div>
  )
}
