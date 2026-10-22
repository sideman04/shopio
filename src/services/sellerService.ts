import type { Order, OrderItem, Paginated, Product, Seller, SellerPayout } from '@/types'
import { useAuthStore } from '@/context/authStore'
import { useCatalogStore, type ProductFormValues } from '@/context/catalogStore'
import { useOrderStore } from '@/context/orderStore'
import { usePeopleStore } from '@/context/peopleStore'
import { api, API_BASE_URL } from './apiClient'
import { mapOrder, mapPayout, mapProduct, mapSeller, num, paginate } from './mappers'

/**
 * Seller service — `/sellers` and `/sellers/products`.
 *
 * Ownership is always enforced by the API; the seller id is never trusted from
 * the client. Local caches are updated from the server responses.
 */

function sellerId(): number | null {
  return useAuthStore.getState().session?.user.sellerId ?? null
}

/** Uploads return a path like `/media/images/...`; validators require absolute URLs. */
export function absoluteMediaUrl(url: string): string {
  if (/^https?:\/\//i.test(url)) return url
  const base = typeof window !== 'undefined' ? window.location.origin : 'http://localhost'
  return new URL(url.startsWith('/') ? url : `/${url}`, base).toString()
}

/* ------------------------------- Store profile ---------------------------- */

export async function fetchStore(): Promise<Seller> {
  const response = await api.get<Record<string, unknown>>('/sellers/store')
  const seller = mapSeller(response.data)
  usePeopleStore.getState().upsertSeller(seller)
  return seller
}

export async function updateSellerStore(patch: Partial<Seller>): Promise<Seller> {
  const response = await api.patch<Record<string, unknown>>('/sellers/store', {
    store_name: patch.storeName,
    store_description: patch.storeDescription,
    business_category: patch.businessCategory,
    contact_phone: patch.contactPhone,
    region_id: patch.regionId,
    city_id: patch.cityId,
    address: patch.address,
    logo_url: patch.logoUrl ? absoluteMediaUrl(patch.logoUrl) : patch.logoUrl,
    banner_url: patch.bannerUrl ? absoluteMediaUrl(patch.bannerUrl) : patch.bannerUrl,
    status: patch.status,
  })
  const seller = mapSeller(response.data)
  usePeopleStore.getState().upsertSeller(seller)
  return seller
}

export async function registerSeller(input: {
  storeName: string
  storeDescription?: string
  businessCategory?: string
  contactPhone?: string
  regionId?: number | null
  cityId?: number | null
  address?: string
}): Promise<Seller> {
  const response = await api.post<Record<string, unknown>>('/sellers/register', {
    store_name: input.storeName,
    store_description: input.storeDescription || null,
    business_category: input.businessCategory || null,
    contact_phone: input.contactPhone || null,
    region_id: input.regionId || null,
    city_id: input.cityId || null,
    address: input.address || null,
  })
  const seller = mapSeller(response.data)
  usePeopleStore.getState().upsertSeller(seller)
  return seller
}

/* --------------------------------- Products ------------------------------- */

interface ProductPayload {
  name: string
  category_id: number | null
  short_description: string | null
  description: string | null
  brand: string | null
  condition_type: Product['conditionType']
  variants?: Array<Record<string, unknown>>
  images?: Array<Record<string, unknown>>
}

function formToCreatePayload(values: ProductFormValues): ProductPayload {
  const options = Object.fromEntries(
    values.options
      .map((option) => [option.name.trim(), option.values[0]?.trim()] as const)
      .filter(([name, value]) => name && value),
  ) as Record<string, string>

  return {
    name: values.name,
    category_id: values.categoryId ?? null,
    short_description: values.shortDescription || null,
    description: values.description || null,
    brand: values.brand || null,
    condition_type: values.conditionType,
    variants: [
      {
        sku: values.sku,
        variant_name: Object.values(options).join(' / ') || 'Default',
        price: values.price,
        compare_at_price: values.compareAtPrice ?? null,
        is_default: true,
        is_active: true,
        options,
      },
    ],
    images: values.images.map((url, index) => ({
      image_url: absoluteMediaUrl(url),
      sort_order: index,
      is_primary: index === 0,
    })),
  }
}

export async function fetchSellerProducts(
  opts: { page?: number; pageSize?: number; status?: string; q?: string } = {},
): Promise<Paginated<Product>> {
  const { page = 1, pageSize = 20 } = opts
  const response = await api.get<Record<string, unknown>[]>('/sellers/products', {
    query: { page, per_page: pageSize, status: opts.status, q: opts.q },
  })
  const items = (response.data ?? []).map(mapProduct)
  const store = useCatalogStore.getState()
  const byId = new Map(store.products.map((product) => [product.id, product]))
  items.forEach((product) => byId.set(product.id, product))
  store.setProducts(Array.from(byId.values()))
  return paginate(items, response.meta, pageSize)
}

export async function getSellerProduct(id: number): Promise<Product | undefined> {
  try {
    const response = await api.get<Record<string, unknown>>(`/sellers/products/${id}`)
    const product = mapProduct(response.data)
    useCatalogStore.getState().upsertProduct(product)
    return product
  } catch {
    return undefined
  }
}

export async function createSellerProduct(values: ProductFormValues): Promise<Product> {
  const response = await api.post<Record<string, unknown>>('/sellers/products', formToCreatePayload(values))
  let product = mapProduct(response.data)
  useCatalogStore.getState().upsertProduct(product)

  if (values.status !== 'draft') {
    const submitted = await api.post<Record<string, unknown>>(`/sellers/products/${product.id}/submit`, {
      note: null,
    })
    product = mapProduct(submitted.data)
    useCatalogStore.getState().upsertProduct(product)
  }

  return product
}

export async function updateSellerProduct(id: number, values: Partial<ProductFormValues>): Promise<Product> {
  const current = await getSellerProduct(id)

  const response = await api.patch<Record<string, unknown>>(`/sellers/products/${id}`, {
    name: values.name,
    category_id: values.categoryId,
    short_description: values.shortDescription,
    description: values.description,
    brand: values.brand,
    condition_type: values.conditionType,
  })
  let product = mapProduct(response.data)

  const variant = current?.variants.find((item) => item.isDefault) ?? current?.variants[0]
  if (variant && (values.price !== undefined || values.compareAtPrice !== undefined)) {
    await api.patch<Record<string, unknown>>(`/sellers/variants/${variant.id}`, {
      price: values.price,
      compare_at_price: values.compareAtPrice ?? null,
    })
  }

  if (variant && values.stock !== undefined && values.stock !== variant.stock) {
    const delta = values.stock - variant.stock
    await api.post<null>('/sellers/inventory/adjust', {
      variant_id: variant.id,
      movement_type: 'adjustment',
      quantity: delta,
      note: 'Stock updated from product form',
    })
  }

  product = (await getSellerProduct(id)) ?? product
  return product
}

export async function deleteSellerProduct(id: number): Promise<void> {
  await api.delete<null>(`/sellers/products/${id}`)
  useCatalogStore.getState().removeProduct(id)
}

export async function submitProductForReview(id: number, note?: string): Promise<Product> {
  const response = await api.post<Record<string, unknown>>(`/sellers/products/${id}/submit`, {
    note: note ?? null,
  })
  const product = mapProduct(response.data)
  useCatalogStore.getState().upsertProduct(product)
  return product
}

/** Seller-facing status changes are limited to submitting for review. */
export async function setProductStatus(id: number, status: Product['status']): Promise<Product | undefined> {
  if (status === 'pending_review' || status === 'active') {
    return submitProductForReview(id)
  }
  return getSellerProduct(id)
}

export async function setStock(variantId: number, stock: number) {
  const product = useCatalogStore
    .getState()
    .products.find((item) => item.variants.some((variant) => variant.id === variantId))
  const variant = product?.variants.find((item) => item.id === variantId)
  const delta = stock - (variant?.stock ?? 0)
  if (delta === 0) return
  await adjustStock(variantId, delta, 'Stock set from inventory screen')
}

export async function adjustStock(variantId: number, delta: number, note?: string) {
  await api.post<null>('/sellers/inventory/adjust', {
    variant_id: variantId,
    movement_type: delta >= 0 ? 'restock' : 'adjustment',
    quantity: delta,
    note: note ?? null,
  })
  useCatalogStore.getState().adjustStock(variantId, delta)
}

export interface InventoryRow {
  variantId: number
  productId: number
  productName: string
  sku: string
  variantName: string
  price: number
  stock: number
  reserved: number
  lowStockThreshold: number
  status: string
}

export async function fetchInventory(
  opts: { page?: number; pageSize?: number; q?: string; lowStock?: boolean } = {},
): Promise<{ items: InventoryRow[]; total: number; summary: Record<string, number> }> {
  const { page = 1, pageSize = 50 } = opts
  const response = await api.get<Record<string, unknown>[]>('/sellers/inventory', {
    query: { page, per_page: pageSize, q: opts.q, low_stock: opts.lowStock ? 1 : undefined },
  })
  const items = (response.data ?? []).map((row) => ({
    variantId: num(row.variantId ?? row.variant_id),
    productId: num(row.productId ?? row.product_id),
    productName: String(row.productName ?? row.product_name ?? ''),
    sku: String(row.sku ?? ''),
    variantName: String(row.variantName ?? row.variant_name ?? 'Default'),
    price: num(row.price),
    stock: num(row.stock ?? row.availableStock ?? row.available_stock),
    reserved: num(row.reserved ?? row.quantityReserved ?? row.quantity_reserved),
    lowStockThreshold: num(row.lowStockThreshold ?? row.low_stock_threshold, 5),
    status: String(row.status ?? 'active'),
  }))
  return {
    items,
    total: num(response.meta?.pagination?.total, items.length),
    summary: (response.meta?.summary as Record<string, number>) ?? {},
  }
}

export async function setLowStockThreshold(variantId: number, threshold: number) {
  await api.patch<null>('/sellers/inventory/threshold', {
    variant_id: variantId,
    low_stock_threshold: threshold,
  })
}

/* --------------------------------- Orders --------------------------------- */

export async function fetchSellerOrders(
  opts: { page?: number; pageSize?: number; status?: string; fulfillmentStatus?: string; q?: string } = {},
): Promise<Paginated<Order>> {
  const { page = 1, pageSize = 20 } = opts
  const response = await api.get<Record<string, unknown>[]>('/sellers/orders', {
    query: {
      page,
      per_page: pageSize,
      status: opts.status,
      fulfillment_status: opts.fulfillmentStatus,
      q: opts.q,
    },
  })
  const items = (response.data ?? []).map(mapOrder)
  useOrderStore.getState().setOrders(items)
  return paginate(items, response.meta, pageSize)
}

export async function updateOrderFulfillment(
  orderId: number,
  orderItemId: number,
  status: OrderItem['fulfillmentStatus'],
  note?: string,
) {
  const response = await api.patch<Record<string, unknown>>(
    `/sellers/orders/${orderId}/items/${orderItemId}`,
    { status, note: note ?? null },
  )
  const order = mapOrder(response.data)
  useOrderStore.getState().upsertOrder(order)
  return order
}

/* -------------------------------- Dashboard ------------------------------- */

export interface SellerDashboard {
  revenue: { total: number; last30Days: number; net: number; commission: number; availableForPayout: number }
  orders: { total: number }
  products: { total: number }
  inventory: { variants: number; lowStock: number; outOfStock: number }
  payouts: { requested: number; paid: number }
  recentOrders: Order[]
}

export async function fetchSellerDashboard(): Promise<SellerDashboard | null> {
  if (!sellerId()) return null
  const response = await api.get<Record<string, unknown>>('/sellers/dashboard')
  const row = response.data ?? {}
  const revenue = (row.revenue ?? {}) as Record<string, unknown>
  const orders = (row.orders ?? {}) as Record<string, unknown>
  const products = (row.products ?? {}) as Record<string, unknown>
  const inventory = (row.inventory ?? {}) as Record<string, unknown>
  const payouts = (row.payouts ?? {}) as Record<string, unknown>

  const recentOrders = Array.isArray(row.recentOrders)
    ? row.recentOrders.map((order) => mapOrder(order as Record<string, unknown>))
    : []

  recentOrders.forEach((order) => useOrderStore.getState().upsertOrder(order))

  return {
    revenue: {
      total: num(revenue.total),
      last30Days: num(revenue.last30Days),
      net: num(revenue.net),
      commission: num(revenue.commission),
      availableForPayout: num(revenue.availableForPayout),
    },
    orders: { total: num(orders.total) },
    products: { total: num(products.total) },
    inventory: {
      variants: num(inventory.variants),
      lowStock: num(inventory.lowStock),
      outOfStock: num(inventory.outOfStock),
    },
    payouts: { requested: num(payouts.requested), paid: num(payouts.paid) },
    recentOrders,
  }
}

export interface SellerAnalytics {
  series: Array<{ label: string; revenue: number; orders: number }>
  topProducts: Array<{ name: string; sku: string; units: number; revenue: number }>
  totals: {
    earnedNet: number
    commissionTotal: number
    availableForPayout: number
    unitsSold: number
  }
}

export async function fetchSellerAnalytics(days = 30): Promise<SellerAnalytics> {
  const response = await api.get<Record<string, unknown>>('/sellers/analytics', { query: { days } })
  const row = response.data ?? {}
  const totals = (row.totals ?? {}) as Record<string, unknown>
  return {
    series: Array.isArray(row.series)
      ? row.series.map((entry) => {
          const item = entry as Record<string, unknown>
          return {
            label: String(item.label ?? ''),
            revenue: num(item.revenue),
            orders: num(item.orders),
          }
        })
      : [],
    topProducts: Array.isArray(row.topProducts)
      ? row.topProducts.map((entry) => {
          const item = entry as Record<string, unknown>
          return {
            name: String(item.name ?? ''),
            sku: String(item.sku ?? ''),
            units: num(item.units),
            revenue: num(item.revenue),
          }
        })
      : [],
    totals: {
      earnedNet: num(totals.earned_net ?? totals.earnedNet),
      commissionTotal: num(totals.commission_total ?? totals.commissionTotal),
      availableForPayout: num(totals.available_for_payout ?? totals.availableForPayout),
      unitsSold: num(totals.units_sold ?? totals.unitsSold),
    },
  }
}

/* --------------------------------- Payouts -------------------------------- */

export interface PayoutSummary {
  earnedNet: number
  commissionTotal: number
  availableForPayout: number
  unitsSold: number
  requestedTotal: number
  paidTotal: number
  recent: SellerPayout[]
}

export async function fetchPayoutSummary(): Promise<PayoutSummary | null> {
  if (!sellerId()) return null
  const response = await api.get<Record<string, unknown>>('/sellers/payouts/summary')
  const row = response.data ?? {}
  return {
    earnedNet: num(row.earnedNet),
    commissionTotal: num(row.commissionTotal),
    availableForPayout: num(row.availableForPayout),
    unitsSold: num(row.unitsSold),
    requestedTotal: num(row.requestedTotal),
    paidTotal: num(row.paidTotal),
    recent: Array.isArray(row.recent)
      ? row.recent.map((payout) => mapPayout(payout as Record<string, unknown>))
      : [],
  }
}

export async function fetchPayouts(
  opts: { page?: number; pageSize?: number } = {},
): Promise<Paginated<SellerPayout>> {
  const { page = 1, pageSize = 20 } = opts
  const response = await api.get<Record<string, unknown>[]>('/sellers/payouts', {
    query: { page, per_page: pageSize },
  })
  const items = (response.data ?? []).map(mapPayout)
  return paginate(items, response.meta, pageSize)
}

export async function requestPayout(_sellerIdIgnored: number | null, amount: number, method: string, destination: string) {
  const response = await api.post<Record<string, unknown>>(
    '/sellers/payouts',
    {
      amount: amount > 0 ? amount : null,
      payout_method: method,
      destination_label: destination,
    },
    { headers: { 'Idempotency-Key': `payout-${Date.now()}-${Math.random().toString(36).slice(2, 10)}` } },
  )
  return mapPayout(response.data)
}

/* --------------------------------- Uploads -------------------------------- */

export async function uploadImage(file: File): Promise<{ url: string; path: string; mimeType: string }> {
  const form = new FormData()
  form.append('file', file)
  const response = await api.upload<{ url: string; path: string; mimeType: string }>('/uploads/images', form)
  return {
    url: absoluteMediaUrl(response.data.url),
    path: response.data.path,
    mimeType: response.data.mimeType,
  }
}

export function apiOrigin(): string {
  if (typeof window !== 'undefined') {
    return new URL(API_BASE_URL, window.location.origin).origin
  }
  return 'http://localhost:8000'
}
