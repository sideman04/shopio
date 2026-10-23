import { Link } from 'react-router-dom'
import { Heart, ShoppingCart } from 'lucide-react'
import type { Product } from '@/types'
import { cn, discountPercent, formatCurrency } from '@/lib/utils'
import { SmartImage } from '@/components/ui/SmartImage'
import { Stars } from '@/components/ui/Rating'
import { Badge } from '@/components/ui/Badge'
import { useWishlistStore } from '@/context/wishlistStore'
import { toast } from '@/context/uiStore'
import { cartService, productService } from '@/services'

interface ProductCardProps {
  product: Product
  className?: string
  /** `grid` for catalog grids, `compact` for rails, `list` for horizontal rows. */
  layout?: 'grid' | 'compact' | 'list'
  showSeller?: boolean
}

export function ProductCard({ product, className, layout = 'grid', showSeller = false }: ProductCardProps) {
  const wishlisted = useWishlistStore((s) => s.entries.some((e) => e.productId === product.id))

  const primary = product.images.find((i) => i.isPrimary) ?? product.images[0]
  const secondary = product.images[1] ?? primary
  const defaultVariant = product.variants.find((v) => v.isDefault) ?? product.variants[0]
  const prices = product.variants.map((v) => v.price).filter((price) => price > 0)
  const minPrice = prices.length ? Math.min(...prices) : (product.minPrice ?? 0)
  const maxPrice = prices.length ? Math.max(...prices) : (product.maxPrice ?? minPrice)
  const compareAt = defaultVariant?.compareAtPrice ?? null
  const discount = discountPercent(minPrice, compareAt)
  const stock = product.variants.length
    ? product.variants.reduce((sum, v) => sum + v.stock, 0)
    : (product.availableStock ?? 0)
  const hasMultiplePrices = minPrice !== maxPrice
  const href = `/product/${product.slug}`

  const handleAddToCart = async (event: React.MouseEvent) => {
    event.preventDefault()
    try {
      const full =
        product.variants.length > 0 ? product : await productService.getProductBySlug(product.slug)
      if (!full) {
        toast.error('Product unavailable', 'This product could not be loaded.')
        return
      }
      const variant = full.variants.find((v) => v.isDefault) ?? full.variants[0]
      if (!variant || variant.stock <= 0) {
        toast.error('Out of stock', 'This product is currently unavailable.')
        return
      }
      await cartService.addToCart(full, variant, 1)
      toast.success('Added to cart', `${full.name} — ${formatCurrency(variant.price)}`, {
        label: 'View cart',
        href: '/cart',
      })
    } catch (error) {
      toast.error('Could not add to cart', error instanceof Error ? error.message : 'Please try again.')
    }
  }

  const handleWishlist = async (event: React.MouseEvent) => {
    event.preventDefault()
    try {
      await cartService.toggleWishlist(product.id)
      toast.success(wishlisted ? 'Removed from wishlist' : 'Saved to wishlist', product.name)
    } catch (error) {
      toast.error('Wishlist not updated', error instanceof Error ? error.message : 'Please try again.')
    }
  }

  /* ------------------------------- List layout ------------------------------ */
  if (layout === 'list') {
    return (
      <article className={cn('group flex gap-4 rounded-card border border-ink-200 bg-white p-3', className)}>
        <Link to={href} className="w-28 shrink-0 sm:w-36">
          <SmartImage
            src={primary?.imageUrl ?? product.primaryImage ?? undefined}
            alt={product.name}
            wrapperClassName="aspect-square rounded-lg"
            className="transition-transform duration-500 group-hover:scale-105"
          />
        </Link>
        <div className="flex min-w-0 flex-1 flex-col">
          <p className="text-xs text-ink-500">{product.categoryName}</p>
          <h3 className="mt-0.5 line-clamp-2 text-sm font-medium text-ink">
            <Link to={href} className="hover:underline">
              {product.name}
            </Link>
          </h3>
          {product.reviewCount > 0 && product.rating > 0 && (
            <Stars rating={product.rating} reviewCount={product.reviewCount} size="sm" className="mt-1.5" />
          )}
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-base font-semibold text-ink">{formatCurrency(minPrice)}</span>
            {discount > 0 && compareAt && (
              <span className="text-xs text-ink-400 line-through">{formatCurrency(compareAt)}</span>
            )}
          </div>
          <div className="mt-auto flex items-center gap-2 pt-3">
            <button
              type="button"
              onClick={handleAddToCart}
              disabled={stock <= 0}
              className="inline-flex h-9 flex-1 items-center justify-center gap-2 rounded-lg bg-ink px-3 text-xs font-medium text-white transition hover:bg-ink-800 disabled:cursor-not-allowed disabled:bg-ink-300"
            >
              <ShoppingCart className="h-3.5 w-3.5" />
              {stock <= 0 ? 'Out of stock' : 'Add to cart'}
            </button>
            <button
              type="button"
              onClick={handleWishlist}
              aria-label={wishlisted ? 'Remove from wishlist' : 'Save to wishlist'}
              aria-pressed={wishlisted}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-ink-200 text-ink transition hover:border-ink-400"
            >
              <Heart className={cn('h-4 w-4', wishlisted && 'fill-ink text-ink')} />
            </button>
          </div>
        </div>
      </article>
    )
  }

  /* ------------------------------ Grid / compact ---------------------------- */
  return (
    <article className={cn('product-card group flex flex-col', className)}>
      <div className="relative overflow-hidden rounded-lg bg-sand-50">
        <Link to={href} aria-label={product.name} className="block">
          <SmartImage
            src={primary?.imageUrl ?? product.primaryImage ?? undefined}
            alt={product.name}
            wrapperClassName="aspect-square"
            className="transition-transform duration-500 group-hover:scale-[1.04]"
          />
          {/* Secondary shot fades in on hover for a premium catalog feel. */}
          {secondary && secondary.imageUrl !== primary?.imageUrl && (
            <SmartImage
              src={secondary.imageUrl}
              alt=""
              aria-hidden="true"
              wrapperClassName={cn(
                'absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100',
                'aspect-square',
              )}
            />
          )}
        </Link>

        <div className="pointer-events-none absolute left-2.5 top-2.5 flex flex-col items-start gap-1.5">
          {discount > 0 && (
            <Badge tone="dark" size="sm">
              −{discount}%
            </Badge>
          )}
          {product.tags?.includes('new-arrival') && <Badge tone="gold" size="sm">New</Badge>}
          {stock <= 0 && <Badge tone="warning" size="sm">Out of stock</Badge>}
        </div>

        <button
          type="button"
          onClick={handleWishlist}
          aria-label={wishlisted ? `Remove ${product.name} from wishlist` : `Save ${product.name} to wishlist`}
          aria-pressed={wishlisted}
          className="absolute right-2.5 top-2.5 inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/95 text-ink shadow-card transition hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/70"
        >
          <Heart className={cn('h-4 w-4', wishlisted && 'fill-ink text-ink')} />
        </button>
      </div>

      <div className="mt-3 flex flex-1 flex-col">
        {showSeller && product.sellerName && (
          <p className="text-[11px] uppercase tracking-wide text-ink-400">{product.sellerName}</p>
        )}
        <h3 className={cn('min-h-10 font-medium text-ink', layout === 'compact' ? 'line-clamp-2 text-sm' : 'line-clamp-2 text-sm sm:text-[15px]')}>
          <Link to={href} className="transition-colors hover:text-ink-600">
            {product.name}
          </Link>
        </h3>

        {product.reviewCount > 0 && product.rating > 0 && (
          <Stars rating={product.rating} reviewCount={product.reviewCount} size="sm" className="mt-1.5" />
        )}

        <div className="mt-2 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <span className="text-base font-semibold text-ink">
            {formatCurrency(minPrice)}
            {hasMultiplePrices && <span className="text-xs font-normal text-ink-400"> +</span>}
          </span>
          {discount > 0 && compareAt && (
            <span className="text-xs text-ink-400 line-through">{formatCurrency(compareAt)}</span>
          )}
        </div>

        <button
          type="button"
          onClick={handleAddToCart}
          disabled={stock <= 0}
          className={cn(
            'mt-3 inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg text-sm font-medium transition-colors',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/70 focus-visible:ring-offset-2',
            stock <= 0
              ? 'cursor-not-allowed border border-ink-200 text-ink-400'
              : 'border border-ink-200 text-ink hover:border-ink hover:bg-ink hover:text-white',
          )}
        >
          <ShoppingCart className="h-4 w-4" aria-hidden="true" />
          {stock <= 0 ? 'Out of stock' : 'Add to cart'}
        </button>
      </div>
    </article>
  )
}
