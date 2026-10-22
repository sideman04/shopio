import type { Order, OrderStatus, Paginated } from '@/types'
import { useAuthStore } from '@/context/authStore'
import { useCartStore } from '@/context/cartStore'
import { useCatalogStore } from '@/context/catalogStore'
import { useOrderStore } from '@/context/orderStore'
import { api } from './apiClient'
import { mapOrder, paginate } from './mappers'

/**
 * Order service — customer `/orders`, seller `/sellers/orders` and admin
 * `/admin/orders`. Fulfilment transitions and totals are enforced server-side.
 */

export type OrderScope = 'customer' | 'seller' | 'admin'

export interface OrderQuery {
  q?: string
  status?: Order['status']
  paymentStatus?: Order['paymentStatus']
  fulfillmentStatus?: Order['fulfillmentStatus']
  userId?: number
  sellerId?: number
  from?: string
  to?: string
  page?: number
  pageSize?: number
  scope?: OrderScope
}

function activeRole(): OrderScope {
  const role = useAuthStore.getState().actingRole ?? useAuthStore.getState().session?.user.roles[0]
  if (role === 'admin') return 'admin'
  if (role === 'seller') return 'seller'
  return 'customer'
}

function endpoint(scope: OrderScope) {
  if (scope === 'admin') return '/admin/orders'
  if (scope === 'seller') return '/sellers/orders'
  return '/orders'
}

export async function queryOrders(query: OrderQuery = {}): Promise<Paginated<Order>> {
  const { page = 1, pageSize = 10, scope = activeRole() } = query
  const response = await api.get<Record<string, unknown>[]>(endpoint(scope), {
    query: {
      q: query.q,
      status: query.status,
      payment_status: query.paymentStatus,
      fulfillment_status: query.fulfillmentStatus,
      seller_id: query.sellerId,
      from: query.from,
      to: query.to,
      page,
      per_page: pageSize,
    },
  })

  const items = (response.data ?? []).map(mapOrder)
  const result = paginate(items, response.meta, pageSize)
  useOrderStore.getState().setOrders(result.items)
  return result
}

export async function getOrder(id: number, scope: OrderScope = activeRole()): Promise<Order | undefined> {
  try {
    const response = await api.get<Record<string, unknown>>(`${endpoint(scope)}/${id}`)
    const order = mapOrder(response.data)
    useOrderStore.getState().upsertOrder(order)
    return order
  } catch {
    return undefined
  }
}

export async function getSellerOrder(id: number) {
  return getOrder(id, 'seller')
}

export async function getAdminOrder(id: number) {
  return getOrder(id, 'admin')
}

export interface CreateOrderPayload {
  addressId?: number
  customerName?: string
  customerEmail?: string
  customerPhone?: string
  shipping?: {
    addressLine: string
    district?: string
    city: string
    region: string
    countryCode?: string
    postalCode?: string
    instructions?: string
  }
  couponCode?: string | null
  paymentProvider?: string
  paymentMethod?: string
  customerNote?: string
}

export interface CreateOrderResult {
  order: Order
  payment: Record<string, unknown> | null
}

function idempotencyKey(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `shopio-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`
}

/** Place an order from the authenticated user's server cart. */
export async function createOrder(payload: CreateOrderPayload): Promise<CreateOrderResult> {
  const body: Record<string, unknown> = {
    customer_name: payload.customerName,
    customer_email: payload.customerEmail,
    customer_phone: payload.customerPhone,
    coupon_code: payload.couponCode || null,
    customer_note: payload.customerNote || null,
    payment_provider: payload.paymentProvider ?? 'sandbox',
    payment_method: payload.paymentMethod ?? null,
  }

  if (payload.addressId) {
    body.address_id = payload.addressId
  } else if (payload.shipping) {
    body.shipping_address_line = payload.shipping.addressLine
    body.shipping_district = payload.shipping.district || null
    body.shipping_city = payload.shipping.city
    body.shipping_region = payload.shipping.region
    body.shipping_country_code = payload.shipping.countryCode ?? 'TZ'
    body.shipping_postal_code = payload.shipping.postalCode || null
    body.shipping_instructions = payload.shipping.instructions || null
  }

  const response = await api.post<{ order: Record<string, unknown>; payment?: Record<string, unknown> | null }>(
    '/orders',
    body,
    { headers: { 'Idempotency-Key': idempotencyKey() } },
  )

  const order = mapOrder(response.data.order)
  useOrderStore.getState().upsertOrder(order)
  useCartStore.getState().clear()

  // The server decremented inventory inside its transaction; refresh cached
  // stock lazily when the shopper next opens the product.
  useCatalogStore.getState().setProducts(useCatalogStore.getState().products)

  return { order, payment: response.data.payment ?? null }
}

