import {
  BarChart3,
  Boxes,
  LayoutDashboard,
  MessageSquare,
  Package,
  PlusCircle,
  Settings,
  ShoppingBag,
  Star,
  Store,
  Wallet,
} from 'lucide-react'
import { ProtectedRoute } from '@/components/auth/ProtectedRoute'
import { DashboardShell, type NavGroup } from './DashboardShell'
import { useAuthStore } from '@/context/authStore'
import { useSellerProducts } from '@/context/catalogStore'
import { useSellerOrders } from '@/context/orderStore'
import { usePeopleStore } from '@/context/peopleStore'
import { useCatalogStore } from '@/context/catalogStore'

const NAV: NavGroup[] = [
  {
    label: 'Overview',
    items: [
      { label: 'Dashboard', to: '/seller/dashboard', icon: LayoutDashboard, end: true },
      { label: 'Analytics', to: '/seller/analytics', icon: BarChart3 },
    ],
  },
  {
    label: 'Catalog',
    items: [
      { label: 'Products', to: '/seller/products', icon: ShoppingBag },
      { label: 'Add product', to: '/seller/products/new', icon: PlusCircle },
      { label: 'Inventory', to: '/seller/inventory', icon: Boxes },
    ],
  },
  {
    label: 'Sales',
    items: [
      { label: 'Orders', to: '/seller/orders', icon: Package },
      { label: 'Payouts', to: '/seller/payouts', icon: Wallet },
      { label: 'Reviews', to: '/seller/reviews', icon: Star },
    ],
  },
  {
    label: 'Store',
    items: [
      { label: 'Store profile', to: '/seller/store', icon: Store },
      { label: 'Settings', to: '/seller/settings', icon: Settings },
      { label: 'Messages', to: '/seller/reviews', icon: MessageSquare },
    ],
  },
]

/** Seller centre shell — wraps every `/seller/*` route except onboarding/registration. */
export function SellerLayout() {
  const user = useAuthStore((s) => s.session?.user ?? null)
  const sellerId = user?.sellerId ?? usePeopleStore.getState().sellers[0]?.id ?? 1
  const products = useSellerProducts(sellerId)
  const orders = useSellerOrders(sellerId)
  const catalog = useCatalogStore()

  const lowStock = products
    .flatMap((p) => p.variants)
    .filter((v) => v.stock <= v.lowStockThreshold).length

  const pendingOrders = orders.filter((o) => o.status === 'pending' || o.status === 'processing').length

  const groups: NavGroup[] = NAV.map((group) => ({
    ...group,
    items: group.items.map((item) => {
      if (item.to === '/seller/products') return { ...item, count: products.length }
      if (item.to === '/seller/orders') return { ...item, count: pendingOrders }
      if (item.to === '/seller/inventory') return { ...item, count: lowStock }
      if (item.to === '/seller/reviews') {
        return { ...item, count: catalog.reviews.filter((r) => r.reported).length }
      }
      return item
    }),
  }))

  return (
    <ProtectedRoute role="seller">
      <DashboardShell roleLabel="Seller centre" navGroups={groups} notificationUserId={user?.id ?? 0} />
    </ProtectedRoute>
  )
}
