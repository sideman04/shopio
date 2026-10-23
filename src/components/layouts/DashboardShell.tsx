import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { Bell, ChevronDown, ExternalLink, LogOut, Menu, Settings, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Drawer } from '@/components/ui/Drawer'
import { Dropdown } from '@/components/ui/Dropdown'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Toaster } from '@/components/ui/Toaster'
import { SearchBar } from '@/components/navigation/SearchBar'
import { Logo } from '@/components/navigation/Logo'
import { homeRouteForRole, useActiveRole, useAuthStore } from '@/context/authStore'
import { useUnreadCount, useNotificationsFor } from '@/context/systemStore'
import { toast } from '@/context/uiStore'
import { PageTransition } from './PageTransition'

export interface NavItem {
  label: string
  to: string
  icon: LucideIcon
  end?: boolean
  /** Live count rendered as a badge. */
  count?: number
}

export interface NavGroup {
  label?: string
  items: NavItem[]
}

interface DashboardShellProps {
  /** Short role label shown above the nav, e.g. "Seller centre". */
  roleLabel: string
  navGroups: NavGroup[]
  /** Notification user id for the bell. */
  notificationUserId: number
  children?: React.ReactNode
}

/**
 * Shared chrome for the customer, seller and admin areas.
 *
 * A fixed sidebar on large screens; a drawer plus compact top bar on smaller
 * ones. Provides the notification bell, account menu, storefront link and the
 * role switcher so all three dashboards behave identically.
 */
