import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Product } from '@/types'

/**
 * Small UI-oriented store: toast notifications, recently viewed products and
 * recent searches. Kept separate from domain stores so it can be replaced by a
 * server-driven notification feed later.
 */

export type ToastVariant = 'success' | 'error' | 'info' | 'warning'

export interface Toast {
  id: string
  title: string
  description?: string
  variant: ToastVariant
  /** Optional inline action, e.g. "View cart". */
  action?: { label: string; href: string }
}

interface ToastState {
  toasts: Toast[]
  push: (toast: Omit<Toast, 'id'>) => string
  success: (title: string, description?: string, action?: Toast['action']) => string
  error: (title: string, description?: string) => string
  info: (title: string, description?: string, action?: Toast['action']) => string
  warning: (title: string, description?: string) => string
  dismiss: (id: string) => void
  clear: () => void
}

export const useToastStore = create<ToastState>((set, get) => ({
  toasts: [],

  push(toast) {
    const id = `toast_${Math.random().toString(36).slice(2, 9)}`
    set({ toasts: [...get().toasts, { ...toast, id }] })
    // Auto-dismiss; errors linger a little longer so they can be read.
    const ttl = toast.variant === 'error' ? 6000 : 4200
    setTimeout(() => get().dismiss(id), ttl)
    return id
  },

  success(title, description, action) {
    return get().push({ title, description, variant: 'success', action })
  },
  error(title, description) {
    return get().push({ title, description, variant: 'error' })
  },
  info(title, description, action) {
    return get().push({ title, description, variant: 'info', action })
  },
  warning(title, description) {
    return get().push({ title, description, variant: 'warning' })
  },

  dismiss(id) {
    set({ toasts: get().toasts.filter((t) => t.id !== id) })
  },

  clear() {
    set({ toasts: [] })
  },
}))

/** Imperative helper so non-component code (services) can raise toasts. */
export const toast = {
  success: (t: string, d?: string, a?: Toast['action']) => useToastStore.getState().success(t, d, a),
  error: (t: string, d?: string) => useToastStore.getState().error(t, d),
  info: (t: string, d?: string, a?: Toast['action']) => useToastStore.getState().info(t, d, a),
  warning: (t: string, d?: string) => useToastStore.getState().warning(t, d),
}

/* -------------------------------------------------------------------------- */
/* Recently viewed & recent searches                                           */
/* -------------------------------------------------------------------------- */

interface BrowseState {
  recentlyViewed: number[]
  recentSearches: string[]
  viewProduct: (product: Product | number) => void
  addSearch: (query: string) => void
  clearSearches: () => void
  clearRecentlyViewed: () => void
}

/** Recently viewed products and recent searches, persisted locally. */
export const useBrowseStore = create<BrowseState>()(
  persist(
    (set, get) => ({
      recentlyViewed: [],
      recentSearches: [],

      viewProduct(product) {
        const id = typeof product === 'number' ? product : product.id
        set({ recentlyViewed: [id, ...get().recentlyViewed.filter((x) => x !== id)].slice(0, 12) })
      },

      addSearch(query) {
        const q = query.trim()
        if (!q) return
        set({
          recentSearches: [
            q,
            ...get().recentSearches.filter((s) => s.toLowerCase() !== q.toLowerCase()),
          ].slice(0, 6),
        })
      },

      clearSearches() {
        set({ recentSearches: [] })
      },

      clearRecentlyViewed() {
        set({ recentlyViewed: [] })
      },
    }),
    { name: 'shopio.browse' },
  ),
)
