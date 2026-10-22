import { useMemo, useState } from 'react'
import { Heart, ShoppingCart, Trash2 } from 'lucide-react'
import { ProductGrid } from '@/components/products/ProductGrid'
import { Breadcrumbs } from '@/components/ui/Breadcrumbs'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { ConfirmDialog } from '@/components/ui/Drawer'
import { useCatalogStore } from '@/context/catalogStore'
import { useWishlistStore } from '@/context/wishlistStore'
import { useIsAuthenticated } from '@/context/authStore'
import { cartService, productService } from '@/services'
import { toast } from '@/context/uiStore'

/** Saved products. Adding to cart keeps the item in the wishlist. */
export default function WishlistPage() {
  const entries = useWishlistStore((s) => s.entries)
  const clear = useWishlistStore((s) => s.clear)
  const products = useCatalogStore((s) => s.products)
  const authenticated = useIsAuthenticated()
  const [confirmClear, setConfirmClear] = useState(false)

  const saved = useMemo(
    () =>
      entries
        .map((entry) => products.find((p) => p.id === entry.productId))
        .filter((p): p is NonNullable<typeof p> => Boolean(p)),
    [entries, products],
  )

  const addAllToCart = async () => {
    let added = 0
    for (const product of saved) {
      const full =
        product.variants.length > 0
          ? product
          : await productService.getProductBySlug(product.slug)
      if (!full) continue
      const variant = full.variants.find((v) => v.isDefault) ?? full.variants[0]
      if (!variant || variant.stock <= 0) continue
      try {
        await cartService.addToCart(full, variant, 1)
        added += 1
      } catch {
        // Skip lines that became unavailable; the rest still get added.
      }
    }
    if (added === 0) {
      toast.warning('Nothing to add', 'The saved products are currently out of stock.')
    } else {
      toast.success('Added to cart', `${added} item${added === 1 ? '' : 's'} moved to your cart.`, {
        label: 'View cart',
        href: '/cart',
      })
    }
  }

  const handleClear = async () => {
    try {
      for (const entry of entries) {
        await cartService.removeFromWishlist(entry.productId)
      }
      if (!authenticated) clear()
      setConfirmClear(false)
      toast.success('Wishlist cleared', 'All saved products were removed.')
    } catch (error) {
      toast.error('Could not clear wishlist', error instanceof Error ? error.message : 'Please try again.')
    }
  }

  return (
    <div>
      <div className="border-b border-ink-200 bg-sand-50">
        <div className="container-page py-8 sm:py-10">
          <Breadcrumbs items={[{ label: 'Wishlist' }]} />
          <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Your wishlist</h1>
              <p className="mt-2 text-sm text-ink-600">
                {saved.length} saved product{saved.length === 1 ? '' : 's'} ·{' '}
                {authenticated ? 'synced to your account' : 'stored on this device'}
              </p>
            </div>
            {saved.length > 0 && (
              <div className="flex flex-wrap gap-2">
                <Button onClick={addAllToCart}>
                  <ShoppingCart className="h-4 w-4" />
                  Add all to cart
                </Button>
                <Button variant="outline" onClick={() => setConfirmClear(true)}>
                  <Trash2 className="h-4 w-4" />
                  Clear wishlist
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="container-page py-8">
        {saved.length === 0 ? (
          <EmptyState
            icon={<Heart className="h-5 w-5" />}
            title="Your wishlist is empty"
            description="Tap the heart on any product to save it here for later."
            action={{ label: 'Browse products', to: '/shop' }}
            secondaryAction={{ label: 'View categories', to: '/categories' }}
          />
        ) : (
          <>
            <ProductGrid products={saved} columns={4} />
            <div className="mt-10 flex flex-wrap items-center justify-between gap-4 rounded-card border border-ink-200 bg-white p-5 shadow-card">
              <p className="text-sm text-ink-500">
                Prices and availability can change. We re-check stock when you add an item to your cart.
              </p>
              <Button variant="outline" to="/shop">
                Continue shopping
              </Button>
            </div>
          </>
        )}
      </div>

      <ConfirmDialog
        open={confirmClear}
        onClose={() => setConfirmClear(false)}
        onConfirm={handleClear}
        title="Clear your wishlist?"
        description={
          authenticated
            ? 'This removes every saved product from your account wishlist.'
            : 'This removes every saved product from your wishlist on this device.'
        }
        confirmLabel="Clear wishlist"
        tone="danger"
      />
    </div>
  )
}
