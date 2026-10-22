import type {
  Banner,
  Category,
  Coupon,
  Paginated,
  Product,
  ProductStatus,
  Refund,
  Seller,
  SellerPayout,
  SupportMessage,
  Transaction,
  User,
  UserStatus,
  VerificationStatus,
} from '@/types'
import { useCatalogStore, type ProductFormValues } from '@/context/catalogStore'
import { usePeopleStore } from '@/context/peopleStore'
import { useSystemStore } from '@/context/systemStore'
import { api } from './apiClient'
import {
  mapActivity,
  mapBanner,
  mapCategory,
  mapCoupon,
  mapOverview,
  mapPayout,
  mapProduct,
  mapRefund,
  mapSeller,
  mapSupport,
  mapTransaction,
  mapUser,
  num,
  paginate,
  type AdminOverview,
} from './mappers'

/**
 * Admin service — `/admin`.
 *
 * All operations are authorised server-side. Local caches are refreshed from the
 * response so tables stay consistent without re-fetching everything.
 */

/* -------------------------------- Overview -------------------------------- */

export async function fetchOverview(): Promise<AdminOverview> {
  const response = await api.get<Record<string, unknown>>('/admin/overview')
  return mapOverview(response.data)
}

export interface AdminAnalytics {
  series: Array<{ label: string; revenue: number; orders: number }>
  statusBreakdown: Array<{ status: string; count: number }>
  revenueByCategory: Array<{ name: string; value: number }>
  topProducts: Array<{ name: string; units: number; revenue: number }>
  topSellers: Array<{ store: string; revenue: number; orders: number }>
  customerGrowth: Array<{ label: string; customers: number; newCustomers: number }>
  refundsPending: number
  payoutsPending: number
}

export async function fetchAnalytics(days = 30): Promise<AdminAnalytics> {
  const response = await api.get<Record<string, unknown>>('/admin/analytics', { query: { days } })
  const row = response.data ?? {}
  return {
    series: Array.isArray(row.series)
      ? row.series.map((entry) => {
          const item = entry as Record<string, unknown>
          return { label: String(item.label ?? ''), revenue: num(item.revenue), orders: num(item.orders) }
        })
      : [],
    statusBreakdown: Array.isArray(row.statusBreakdown)
      ? row.statusBreakdown.map((entry) => {
          const item = entry as Record<string, unknown>
          return { status: String(item.status ?? ''), count: num(item.count) }
        })
      : [],
    revenueByCategory: Array.isArray(row.revenueByCategory)
      ? row.revenueByCategory.map((entry) => {
          const item = entry as Record<string, unknown>
          return { name: String(item.name ?? ''), value: num(item.value) }
        })
      : [],
    topProducts: Array.isArray(row.topProducts)
      ? row.topProducts.map((entry) => {
          const item = entry as Record<string, unknown>
          return { name: String(item.name ?? ''), units: num(item.units), revenue: num(item.revenue) }
        })
      : [],
    topSellers: Array.isArray(row.topSellers)
      ? row.topSellers.map((entry) => {
          const item = entry as Record<string, unknown>
          return {
            store: String(item.store ?? ''),
            revenue: num(item.revenue),
            orders: num(item.orders),
          }
        })
      : [],
    customerGrowth: Array.isArray(row.customerGrowth)
      ? row.customerGrowth.map((entry) => {
          const item = entry as Record<string, unknown>
          return {
            label: String(item.label ?? ''),
            customers: num(item.customers),
            newCustomers: num(item.newCustomers),
          }
        })
      : [],
    refundsPending: num(row.refundsPending),
    payoutsPending: num(row.payoutsPending),
  }
}

/* --------------------------------- Users ---------------------------------- */

export interface AdminUserQuery {
  role?: string
  status?: string
  q?: string
  page?: number
  pageSize?: number
}

export async function fetchUsers(query: AdminUserQuery = {}): Promise<Paginated<User>> {
  const { page = 1, pageSize = 20 } = query
  const response = await api.get<Record<string, unknown>[]>('/admin/users', {
    query: { role: query.role, status: query.status, q: query.q, page, per_page: pageSize },
  })
  const items = (response.data ?? []).map(mapUser)
  usePeopleStore.getState().setUsers(items)
  return paginate(items, response.meta, pageSize)
}

export async function setUserStatus(userId: number, status: UserStatus, reason?: string) {
  const response = await api.patch<Record<string, unknown>>(`/admin/users/${userId}/status`, {
    status,
    reason: reason ?? null,
  })
  const next = (response.data?.status ?? status) as UserStatus
  usePeopleStore.getState().setUserStatus(userId, next)
  return next
}