/**
 * Advance an order. Customers may only cancel; sellers update each item they
 * own; admins use the order-level transition endpoint.
 */
export async function updateOrderStatus(
  orderId: number,
  status: OrderStatus,
  note?: string,
  scope: OrderScope = activeRole(),
) {
  if (scope === 'customer') {
    if (status !== 'cancelled') {
      throw new Error('Only cancellation is available from the customer account.')
    }
    const response = await api.post<Record<string, unknown>>(`/orders/${orderId}/cancel`, {
      reason: note ?? null,
    })
    const order = mapOrder(response.data)
    useOrderStore.getState().upsertOrder(order)
    return order
  }

  if (scope === 'seller') {
    const current = await getSellerOrder(orderId)
    if (!current) throw new Error('Order not found.')

    const target =
      status === 'cancelled'
        ? 'cancelled'
        : status === 'delivered'
          ? 'delivered'
          : status === 'shipped' || status === 'partially_shipped'
            ? 'shipped'
            : 'processing'

    for (const item of current.items) {
      if (['delivered', 'cancelled', 'returned'].includes(item.fulfillmentStatus)) continue
      const response = await api.patch<Record<string, unknown>>(
        `/sellers/orders/${orderId}/items/${item.id}`,
        { status: target, note: note ?? null },
      )
      const order = mapOrder(response.data)
      useOrderStore.getState().upsertOrder(order)
    }

    return useOrderStore.getState().orders.find((order) => order.id === orderId) ?? current
  }

  const response = await api.patch<Record<string, unknown>>(`/admin/orders/${orderId}/status`, {
    status,
    note: note ?? null,
  })
  const order = mapOrder(response.data)
  useOrderStore.getState().upsertOrder(order)
  return order
}

export async function updatePaymentStatus(
  orderId: number,
  status: Order['paymentStatus'],
  scope: OrderScope = activeRole(),
) {
  if (scope !== 'admin') {
    throw new Error('Payment status can only be changed by an administrator.')
  }
  const response = await api.patch<Record<string, unknown>>(`/admin/orders/${orderId}/status`, {
    payment_status: status,
  })
  const order = mapOrder(response.data)
  useOrderStore.getState().upsertOrder(order)
  return order
}

export async function updateItemFulfillment(
  orderId: number,
  orderItemId: number,
  status: Order['items'][number]['fulfillmentStatus'],
  scope: OrderScope = activeRole(),
) {
  if (scope === 'seller') {
    const response = await api.patch<Record<string, unknown>>(
      `/sellers/orders/${orderId}/items/${orderItemId}`,
      { status },
    )
    const order = mapOrder(response.data)
    useOrderStore.getState().upsertOrder(order)
    return order
  }

  useOrderStore.getState().updateItemFulfillment(orderId, orderItemId, status)
  return useOrderStore.getState().orders.find((order) => order.id === orderId)
}

/** Customer-initiated refund request. */
export async function requestRefund(orderId: number, amount: number | null, reason: string) {
  const response = await api.post<Record<string, unknown>>(
    `/orders/${orderId}/refunds`,
    { amount, reason },
    { headers: { 'Idempotency-Key': idempotencyKey() } },
  )
  return response.data
}

/* -------------------------------------------------------------------------- */
/* Dashboard aggregations                                                      */
/* -------------------------------------------------------------------------- */

export interface OrderSummary {
  total: number
  revenue: number
  pending: number
  processing: number
  shipped: number
  delivered: number
  cancelled: number
}

export function summarise(orders: Order[], sellerId?: number): OrderSummary {
  const scoped =
    sellerId == null
      ? orders
      : orders.filter((order) =>
          order.items.length > 0
            ? order.items.some((item) => item.sellerId === sellerId)
            : order.sellerSubtotal !== undefined,
        )

  const revenue = scoped.reduce((sum, order) => {
    if (sellerId == null) return sum + order.grandTotal
    if (order.items.length === 0) return sum + (order.sellerSubtotal ?? 0)
    return (
      sum +
      order.items
        .filter((item) => item.sellerId === sellerId)
        .reduce((lineSum, item) => lineSum + item.unitPrice * item.quantity, 0)
    )
  }, 0)

  return {
    total: scoped.length,
    revenue,
    pending: scoped.filter((order) => order.status === 'pending').length,
    processing: scoped.filter((order) => order.status === 'processing' || order.status === 'confirmed').length,
    shipped: scoped.filter((order) => order.status === 'shipped' || order.status === 'partially_shipped').length,
    delivered: scoped.filter((order) => order.status === 'delivered').length,
    cancelled: scoped.filter((order) => order.status === 'cancelled' || order.status === 'refunded').length,
  }
}