export function DashboardShell({ roleLabel, navGroups, notificationUserId, children }: DashboardShellProps) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.session?.user ?? null)
  const logout = useAuthStore((s) => s.logout)
  const role = useActiveRole()
  const unread = useUnreadCount(notificationUserId)
  const notifications = useNotificationsFor(notificationUserId)
  const notificationsHref =
    role === 'seller' ? '/seller/dashboard' : role === 'admin' ? '/admin/activity' : '/account/notifications'

  const visibleNav = navGroups
    .map((group) => ({ ...group, items: group.items.filter(Boolean) }))
    .filter((group) => group.items.length > 0)

  useEffect(() => {
    setMobileNavOpen(false)
  }, [pathname])

  const handleLogout = () => {
    void logout()
    toast.success('Signed out', 'You have been signed out.')
    navigate('/')
  }

  const navList = (
    <nav aria-label={`${roleLabel} navigation`} className="space-y-6">
      {visibleNav.map((group, index) => (
        <div key={group.label ?? index}>
          {group.label && (
            <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-wider text-ink-400">
              {group.label}
            </p>
          )}
          <ul className="space-y-0.5">
            {group.items.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    cn(
                      'dashboard-nav-link flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                      isActive
                        ? 'bg-ink text-white'
                        : 'text-ink-600 hover:bg-ink-100 hover:text-ink',
                    )
                  }
                >
                  <item.icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span className="flex-1 truncate">{item.label}</span>
                  {item.count != null && item.count > 0 && (
                    <span className="rounded-md bg-white/20 px-1.5 py-0.5 text-[11px] font-semibold">
                      {item.count}
                    </span>
                  )}
                </NavLink>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  )

  return (
    <div className="min-h-screen bg-ink-50/50">
      <a
        href="#dashboard-main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-ink focus:px-4 focus:py-2 focus:text-sm focus:text-white"
      >
        Skip to content
      </a>

      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-ink-200 bg-white lg:flex">
        <div className="flex h-[72px] items-center border-b border-ink-200 px-5">
          <Logo />
        </div>
        <div className="border-b border-ink-200 px-5 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-400">{roleLabel}</p>
          {user && <p className="mt-0.5 truncate text-sm font-medium text-ink">{user.fullName}</p>}
        </div>
        <div className="flex-1 overflow-y-auto px-3 py-4">{navList}</div>
        <div className="border-t border-ink-200 p-3">
          <Link
            to="/"
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-ink-600 transition-colors hover:bg-ink-100 hover:text-ink"
          >
            <ExternalLink className="h-4 w-4" aria-hidden="true" />
            View storefront
          </Link>
        </div>
      </aside>

      <div className="lg:pl-64">
        {/* Top bar */}
        <header className="sticky top-0 z-30 border-b border-ink-200 bg-white/95 backdrop-blur">
          <div className="flex h-[72px] items-center gap-3 px-4 sm:px-6">
            <button
              type="button"
              onClick={() => setMobileNavOpen(true)}
              aria-label="Open navigation"
              className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-ink transition hover:bg-ink-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/70 lg:hidden"
            >
              <Menu className="h-5 w-5" />
            </button>

            <div className="hidden min-w-0 flex-1 md:block">
              <div className="max-w-md">
                <SearchBar size="sm" />
              </div>
            </div>

            <div className="ml-auto flex items-center gap-1">
              <Link
                to="/"
                className="hidden items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-ink-600 transition hover:bg-ink-100 hover:text-ink lg:inline-flex"
              >
                <ExternalLink className="h-4 w-4" aria-hidden="true" />
                Storefront
              </Link>

              {/* Notifications */}
              <Dropdown
                label="Notifications"
                align="right"
                trigger={
                  <span className="relative inline-flex h-10 w-10 items-center justify-center rounded-lg text-ink transition hover:bg-ink-100">
                    <Bell className="h-5 w-5" />
                    {unread > 0 && (
                      <span className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-ink px-1 text-[10px] font-semibold text-white">
                        {unread}
                      </span>
                    )}
                  </span>
                }
                menuClassName="w-80"
                items={[
                  ...notifications.slice(0, 4).map((n) => ({
                    label: n.title,
                    to: notificationsHref,
                  })),
                  { label: 'View all notifications', to: notificationsHref, divider: true },
                ]}
              />

              {/* Account */}
              <Dropdown
                label="Account menu"
                align="right"
                menuClassName="w-64"
                trigger={
                  <span className="inline-flex h-10 items-center gap-2 rounded-lg px-1.5 text-ink transition hover:bg-ink-100">
                    <Avatar name={user?.fullName ?? 'Guest'} src={user?.avatarUrl} size="sm" />
                    <ChevronDown className="h-3.5 w-3.5 text-ink-400" />
                  </span>
                }
                items={[
                  { label: 'My account', to: homeRouteForRole(role) },
                  { label: 'Storefront home', to: '/' },
                  ...(role === 'seller'
                    ? [{ label: 'Store settings', to: '/seller/settings', icon: <Settings className="h-4 w-4" /> }]
                    : []),
                  ...(role === 'admin'
                    ? [{ label: 'Platform settings', to: '/admin/settings', icon: <Settings className="h-4 w-4" /> }]
                    : []),
                  { label: 'Sign out', onClick: handleLogout, icon: <LogOut className="h-4 w-4" />, tone: 'danger' as const, divider: true },
                ]}
              />
            </div>
          </div>
        </header>

        <main id="dashboard-main" className="px-4 py-5 sm:px-6 lg:py-7">
          <PageTransition>{children ?? <Outlet />}</PageTransition>
        </main>
      </div>

      {/* Mobile navigation drawer */}
      <Drawer open={mobileNavOpen} onClose={() => setMobileNavOpen(false)} title={roleLabel} side="left" width="sm">
        <div className="mb-4 border-b border-ink-200 pb-4">
          {user && (
            <div className="flex items-center gap-3">
              <Avatar name={user.fullName} src={user.avatarUrl} size="md" />
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-ink">{user.fullName}</p>
                <p className="truncate text-xs text-ink-500">{user.email}</p>
              </div>
            </div>
          )}
        </div>
        {navList}
        <div className="mt-6 border-t border-ink-200 pt-4">
          <Link
            to="/"
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-ink-600 transition-colors hover:bg-ink-100 hover:text-ink"
          >
            <ExternalLink className="h-4 w-4" aria-hidden="true" />
            View storefront
          </Link>
        </div>
        <div className="mt-4">
          <Badge tone="neutral">Signed in</Badge>
        </div>
      </Drawer>

      <Toaster />
    </div>
  )
}