export async function setUserRoles(userId: number, roles: User['roles']) {
  const response = await api.put<Record<string, unknown>>(`/admin/users/${userId}/roles`, { roles })
  const next = Array.isArray(response.data?.roles) ? (response.data.roles as User['roles']) : roles
  usePeopleStore.getState().setUserRoles(userId, next)
  return next
}

/* --------------------------------- Sellers -------------------------------- */

export interface AdminSellerQuery {
  verificationStatus?: string
  status?: string
  q?: string
  page?: number
  pageSize?: number
}

export async function fetchSellers(query: AdminSellerQuery = {}): Promise<Paginated<Seller>> {
  const { page = 1, pageSize = 20 } = query
  const response = await api.get<Record<string, unknown>[]>('/admin/sellers', {
    query: {
      verification_status: query.verificationStatus,
      status: query.status,
      q: query.q,
      page,
      per_page: pageSize,
    },
  })
  const items = (response.data ?? []).map(mapSeller)
  usePeopleStore.getState().setSellers(items)
  return paginate(items, response.meta, pageSize)
}

export async function setSellerVerification(
  sellerId: number,
  status: VerificationStatus,
  notes?: string,
): Promise<Seller> {
  const response = await api.patch<Record<string, unknown>>(`/admin/sellers/${sellerId}`, {
    verification_status: status,
    notes: notes ?? null,
  })
  const seller = mapSeller(response.data)
  usePeopleStore.getState().upsertSeller(seller)
  return seller
}

export async function setSellerStatus(sellerId: number, status: Seller['status']): Promise<Seller> {
  const response = await api.patch<Record<string, unknown>>(`/admin/sellers/${sellerId}`, { status })
  const seller = mapSeller(response.data)
  usePeopleStore.getState().upsertSeller(seller)
  return seller
}

export async function setSellerCommission(sellerId: number, commissionRate: number): Promise<Seller> {
  const response = await api.patch<Record<string, unknown>>(`/admin/sellers/${sellerId}`, {
    commission_rate: commissionRate,
  })
  const seller = mapSeller(response.data)
  usePeopleStore.getState().upsertSeller(seller)
  return seller
}

/* -------------------------------- Products -------------------------------- */

export interface AdminProductQuery {
  status?: string
  sellerId?: number
  q?: string
  page?: number
  pageSize?: number
}

export async function fetchProducts(query: AdminProductQuery = {}): Promise<Paginated<Product>> {
  const { page = 1, pageSize = 20 } = query
  const response = await api.get<Record<string, unknown>[]>('/admin/products', {
    query: {
      status: query.status,
      seller_id: query.sellerId,
      q: query.q,
      page,
      per_page: pageSize,
    },
  })
  const items = (response.data ?? []).map(mapProduct)
  const store = useCatalogStore.getState()
  const byId = new Map(store.products.map((product) => [product.id, product]))
  items.forEach((product) => byId.set(product.id, product))
  store.setProducts(Array.from(byId.values()))
  return paginate(items, response.meta, pageSize)
}

export async function moderateProduct(productId: number, status: ProductStatus, reason?: string) {
  const response = await api.patch<Record<string, unknown>>(`/admin/products/${productId}`, {
    status,
    rejection_reason: reason ?? null,
  })
  const next = (response.data?.status ?? status) as ProductStatus
  useCatalogStore.getState().setProductStatus(productId, next, reason)
  return next
}

export async function adminUpdateProduct(id: number, values: Partial<ProductFormValues>) {
  if (values.status) {
    return moderateProduct(id, values.status)
  }
  return undefined
}

/* ------------------------------- Categories ------------------------------- */

export async function fetchCategories(): Promise<Category[]> {
  const response = await api.get<Record<string, unknown>[]>('/admin/categories')
  const categories = (response.data ?? []).map(mapCategory)
  useCatalogStore.getState().setCategories(categories)
  return categories
}

function categoryPayload(input: Partial<Category> & { name?: string }) {
  return {
    name: input.name,
    slug: input.slug,
    parent_id: input.parentId ?? null,
    description: input.description ?? null,
    image_url: input.imageUrl ?? null,
    sort_order: input.sortOrder,
    status: input.status,
  }
}

export async function createCategory(input: Partial<Category> & { name: string }): Promise<Category> {
  const response = await api.post<Record<string, unknown>>('/admin/categories', categoryPayload(input))
  const category = mapCategory(response.data)
  useCatalogStore.getState().upsertCategory(category)
  return category
}

