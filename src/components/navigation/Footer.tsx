import { Link } from 'react-router-dom'
import { Download, Mail, MapPin, Send } from 'lucide-react'
import { useAuthStore, useInstallStore } from '@/context'
import { Logo } from './Logo'

interface FooterLink {
  label: string
  to: string
}

const SUPPORT_LINKS: FooterLink[] = [
  { label: 'Contact us', to: '/contact' },
  { label: 'Help centre & FAQ', to: '/faq' },
  { label: 'Shipping & returns', to: '/shipping-returns' },
]

const COMPANY_LINKS: FooterLink[] = [
  { label: 'About us', to: '/about' },
  { label: 'Shop all products', to: '/shop' },
  { label: 'Categories', to: '/categories' },
  { label: 'Privacy policy', to: '/privacy-policy' },
  { label: 'Terms of service', to: '/terms' },
]

export function Footer() {
  const user = useAuthStore((s) => s.session?.user ?? null)
  const isSeller = Boolean(user?.roles.includes('seller'))
  const isCustomer = Boolean(user?.roles.includes('customer'))
  const showInstall = useInstallStore((s) => s.show)
  const isStandalone = useInstallStore((s) => s.isStandalone)

  // Keep account links relevant to the signed-in visitor.
  const supportLinks: FooterLink[] = [
    ...SUPPORT_LINKS,
    isCustomer
      ? { label: 'Your orders', to: '/account/orders' }
      : { label: 'Sign in', to: '/login' },
    { label: 'Wishlist', to: '/wishlist' },
  ]

  const sellerLinks: FooterLink[] = [
    { label: 'Start selling', to: '/sell' },
    isSeller
      ? { label: 'Seller dashboard', to: '/seller/dashboard' }
      : { label: 'Become a seller', to: '/seller/register' },
    { label: 'Payouts & fees', to: '/sell#payouts' },
  ]

  const columns: Array<{ title: string; links: FooterLink[] }> = [
    { title: 'Customer Support', links: supportLinks },
    { title: 'Company', links: COMPANY_LINKS },
    { title: 'Sell on Shopio', links: sellerLinks },
  ]

  return (
    <footer className="mt-auto border-t border-ink-200 bg-white">
      <div className="container-page py-12 lg:py-16">
        <div className="grid gap-10 lg:grid-cols-[1.4fr_repeat(3,1fr)]">
          <div>
            <Logo />
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-ink-500">
              Shopio is a multi-vendor marketplace connecting Tanzanian shoppers with independent local
              sellers of furniture, electronics, fashion, decor and accessories.
            </p>

            <ul className="mt-5 space-y-2.5 text-sm text-ink-600">
              <li className="flex items-center gap-2.5">
                <Mail className="h-4 w-4 shrink-0 text-ink-400" aria-hidden="true" />
                <span>support@shopio.co.tz</span>
              </li>
              <li className="flex items-start gap-2.5">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-ink-400" aria-hidden="true" />
                <span>Dar es Salaam, Tanzania</span>
              </li>
            </ul>

            {!isStandalone && (
              <button
                type="button"
                onClick={showInstall}
                className="mt-5 inline-flex items-center gap-2 rounded-lg border border-ink-200 px-3 py-2 text-xs font-medium text-ink-600 transition hover:border-ink-400 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/70"
              >
                <Download className="h-3.5 w-3.5" aria-hidden="true" />
                Install app
              </button>
            )}
          </div>

          {columns.map((column) => (
            <div key={column.title}>
              <h2 className="text-sm font-semibold text-ink">{column.title}</h2>
              <ul className="mt-4 space-y-2.5">
                {column.links.map((link) => (
                  <li key={link.label}>
                    <Link
                      to={link.to}
                      className="rounded text-sm text-ink-500 transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/70"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-col gap-4 border-t border-ink-200 pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-ink-500">
            © {new Date().getFullYear()} Shopio. All rights reserved.
          </p>
          <p className="inline-flex items-center gap-2 text-xs text-ink-500">
            <Send className="h-3.5 w-3.5" aria-hidden="true" />
            Prices shown in Tanzanian Shillings (TZS)
          </p>
        </div>
      </div>
    </footer>
  )
}
