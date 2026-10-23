import { Outlet, useLocation } from 'react-router-dom'
import { useEffect } from 'react'
import { Header } from '@/components/navigation/Header'
import { Footer } from '@/components/navigation/Footer'
import { Toaster } from '@/components/ui/Toaster'
import { PageTransition } from './PageTransition'

/**
 * Public storefront shell: announcement bar, header, page content and footer.
 * Every shopper-facing route renders inside this layout.
 */
export function StorefrontLayout() {
  const { pathname, hash } = useLocation()

  // Deep-link anchors (e.g. /sell#payouts) scroll to their target; otherwise
  // each page starts at the top.
  useEffect(() => {
    if (hash) {
      const target = document.getElementById(hash.slice(1))
      if (target) {
        target.scrollIntoView({ behavior: 'auto', block: 'start' })
        return
      }
    }
    window.scrollTo({ top: 0, behavior: 'auto' })
  }, [pathname, hash])

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-ink focus:px-4 focus:py-2 focus:text-sm focus:text-white"
      >
        Skip to content
      </a>

      <Header />

      <main id="main" className="flex-1">
        <PageTransition>
          <Outlet />
        </PageTransition>
      </main>

      <Footer />
      <Toaster />
    </div>
  )
}
