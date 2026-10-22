import { Link, Outlet } from 'react-router-dom'
import { ArrowLeft, ShieldCheck } from 'lucide-react'
import { Logo } from '@/components/navigation/Logo'
import { Toaster } from '@/components/ui/Toaster'

/**
 * Shell for the authentication pages. A calm, centred card on a warm neutral
 * canvas, with a clear route back to the storefront.
 */
export function AuthLayout() {
  return (
    <div className="flex min-h-screen flex-col bg-sand-50">
      <header className="border-b border-ink-200/70 bg-white/70 backdrop-blur">
        <div className="container-page flex h-16 items-center justify-between">
          <Logo />
          <Link
            to="/"
            className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-ink-600 transition hover:bg-ink-100 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/70"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Back to store
          </Link>
        </div>
      </header>

      <main className="flex flex-1 items-center justify-center px-4 py-10 sm:py-14">
        <div className="w-full max-w-md">
          <Outlet />
        </div>
      </main>

      <footer className="border-t border-ink-200/70 py-5">
        <div className="container-page flex flex-wrap items-center justify-between gap-3 text-xs text-ink-500">
          <p>© {new Date().getFullYear()} Shopio. All rights reserved.</p>
          <p className="inline-flex items-center gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
            Sessions are issued and validated by the backend.
          </p>
        </div>
      </footer>

      <Toaster />
    </div>
  )
}
