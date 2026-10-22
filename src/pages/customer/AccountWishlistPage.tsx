import { useState } from 'react'
import { Heart, ShoppingCart, Trash2 } from 'lucide-react'
import type { Product } from '@/types'
import { Button, ConfirmDialog, EmptyState, PageHeader } from '@/components/ui'
import { ProductCard } from '@/components/products/ProductCard'
import { toast, useCartStore, useCatalogStore, useWishlistStore } from '@/context'
import { cartService } from '@/services'

/** The customer's saved products, backed by the persisted wishlist store. */
export default function AccountWishlistPage() {
  const entries = useWishlistStore((s) => s.entries)
  const products = useCatalogStore((s) => s.products)
  const [clearOpen, setClearOpen] = useState(false)

  const wishlisted = entries
    .map((entry) => products.find((p) => p.id === entry.productId))
    .filter((p): p is Product => Boolean(p))

  const moveAllToCart = () => {
    let added = 0
    let skipped = 0

    wishlisted.forEach((product) => {
      const variant = product.variants.find((v) => v.isDefault) ?? product.variants[0]
      if (!variant || variant.stock <= 0) {
        skipped += 1
        return
      }
      useCartStore.getState().addItem(product, variant, 1)
      added += 1
    })

    if (added > 0) {
      toast.success(
        'Added to cart',
        `${added} ${added === 1 ? 'item' : 'items'} moved from your wishlist.`,
        { label: 'View cart', href: '/cart' },
      )
    }
    if (skipped > 0) {
      toast.warning(
        'Some items skipped',
        `${skipped} ${skipped === 1 ? 'item is' : 'items are'} out of stock and were not added.`,
      )
    }
  }

  const clearWishlist = async () => {
    try {
      await Promise.all(wishlisted.map((product) => cartService.removeFromWishlist(product.id)))
      setClearOpen(false)
      toast.success('Wishlist cleared', 'All saved items have been removed.')
    } catch {
      toast.error('Could not clear wishlist', 'Please try again.')
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="My wishlist"
        description="Items you have saved for later. Your wishlist is synced to your account."
        actions={
          wishlisted.length > 0 ? (
            <>
              <Button variant="outline" onClick={() => setClearOpen(true)}>
                <Trash2 className="h-4 w-4" /> Clear wishlist
              </Button>
              <Button onClick={moveAllToCart}>
                <ShoppingCart className="h-4 w-4" /> Move all to cart
              </Button>
            </>
          ) : undefined
        }
      />

      {wishlisted.length === 0 ? (
        <EmptyState
          icon={<Heart className="h-5 w-5" />}
          title="Your wishlist is empty"
          description="Save products you love and they will appear here for a quick return visit."
          action={{ label: 'Browse products', to: '/shop' }}
        />
      ) : (
        <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4">
          {wishlisted.map((product) => (
            <ProductCard key={product.id} product={product} showSeller />
          ))}
        </div>
      )}

      <p className="text-xs text-ink-500">
        Your wishlist is synced to your account.
      </p>

      <ConfirmDialog
        open={clearOpen}
        onClose={() => setClearOpen(false)}
        onConfirm={clearWishlist}
        title="Clear your wishlist?"
        description="This removes every saved item. It cannot be undone."
        confirmLabel="Clear wishlist"
        tone="danger"
      />
    </div>
  )
}