export async function updateCategory(id: number, patch: Partial<Category>): Promise<Category> {
  const response = await api.patch<Record<string, unknown>>(`/admin/categories/${id}`, categoryPayload(patch))
  const category = mapCategory(response.data)
  useCatalogStore.getState().upsertCategory(category)
  return category
}

export async function deleteCategory(id: number) {
  await api.delete<null>(`/admin/categories/${id}`)
  useCatalogStore.getState().removeCategory(id)
}

/* --------------------------------- Coupons -------------------------------- */

export interface AdminCouponQuery {
  status?: string
  q?: string
  page?: number
  pageSize?: number
}

export async function fetchCoupons(query: AdminCouponQuery = {}): Promise<Paginated<Coupon>> {
  const { page = 1, pageSize = 20 } = query
  const response = await api.get<Record<string, unknown>[]>('/admin/promotions', {
    query: { status: query.status, q: query.q, page, per_page: pageSize },
  })
  const items = (response.data ?? []).map(mapCoupon)
  useCatalogStore.getState().setCoupons(items)
  return paginate(items, response.meta, pageSize)
}

function couponPayload(input: Partial<Coupon>) {
  return {
    code: input.code,
    description: input.description ?? null,
    discount_type: input.discountType,
    discount_value: input.discountValue,
    minimum_order_amount: input.minimumOrderAmount,
    maximum_discount_amount: input.maximumDiscountAmount ?? null,
    usage_limit: input.usageLimit ?? null,
    per_user_limit: input.perUserLimit ?? null,
    starts_at: input.startsAt ?? null,
    expires_at: input.expiresAt ?? null,
    status: input.status,
  }
}

export async function createCoupon(input: Omit<Coupon, 'id' | 'usedCount'>): Promise<Coupon> {
  const response = await api.post<Record<string, unknown>>('/admin/promotions', couponPayload(input))
  const coupon = mapCoupon(response.data)
  useCatalogStore.getState().upsertCoupon(coupon)
  return coupon
}

export async function updateCoupon(id: number, patch: Partial<Coupon>): Promise<Coupon> {
  const payload = couponPayload(patch)
  // The API treats `code` as immutable; omit empty values from partial updates.
  const compact = Object.fromEntries(Object.entries(payload).filter(([, value]) => value !== undefined))
  const response = await api.patch<Record<string, unknown>>(`/admin/promotions/${id}`, compact)
  const coupon = mapCoupon(response.data)
  useCatalogStore.getState().upsertCoupon(coupon)
  return coupon
}

export async function deleteCoupon(id: number) {
  await api.delete<null>(`/admin/promotions/${id}`)
  useCatalogStore.getState().removeCoupon(id)
}

/* --------------------------------- Banners -------------------------------- */

export interface AdminBannerQuery {
  placement?: string
  status?: string
  page?: number
  pageSize?: number
}

export async function fetchBanners(query: AdminBannerQuery = {}): Promise<Paginated<Banner>> {
  const { page = 1, pageSize = 20 } = query
  const response = await api.get<Record<string, unknown>[]>('/admin/banners', {
    query: { placement: query.placement, status: query.status, page, per_page: pageSize },
  })
  const items = (response.data ?? []).map(mapBanner)
  useCatalogStore.getState().setBanners(items)
  return paginate(items, response.meta, pageSize)
}

function bannerPayload(input: Partial<Banner>) {
  return {
    title: input.title,
    subtitle: input.subtitle ?? null,
    image_url: input.imageUrl ?? null,
    button_text: input.buttonText ?? null,
    target_url: input.targetUrl ?? null,
    placement: input.placement,
    starts_at: input.startsAt ?? null,
    ends_at: input.endsAt ?? null,
    sort_order: input.sortOrder,
    status: input.status,
  }
}

export async function createBanner(input: Omit<Banner, 'id'>): Promise<Banner> {
  const response = await api.post<Record<string, unknown>>('/admin/banners', bannerPayload(input))
  const banner = mapBanner(response.data)
  useCatalogStore.getState().upsertBanner(banner)
  return banner
}

export async function updateBanner(id: number, patch: Partial<Banner>): Promise<Banner> {
  const payload = bannerPayload(patch)
  const compact = Object.fromEntries(Object.entries(payload).filter(([, value]) => value !== undefined))
  const response = await api.patch<Record<string, unknown>>(`/admin/banners/${id}`, compact)
  const banner = mapBanner(response.data)
  useCatalogStore.getState().upsertBanner(banner)
  return banner
}

