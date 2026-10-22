import {
  Activity,
  BarChart3,
  FolderTree,
  Image,
  LayoutDashboard,
  Package,
  Receipt,
  Settings,
  ShieldCheck,
  Star,
  Store,
  Tag,
  Users,
} from 'lucide-react'
import { ProtectedRoute } from '@/components/auth/ProtectedRoute'
import { DashboardShell, type NavGroup } from './DashboardShell'
import { useAuthStore } from '@/context/authStore'
import { useCatalogStore } from '@/context/catalogStore'
import { usePeopleStore } from '@/context/peopleStore'
import { useOrderStore } from '@/context/orderStore'

const NAV: NavGroup[] = [
  {
    label: 'Platform',
    items: [
      { label: 'Overview', to: '/admin', icon: LayoutDashboard, end: true },
      { label: 'Analytics', to: '/admin/analytics', icon: BarChart3 },
      { label: 'Activity log', to: '/admin/activity', icon: Activity },
    ],
  },
  {
    label: 'People',
    items: [
      { label: 'Users', to: '/admin/users', icon: Users },
      { label: 'Sellers', to: '/admin/sellers', icon: Store },
    ],
  },
  {
    label: 'Catalog',
    items: [
      { label: 'Products', to: '/admin/products', icon: Package },
      { label: 'Categories', to: '/admin/categories', icon: FolderTree },
      { label: 'Reviews', to: '/admin/reviews', icon: Star },
    ],
  },
  {
    label: 'Commerce',
    items: [
      { label: 'Orders', to: '/admin/orders', icon: Receipt },
      { label: 'Transactions', to: '/admin/transactions', icon: ShieldCheck },
      { label: 'Promotions', to: '/admin/promotions', icon: Tag },
      { label: 'Banners', to: '/admin/banners', icon: Image },
    ],
  },
  {
    label: 'Configuration',
    items: [{ label: 'Settings', to: '/admin/settings', icon: Settings }],
  },
]

/** Admin console shell — wraps every `/admin/*` route. */
export function AdminLayout() {
  const user = useAuthStore((s) => s.session?.user ?? null)
  const catalog = useCatalogStore()
  const sellers = usePeopleStore((s) => s.sellers)
  const orders = useOrderStore((s) => s.orders)

  const pendingProducts = catalog.products.filter((p) => p.status === 'pending_review').length
  const pendingSellers = sellers.filter((s) => s.verificationStatus === 'pending').length
  const reportedReviews = catalog.reviews.filter((r) => r.reported).length
  const openOrders = orders.filter((o) => o.status === 'pending' || o.status === 'processing').length

  const groups: NavGroup[] = NAV.map((group) => ({
    ...group,
    items: group.items.map((item) => {
      if (item.to === '/admin/sellers') return { ...item, count: pendingSellers }
      if (item.to === '/admin/products') return { ...item, count: pendingProducts }
      if (item.to === '/admin/reviews') return { ...item, count: reportedReviews }
      if (item.to === '/admin/orders') return { ...item, count: openOrders }
      return item
    }),
  }))

  return (
    <ProtectedRoute role="admin">
      <DashboardShell roleLabel="Admin console" navGroups={groups} notificationUserId={user?.id ?? 1} />
    </ProtectedRoute>
  )
}
