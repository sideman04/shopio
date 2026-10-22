import { create } from 'zustand'
import { useShallow } from 'zustand/react/shallow'
import type {
  FulfillmentStatus,
  Order,
  OrderItem,
  OrderStatus,
  PaymentStatus,
} from '@/types'

/**
 * Order cache.
 *
 * Populated from `/orders` (customer), `/sellers/orders` (seller) or
 * `/admin/orders` (admin) by the service layer. Mutations are reconciled from
 * the API response — the backend remains the source of truth.
 */

export interface CreateOrderInput {
  userId: number | null
  customerName: string
  customerEmail: string
  customerPhone: string
  shipping: {
    addressLine: string
    district: string
    city: string
    region: string
    countryCode: string
    postalCode: string
    instructions?: string
  }
  items: unknown[]
  totals: unknown
  paymentMethod: string
  customerNote?: string
}

interface OrderState {
  orders: Order[]
  setOrders: (orders: Order[]) => void
  upsertOrder: (order: Order) => void
  removeOrder: (id: number) => void
  updateStatus: (orderId: number, status: OrderStatus, note?: string) => void
  updatePaymentStatus: (orderId: number, status: PaymentStatus) => void
  updateItemFulfillment: (orderId: number, orderItemId: number, status: OrderItem['fulfillmentStatus']) => void
  addNote: (orderId: number, note: string) => void
}

const PROGRESSION: OrderStatus[] = ['pending', 'confirmed', 'processing', 'shipped', 'delivered']

export const useOrderStore = create<OrderState>((set, get) => ({
  orders: [],

  setOrders(orders) {
    set({ orders })
  },

  upsertOrder(order) {
    const current = get().orders
    const index = current.findIndex((item) => item.id === order.id)
    if (index === -1) {
      set({ orders: [order, ...current] })
      return
    }
    const copy = [...current]
    copy[index] = order
    set({ orders: copy })
  },

  removeOrder(id) {
    set({ orders: get().orders.filter((order) => order.id !== id) })
  },

  updateStatus(orderId, status, note) {
    set({
      orders: get().orders.map((order) => {
        if (order.id !== orderId) return order
        const history = [
          ...order.history,
          {
            id: Date.now(),
            orderId,
            oldStatus: order.status,
            newStatus: status,
            note: note ?? `Status changed to ${status}`,
            createdAt: new Date().toISOString(),
          },
        ]
        const fulfillmentStatus: FulfillmentStatus =
          status === 'delivered'
            ? 'fulfilled'
            : status === 'shipped'
              ? 'partial'
              : order.fulfillmentStatus
        return {
          ...order,
          status,
          fulfillmentStatus,
          deliveredAt: status === 'delivered' ? new Date().toISOString() : order.deliveredAt,
          paymentStatus: status === 'cancelled' ? 'refunded' : order.paymentStatus,
          history,
        }
      }),
    })
  },

  updatePaymentStatus(orderId, status) {
    set({
      orders: get().orders.map((order) => (order.id === orderId ? { ...order, paymentStatus: status } : order)),
    })
  },

  updateItemFulfillment(orderId, orderItemId, status) {
    set({
      orders: get().orders.map((order) => {
        if (order.id !== orderId) return order
        const items = order.items.map((item) =>
          item.id === orderItemId ? { ...item, fulfillmentStatus: status } : item,
        )
        const allDone = items.length > 0 && items.every((item) => item.fulfillmentStatus === 'delivered')
        const anyShipped = items.some((item) => ['shipped', 'delivered'].includes(item.fulfillmentStatus))
        return {
          ...order,
          items,
          fulfillmentStatus: allDone ? 'fulfilled' : anyShipped ? 'partial' : order.fulfillmentStatus,
        }
      }),
    })
  },

  addNote(orderId, note) {
    set({
      orders: get().orders.map((order) =>
        order.id === orderId
          ? {
              ...order,
              history: [
                ...order.history,
                {
                  id: Date.now(),
                  orderId,
                  oldStatus: order.status,
                  newStatus: order.status,
                  note,
                  createdAt: new Date().toISOString(),
                },
              ],
            }
          : order,
      ),
    })
  },
}))

/* -------------------------------------------------------------------------- */
/* Selectors                                                                   */
/* -------------------------------------------------------------------------- */

export function useOrders() {
  return useOrderStore((s) => s.orders)
}

export function useOrderById(id: number | null | undefined) {
  return useOrderStore((s) => (id == null ? undefined : s.orders.find((order) => order.id === id)))
}

export function useCustomerOrders(userId: number | null | undefined) {
  return useOrderStore(
    useShallow((s) => (userId == null ? [] : s.orders.filter((order) => order.userId === userId))),
  )
}

export function useSellerOrders(sellerId: number | null | undefined) {
  return useOrderStore(
    useShallow((s) =>
      sellerId == null
        ? []
        : s.orders.filter((order) =>
            order.items.length > 0
              ? order.items.some((item) => item.sellerId === sellerId)
              : order.sellerSubtotal !== undefined,
          ),
    ),
  )
}

export function orderStatusProgress(status: OrderStatus) {
  if (status === 'cancelled' || status === 'refunded') return -1
  return PROGRESSION.indexOf(status)
}

export { PROGRESSION as ORDER_PROGRESSION }
