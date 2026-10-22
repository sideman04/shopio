import {
  Bell,
  Heart,
  LayoutDashboard,
  MapPin,
  MessageSquare,
  Package,
  ShieldCheck,
  Star,
} from 'lucide-react'
import { ProtectedRoute } from '@/components/auth/ProtectedRoute'
import { DashboardShell, type NavGroup } from './DashboardShell'
import { useAuthStore } from '@/context/authStore'
import { useWishlistCount } from '@/context/wishlistStore'
import { useCustomerOrders } from '@/context/orderStore'
import { useNotificationsFor } from '@/context/systemStore'

const NAV: NavGroup[] = [
  {
    label: 'Shopping',
    items: [
      { label: 'Overview', to: '/account', icon: LayoutDashboard, end: true },
      { label: 'My orders', to: '/account/orders', icon: Package },
      { label: 'Wishlist', to: '/account/wishlist', icon: Heart },
      { label: 'My reviews', to: '/account/reviews', icon: Star },
    ],
  },
  {
    label: 'Account',
    items: [
      { label: 'Profile', to: '/account/profile', icon: ShieldCheck },
      { label: 'Addresses', to: '/account/addresses', icon: MapPin },
      { label: 'Notifications', to: '/account/notifications', icon: Bell },
      { label: 'Security', to: '/account/security', icon: MessageSquare },
    ],
  },
]

/** Customer dashboard shell — wraps every `/account/*` route. */
export function CustomerLayout() {
  const user = useAuthStore((s) => s.session?.user ?? null)
  const orders = useCustomerOrders(user?.id)
  const wishlistCount = useWishlistCount()
  const notifications = useNotificationsFor(user?.id)

  const groups: NavGroup[] = NAV.map((group) => ({
    ...group,
    items: group.items.map((item) => {
      if (item.to === '/account/orders') return { ...item, count: orders.length }
      if (item.to === '/account/wishlist') return { ...item, count: wishlistCount }
      if (item.to === '/account/notifications') {
        return { ...item, count: notifications.filter((n) => !n.readAt).length }
      }
      return item
    }),
  }))

  return (
    <ProtectedRoute role="customer">
      <DashboardShell roleLabel="Customer account" navGroups={groups} notificationUserId={user?.id ?? 0} />
    </ProtectedRoute>
  )
}
