import type { OrderStatus } from '@/types'

/**
 * Mirrors the server-side order transition table so the UI never offers an
 * action the API will reject. Keep this in sync with OrderService::TRANSITIONS.
 */
export const ORDER_TRANSITIONS: Partial<Record<OrderStatus, OrderStatus[]>> = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['processing', 'shipped', 'cancelled'],
  processing: ['shipped', 'cancelled'],
  partially_shipped: ['shipped', 'delivered'],
  shipped: ['delivered'],
  delivered: [],
  cancelled: [],
  refunded: [],
}

export function nextOrderStatuses(status: OrderStatus): OrderStatus[] {
  return ORDER_TRANSITIONS[status] ?? []
}

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  pending: 'Pending',
  confirmed: 'Confirmed',
  processing: 'Processing',
  partially_shipped: 'Partially shipped',
  shipped: 'Shipped',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
  refunded: 'Refunded',
}
