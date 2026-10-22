import { useEffect, useState } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import {
  ChevronDown,
  Heart,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  Search,
  ShoppingCart,
  Store,
  User,
  X,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { Drawer } from '@/components/ui/Drawer'
import { Dropdown } from '@/components/ui/Dropdown'
import { Avatar } from '@/components/ui/Avatar'
import { Logo } from './Logo'
import { SearchBar } from './SearchBar'
import { useCartCount } from '@/context/cartStore'
import { useWishlistCount } from '@/context/wishlistStore'
import { homeRouteForRole, useActiveRole, useAuthStore, useIsAuthenticated } from '@/context/authStore'
import { toast } from '@/context/uiStore'
import { useCategories } from '@/context/catalogStore'

const NAV = [
  { label: 'Home', to: '/' },
  { label: 'Shop', to: '/shop' },
  { label: 'Categories', to: '/categories' },
  { label: 'About Us', to: '/about' },
  { label: 'Contact', to: '/contact' },
]

/**
 * Storefront header.
 *
 * On large screens the navigation, inline search and account actions share one
 * row. Below `lg` the links collapse into a drawer and the search moves into a
 * toggleable row so nothing overflows.
 */
export function Header() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const cartCount = useCartCount()
  const wishlistCount = useWishlistCount()
  const authenticated = useIsAuthenticated()
  const user = useAuthStore((s) => s.session?.user ?? null)
  const role = useActiveRole()
  const logout = useAuthStore((s) => s.logout)
  const categories = useCategories()
  const location = useLocation()

  const hasSeller = Boolean(user?.roles.includes('seller'))
  const ordersRoute =
    role === 'admin' ? '/admin/orders' : role === 'seller' ? '/seller/orders' : '/account/orders'

  // Close transient UI whenever the route changes.
  useEffect(() => {
    setMobileOpen(false)
    setSearchOpen(false)
  }, [location.pathname, location.search])

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const handleLogout = () => {
    void logout()
    toast.success('Signed out', 'You have been signed out.')
  }

  return (
    <>
      {/* Announcement strip */}
      <div className="bg-ink text-white">
        <div className="container-page flex h-9 items-center justify-center gap-2 text-xs">
          <span className="truncate">
            Free countrywide delivery on orders above TSh 1,000,000 · 7-day returns
          </span>
        </div>
      </div>

      <header
        className={cn(
          'sticky top-0 z-50 border-b bg-white transition-shadow',
          scrolled ? 'border-ink-200 shadow-header' : 'border-transparent',
        )}
      >
        <div className="container-page">
          <div className="flex h-16 items-center gap-3 lg:h-[72px]">
            {/* Mobile menu trigger */}
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              aria-label="Open menu"
              className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-ink transition hover:bg-ink-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/70 lg:hidden"
            >
              <Menu className="h-5 w-5" />
            </button>

            <Logo />

            {/* Desktop navigation */}
            <nav aria-label="Main" className="ml-6 hidden items-center gap-1 lg:flex">
              {NAV.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === '/'}
                  className={({ isActive }) =>
                    cn(
                      'rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                      isActive ? 'text-ink' : 'text-ink-600 hover:bg-ink-50 hover:text-ink',
                    )
                  }
                >
                  {item.label}
                </NavLink>
              ))}
            </nav>

            {/* Desktop search */}
            <div className="ml-auto hidden max-w-md flex-1 md:block">
              <SearchBar size="sm" />
            </div>

            {/* Actions */}
            <div className={cn('flex items-center gap-0.5 md:gap-1', 'ml-auto md:ml-2')}>
              <button
                type="button"
                onClick={() => setSearchOpen((v) => !v)}
                aria-label={searchOpen ? 'Close search' : 'Open search'}
                aria-expanded={searchOpen}
                className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-ink transition hover:bg-ink-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/70 md:hidden"
              >
                {searchOpen ? <X className="h-5 w-5" /> : <Search className="h-5 w-5" />}
              </button>

              {/* Account */}
              <Dropdown
                label="Account menu"
                align="right"
                trigger={
                  <span className="inline-flex h-10 items-center gap-2 rounded-lg px-2 text-ink transition hover:bg-ink-100">
                    {authenticated && user ? (
                      <Avatar name={user.fullName} src={user.avatarUrl} size="sm" />
                    ) : (
                      <User className="h-5 w-5" />
                    )}
                    <span className="hidden text-sm font-medium lg:inline">
                      {authenticated && user ? user.fullName.split(' ')[0] : 'Account'}
                    </span>
                    <ChevronDown className="hidden h-3.5 w-3.5 text-ink-400 lg:inline" />
                  </span>
                }
                items={
                  authenticated
                    ? [
                        { label: 'My dashboard', to: homeRouteForRole(role), icon: <LayoutDashboard className="h-4 w-4" /> },
                        { label: 'My orders', to: ordersRoute, icon: <Package className="h-4 w-4" /> },
                        { label: 'Wishlist', to: '/wishlist', icon: <Heart className="h-4 w-4" /> },
                        hasSeller
                          ? { label: 'Seller dashboard', to: '/seller/dashboard', icon: <Store className="h-4 w-4" />, divider: true }
                          : { label: 'Become a seller', to: '/seller/register', icon: <Store className="h-4 w-4" />, divider: true },
                        { label: 'Sign out', onClick: handleLogout, icon: <LogOut className="h-4 w-4" />, tone: 'danger' as const, divider: true },
                      ]
                    : [
                        { label: 'Sign in', to: '/login', icon: <User className="h-4 w-4" /> },
                        { label: 'Create an account', to: '/register' },
                        { label: 'Sell on Shopio', to: '/sell', icon: <Store className="h-4 w-4" />, divider: true },
                      ]
                }
              />

              {/* Wishlist */}
              <Link
                to="/wishlist"
                aria-label={`Wishlist, ${wishlistCount} item${wishlistCount === 1 ? '' : 's'}`}
                className="relative hidden h-10 w-10 items-center justify-center rounded-lg text-ink transition hover:bg-ink-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/70 sm:inline-flex"
              >
                <Heart className="h-5 w-5" />
                {wishlistCount > 0 && <CountBadge count={wishlistCount} />}
              </Link>

              {/* Cart */}
              <Link
                to="/cart"
                aria-label={`Cart, ${cartCount} item${cartCount === 1 ? '' : 's'}`}
                className="relative inline-flex h-10 w-10 items-center justify-center rounded-lg text-ink transition hover:bg-ink-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/70"
              >
                <ShoppingCart className="h-5 w-5" />
                {cartCount > 0 && <CountBadge count={cartCount} />}
              </Link>

              {/* Sell Now — the seller entry point */}
              <Button to="/sell" size="sm" className="ml-1 hidden lg:inline-flex">
                <Store className="h-4 w-4" />
                Sell Now
              </Button>
            </div>
          </div>

          {/* Collapsible mobile search row */}
          <div className={cn('pb-3 md:hidden', searchOpen ? 'block' : 'hidden')}>
            <SearchBar autoFocus onSubmitted={() => setSearchOpen(false)} />
          </div>
        </div>
      </header>

      {/* Mobile navigation drawer */}
      <Drawer open={mobileOpen} onClose={() => setMobileOpen(false)} title="Menu" side="left" width="sm">
        <nav aria-label="Mobile" className="flex flex-col gap-1">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                cn(
                  'rounded-lg px-3 py-3 text-base font-medium transition-colors',
                  isActive ? 'bg-ink-50 text-ink' : 'text-ink-700 hover:bg-ink-50',
                )
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="mt-6 border-t border-ink-200 pt-5">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-ink-400">Shop by category</p>
          <div className="flex flex-col gap-1">
            {categories.map((category) => (
              <Link
                key={category.id}
                to={`/categories/${category.slug}`}
                className="rounded-lg px-3 py-2 text-sm text-ink-600 transition hover:bg-ink-50 hover:text-ink"
              >
                {category.name}
              </Link>
            ))}
          </div>
        </div>

        <div className="mt-6 space-y-2 border-t border-ink-200 pt-5">
          <Button to="/sell" fullWidth>
            <Store className="h-4 w-4" />
            Sell Now
          </Button>
          {authenticated ? (
            <>
              <Button to={homeRouteForRole(role)} variant="outline" fullWidth>
                My account
              </Button>
              <Button
                variant="ghost"
                fullWidth
                onClick={() => {
                  handleLogout()
                  setMobileOpen(false)
                }}
              >
                Sign out
              </Button>
            </>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <Button to="/login" variant="outline" fullWidth>
                Sign in
              </Button>
              <Button to="/register" variant="secondary" fullWidth>
                Register
              </Button>
            </div>
          )}
        </div>
      </Drawer>
    </>
  )
}

function CountBadge({ count }: { count: number }) {
  return (
    <span
      aria-hidden="true"
      className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-ink px-1 text-[11px] font-semibold text-white"
    >
      {count > 99 ? '99+' : count}
    </span>
  )
}