export async function deleteBanner(id: number) {
  await api.delete<null>(`/admin/banners/${id}`)
  useCatalogStore.getState().removeBanner(id)
}

/* ------------------------------- Transactions ----------------------------- */

export interface AdminTransactionQuery {
  status?: string
  provider?: string
  q?: string
  page?: number
  pageSize?: number
}

export async function fetchTransactions(query: AdminTransactionQuery = {}): Promise<Paginated<Transaction>> {
  const { page = 1, pageSize = 20 } = query
  const response = await api.get<Record<string, unknown>[]>('/admin/transactions', {
    query: { status: query.status, provider: query.provider, q: query.q, page, per_page: pageSize },
  })
  const items = (response.data ?? []).map(mapTransaction)
  return paginate(items, response.meta, pageSize)
}

/* ---------------------------------- Refunds ------------------------------- */

export async function fetchRefunds(
  query: { status?: string; q?: string; page?: number; pageSize?: number } = {},
): Promise<Paginated<Refund>> {
  const { page = 1, pageSize = 20 } = query
  const response = await api.get<Record<string, unknown>[]>('/admin/refunds', {
    query: { status: query.status, q: query.q, page, per_page: pageSize },
  })
  const items = (response.data ?? []).map(mapRefund)
  return paginate(items, response.meta, pageSize)
}

export async function decideRefund(
  id: number,
  status: 'approved' | 'rejected' | 'processing' | 'succeeded' | 'failed',
  note?: string,
) {
  const response = await api.patch<Record<string, unknown>>(`/admin/refunds/${id}`, {
    status,
    note: note ?? null,
  })
  return mapRefund(response.data)
}

/* ---------------------------------- Payouts ------------------------------- */

export async function fetchPayouts(
  query: { status?: string; sellerId?: number; q?: string; page?: number; pageSize?: number } = {},
): Promise<Paginated<SellerPayout>> {
  const { page = 1, pageSize = 20 } = query
  const response = await api.get<Record<string, unknown>[]>('/admin/payouts', {
    query: { status: query.status, seller_id: query.sellerId, q: query.q, page, per_page: pageSize },
  })
  const items = (response.data ?? []).map(mapPayout)
  return paginate(items, response.meta, pageSize)
}

export async function decidePayout(
  id: number,
  status: 'requested' | 'pending' | 'processing' | 'paid' | 'rejected' | 'failed',
  adminNote?: string,
) {
  const response = await api.patch<Record<string, unknown>>(`/admin/payouts/${id}`, {
    status,
    admin_note: adminNote ?? null,
  })
  return mapPayout(response.data)
}

/* --------------------------------- Support -------------------------------- */

export async function fetchSupport(
  query: { status?: string; q?: string; page?: number; pageSize?: number } = {},
): Promise<Paginated<SupportMessage>> {
  const { page = 1, pageSize = 20 } = query
  const response = await api.get<Record<string, unknown>[]>('/admin/support', {
    query: { status: query.status, q: query.q, page, per_page: pageSize },
  })
  const items = (response.data ?? []).map(mapSupport)
  useSystemStore.getState().setSupportMessages(items)
  return paginate(items, response.meta, pageSize)
}

export async function setSupportStatus(id: number, status: SupportMessage['status']) {
  const response = await api.patch<Record<string, unknown>>(`/admin/support/${id}`, { status })
  const ticket = mapSupport(response.data)
  useSystemStore.getState().upsertSupport(ticket)
  return ticket
}

/* -------------------------------- Activity -------------------------------- */

export async function fetchActivity(
  query: { action?: string; entityType?: string; actorUserId?: number; q?: string; page?: number; pageSize?: number } = {},
) {
  const { page = 1, pageSize = 30 } = query
  const response = await api.get<Record<string, unknown>[]>('/admin/activity', {
    query: {
      action: query.action,
      entity_type: query.entityType,
      actor_user_id: query.actorUserId,
      q: query.q,
      page,
      per_page: pageSize,
    },
  })
  const items = (response.data ?? []).map(mapActivity)
  useSystemStore.getState().setActivity(items)
  return paginate(items, response.meta, pageSize)
}

/* -------------------------------- Settings -------------------------------- */

export async function fetchSettings(): Promise<Record<string, unknown>> {
  const response = await api.get<Record<string, unknown>>('/admin/settings')
  return response.data ?? {}
}

export async function updateSettings(settings: Record<string, unknown>): Promise<Record<string, unknown>> {
  const response = await api.patch<Record<string, unknown>>('/admin/settings', { settings })
  return response.data ?? {}
}
