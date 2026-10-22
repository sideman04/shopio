import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Product } from '@/types'

/**
 * Wishlist store — mirrors the `wishlists` join table (user_id + product_id).
 * Persisted locally so the wishlist behaves consistently across refreshes.
 */

interface WishlistState {
  entries: Array<{ productId: number; addedAt: string }>
  setEntries: (entries: Array<{ productId: number; addedAt: string }>) => void
  toggle: (product: Product | number) => void
  add: (productId: number) => void
  remove: (productId: number) => void
  clear: () => void
  has: (productId: number) => boolean
  ids: () => number[]
}

export const useWishlistStore = create<WishlistState>()(
  persist(
    (set, get) => ({
      entries: [],

      setEntries(entries) {
        set({ entries })
      },

      toggle(product) {
        const productId = typeof product === 'number' ? product : product.id
        const exists = get().entries.some((e) => e.productId === productId)
        if (exists) {
          set({ entries: get().entries.filter((e) => e.productId !== productId) })
        } else {
          set({ entries: [{ productId, addedAt: new Date().toISOString() }, ...get().entries] })
        }
      },

      add(productId) {
        if (get().entries.some((e) => e.productId === productId)) return
        set({ entries: [{ productId, addedAt: new Date().toISOString() }, ...get().entries] })
      },

      remove(productId) {
        set({ entries: get().entries.filter((e) => e.productId !== productId) })
      },

      clear() {
        set({ entries: [] })
      },

      has(productId) {
        return get().entries.some((e) => e.productId === productId)
      },

      ids() {
        return get().entries.map((e) => e.productId)
      },
    }),
    { name: 'shopio.wishlist' },
  ),
)

export function useWishlistCount() {
  return useWishlistStore((s) => s.entries.length)
}

export function useIsWishlisted(productId: number) {
  return useWishlistStore((s) => s.entries.some((e) => e.productId === productId))
}
