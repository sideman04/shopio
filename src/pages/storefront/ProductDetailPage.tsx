import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  ChevronRight,
  Heart,
  Package,
  RefreshCcw,
  ShoppingCart,
  Store,
  Truck,
} from 'lucide-react'
import type { Product, ProductVariant } from '@/types'
import { ProductGallery } from '@/components/products/ProductGallery'
import { VariantSelector } from '@/components/products/VariantSelector'
import { ProductRail } from '@/components/storefront/ProductRail'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Breadcrumbs } from '@/components/ui/Breadcrumbs'
import { EmptyState } from '@/components/ui/EmptyState'
import { RatingInput, Stars } from '@/components/ui/Rating'
import { QuantitySelector } from '@/components/ui/QuantitySelector'
import { Tabs } from '@/components/ui/Tabs'
import { Textarea, Input } from '@/components/ui/Input'
import { Avatar } from '@/components/ui/Avatar'
import { Alert } from '@/components/ui/Alert'
import { formatCurrency, formatDate, relativeTime } from '@/lib/utils'
import { useCatalogStore, useProductBySlug } from '@/context/catalogStore'
import { usePeopleStore, useSeller } from '@/context/peopleStore'
import { useWishlistStore } from '@/context/wishlistStore'
import { useBrowseStore, toast } from '@/context/uiStore'
import { useIsAuthenticated } from '@/context/authStore'
import { cartService, catalogService, productService, reviewService } from '@/services'

/** Full product detail page: gallery, variants, reviews and related items. */
export default function ProductDetailPage() {
  const { slug = '' } = useParams()
  const product = useProductBySlug(slug)

  const wishlistEntries = useWishlistStore((s) => s.entries)
  const allReviews = useCatalogStore((s) => s.reviews)
  const viewProduct = useBrowseStore((s) => s.viewProduct)
  const authenticated = useIsAuthenticated()
  const seller = useSeller(product?.sellerId)
  const upsertSeller = usePeopleStore((s) => s.upsertSeller)

  const [variant, setVariant] = useState<ProductVariant | undefined>()
  const [quantity, setQuantity] = useState(1)
  const [related, setRelated] = useState<Product[]>([])
  const [relatedLoading, setRelatedLoading] = useState(true)
  const [reviewRating, setReviewRating] = useState(5)
  const [reviewTitle, setReviewTitle] = useState('')
  const [reviewText, setReviewText] = useState('')
  const [reviewError, setReviewError] = useState<string | undefined>()
  const [submitting, setSubmitting] = useState(false)
  const [hydrating, setHydrating] = useState(true)

  // Direct links and offline launches may only have the lightweight catalogue
  // summary. Hydrate variants, images and options from the detail endpoint.
  useEffect(() => {
    if (!slug) return
    const current = useCatalogStore.getState().products.find((item) => item.slug === slug)
    if (current && current.variants.length > 0) {
      setHydrating(false)
      return
    }

    let active = true
    setHydrating(true)
    // `getProductBySlug` upserts the full record, which re-renders this page.
    void productService.getProductBySlug(slug).finally(() => {
      if (active) setHydrating(false)
    })
    return () => {
      active = false
    }
  }, [slug])

  // Reset the selection whenever the product changes.
  useEffect(() => {
    if (!product) return
    const initial = product.variants.find((v) => v.isDefault) ?? product.variants[0]
    setVariant(initial)
    setQuantity(1)
    viewProduct(product.id)

    if (product.sellerSlug) {
      void catalogService.fetchStore(product.sellerSlug).then((fetched) => {
        if (fetched) upsertSeller(fetched)
      })
    }
  }, [product, viewProduct, upsertSeller])

  useEffect(() => {
    if (!product) return
    let cancelled = false
    setRelatedLoading(true)
    productService
      .getRelatedProducts(product, 4)
      .then((items) => {
        if (!cancelled) setRelated(items)
      })
      .catch(() => {
        if (!cancelled) setRelated([])
      })
      .finally(() => {
        if (!cancelled) setRelatedLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [product])

  const reviews = useMemo(
    () => (product ? allReviews.filter((r) => r.productId === product.id && r.status === 'published') : []),
    [allReviews, product],
  )

  const breakdown = useMemo(() => {
    const buckets = [5, 4, 3, 2, 1].map((star) => ({
      star,
      count: reviews.filter((r) => Math.round(r.rating) === star).length,
    }))
    return buckets
  }, [reviews])

  if (!product) {
    return (
      <div className="container-page py-20">
        <EmptyState
          icon={<Package className="h-5 w-5" />}
          title="Product not found"
          description="This product may have been removed or the link is incorrect."
          action={{ label: 'Back to shop', to: '/shop' }}
          secondaryAction={{ label: 'Browse categories', to: '/categories' }}
        />
      </div>
    )
  }

  const selected = variant ?? product.variants[0]
  const price = selected?.price ?? product.minPrice ?? 0
  const stock = selected?.stock ?? 0
  const compareAt = selected?.compareAtPrice ?? null
  const discount = compareAt && compareAt > price
    ? Math.round(((compareAt - price) / compareAt) * 100)
    : 0
  const totalStock = product.variants.length > 0
    ? product.variants.reduce((sum, v) => sum + v.stock, 0)
    : (product.availableStock ?? 0)
  const canPurchase = Boolean(selected) && stock > 0

  const handleAdd = () => {
    if (!selected || stock <= 0) {
      toast.error('Out of stock', 'This variant is currently unavailable.')
      return
    }
    void cartService
      .addToCart(product, selected, quantity)
      .then(() =>
        toast.success('Added to cart', `${quantity} × ${product.name}`, { label: 'View cart', href: '/cart' }),
      )
      .catch((error) =>
        toast.error('Could not add to cart', error instanceof Error ? error.message : 'Please try again.'),
      )
  }

  const wishlisted = wishlistEntries.some((entry) => entry.productId === product.id)

  const handleWishlist = () => {
    void cartService
      .toggleWishlist(product.id)
      .then(() =>
        toast.success(
          wishlisted ? 'Removed from wishlist' : 'Saved to wishlist',
          product.name,
        ),
      )
      .catch((error) =>
        toast.error('Wishlist not updated', error instanceof Error ? error.message : 'Please try again.'),
      )
  }

  const submitReview = async (event: React.FormEvent) => {
    event.preventDefault()
    if (reviewText.trim().length < 10) {
      setReviewError('Please write at least 10 characters so your review is useful.')
      return
    }
    setReviewError(undefined)
    setSubmitting(true)
    try {
      await reviewService.submitReview({
        productId: product.id,
        rating: reviewRating,
        title: reviewTitle.trim() || 'Review',
        reviewText: reviewText.trim(),
        productName: product.name,
      })
      setReviewTitle('')
      setReviewText('')
      setReviewRating(5)
      toast.success(
        'Review submitted',
        'Reviews are held for moderation before they appear on the product page.',
      )
    } catch (error) {
      toast.error('Review not submitted', error instanceof Error ? error.message : 'Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="pb-16">
      <div className="container-page pt-6">
        <Breadcrumbs
          items={[
            { label: 'Shop', to: '/shop' },
            ...(product.categorySlug && product.categoryName
              ? [{ label: product.categoryName, to: `/categories/${product.categorySlug}` }]
              : []),
            { label: product.name },
          ]}
        />
      </div>

      <div className="container-page grid gap-10 pt-6 lg:grid-cols-2 lg:gap-14">
        <ProductGallery
          images={product.images}
          productName={product.name}
          overlay={
            discount > 0 ? (
              <Badge tone="dark" size="sm">
                −{discount}%
              </Badge>
            ) : undefined
          }
        />

        <div>
          <div className="flex flex-wrap items-center gap-2">
            {product.categoryName && (
              <Link
                to={`/categories/${product.categorySlug}`}
                className="text-xs font-semibold uppercase tracking-wide text-ink-500 hover:text-ink"
              >
                {product.categoryName}
              </Link>
            )}
            {product.conditionType !== 'new' && <Badge tone="neutral" size="sm">{product.conditionType}</Badge>}
            {totalStock <= 0 && <Badge tone="warning" size="sm">Out of stock</Badge>}
          </div>

          <h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">{product.name}</h1>

          <div className="mt-3 flex flex-wrap items-center gap-4">
            {product.reviewCount > 0 && product.rating > 0 ? (
              <Stars rating={product.rating} showValue reviewCount={product.reviewCount} />
            ) : (
              <span className="text-sm text-ink-500">No reviews yet</span>
            )}
            <span className="text-sm text-ink-500">
              {product.soldCount > 0 ? `${product.soldCount} sold` : 'New listing'}
            </span>
          </div>

          {product.shortDescription && (
            <p className="mt-4 text-sm leading-relaxed text-ink-600">{product.shortDescription}</p>
          )}

          <div className="mt-5 flex flex-wrap items-baseline gap-3">
            <span className="text-3xl font-bold text-ink">{formatCurrency(price)}</span>
            {discount > 0 && compareAt && (
              <>
                <span className="text-base text-ink-400 line-through">{formatCurrency(compareAt)}</span>
                <Badge tone="danger">Save {discount}%</Badge>
              </>
            )}
          </div>
          <p className="mt-1 text-xs text-ink-500">
            <Link to="/shipping-returns" className="link-underline">View delivery and returns information</Link>
          </p>

          {!hydrating && product.variants.length === 0 && (
            <Alert tone="warning" className="mt-4" title="Limited offline view">
              Reconnect to load the available options and exact stock before adding this item to your
              cart.
            </Alert>
          )}

          <div className="mt-6 border-t border-ink-200 pt-6">
            <VariantSelector product={product} selectedVariant={selected} onChange={setVariant} />
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <QuantitySelector value={quantity} onChange={setQuantity} max={Math.max(1, stock)} disabled={!canPurchase} />
            <Button size="lg" onClick={handleAdd} disabled={!canPurchase} className="flex-1 sm:flex-none">
              <ShoppingCart className="h-4 w-4" />
              {!selected
                ? hydrating
                  ? 'Loading options…'
                  : 'Connect to buy'
                : stock <= 0
                  ? 'Out of stock'
                  : 'Add to cart'}
            </Button>
            <Button
              variant="outline"
              size="lg"
              onClick={handleWishlist}
              aria-pressed={wishlisted}
              aria-label={wishlisted ? 'Remove from wishlist' : 'Save to wishlist'}
            >
              <Heart className={wishlisted ? 'h-4 w-4 fill-ink' : 'h-4 w-4'} />
              <span className="hidden sm:inline">{wishlisted ? 'Saved' : 'Save'}</span>
            </Button>
          </div>

          {/* Trust micro-list */}
          <ul className="mt-5 grid gap-3 text-sm text-ink-600 sm:grid-cols-2">
            <li className="flex items-center gap-2.5">
              <Truck className="h-4 w-4 text-ink-400" aria-hidden="true" />
              Delivery details at checkout
            </li>
            <li className="flex items-center gap-2.5">
              <RefreshCcw className="h-4 w-4 text-ink-400" aria-hidden="true" />
              <Link to="/shipping-returns" className="link-underline">Returns policy</Link>
            </li>
          </ul>

          {/* Seller card */}
          {seller && (
            <div className="mt-6 flex items-center gap-4 rounded-card border border-ink-200 bg-ink-50/60 p-4">
              <Avatar name={seller.storeName} src={seller.logoUrl} size="lg" />
              <div className="min-w-0 flex-1">
                <p className="text-xs uppercase tracking-wide text-ink-400">Sold by</p>
                <p className="truncate text-sm font-semibold text-ink">{seller.storeName}</p>
                <div className="mt-1 flex items-center gap-2">
                  {seller.reviewCount && seller.reviewCount > 0 && seller.rating && seller.rating > 0 ? (
                    <Stars rating={seller.rating} size="sm" showValue reviewCount={seller.reviewCount} />
                  ) : (
                    <span className="text-xs text-ink-500">No reviews yet</span>
                  )}
                </div>
              </div>
              <Button variant="outline" size="sm" to={`/search?q=${encodeURIComponent(seller.storeName)}`}>
                <Store className="h-4 w-4" />
                Visit store
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* ------------------------------ Details ------------------------------ */}
      <div className="container-page mt-14">
        <Tabs
          items={[
            { id: 'description', label: 'Description' },
            { id: 'specs', label: 'Specifications' },
            { id: 'reviews', label: `Reviews (${reviews.length})` },
          ]}
          panels={{
            description: (
              <div className="max-w-3xl py-6 text-sm leading-relaxed text-ink-600">
                <p className="whitespace-pre-line">
                  {product.description ?? 'No description has been provided for this product yet.'}
                </p>
              </div>
            ),
            specs: (
              <div className="grid max-w-3xl gap-x-8 gap-y-4 py-6 sm:grid-cols-2">
                {[
                  { label: 'Brand', value: product.brand ?? '—' },
                  { label: 'Category', value: product.categoryName ?? '—' },
                  { label: 'Condition', value: product.conditionType },
                  { label: 'SKU', value: selected?.sku ?? '—' },
                  { label: 'Variants', value: String(product.variants.length) },
                  { label: 'In stock', value: `${totalStock} units` },
                  { label: 'Listed', value: formatDate(product.createdAt) },
                  { label: 'Seller', value: seller?.storeName ?? '—' },
                ].map((row) => (
                  <div key={row.label} className="flex justify-between gap-4 border-b border-ink-100 pb-2">
                    <dt className="text-ink-500">{row.label}</dt>
                    <dd className="font-medium capitalize text-ink">{row.value}</dd>
                  </div>
                ))}
              </div>
            ),
            reviews: (
              <div className="grid gap-10 py-6 lg:grid-cols-[300px_1fr]">
                {/* Summary + breakdown */}
                <div>
                  <div className="rounded-card border border-ink-200 bg-white p-5 shadow-card">
                    <p className="text-4xl font-bold text-ink">{product.rating.toFixed(1)}</p>
                    <Stars rating={product.rating} className="mt-1" />
                    <p className="mt-1 text-sm text-ink-500">{reviews.length} published reviews</p>

                    <ul className="mt-4 space-y-2">
                      {breakdown.map((row) => {
                        const pct = reviews.length ? (row.count / reviews.length) * 100 : 0
                        return (
                          <li key={row.star} className="flex items-center gap-3 text-sm">
                            <span className="w-6 text-ink-500">{row.star}★</span>
                            <span className="h-2 flex-1 overflow-hidden rounded-full bg-ink-100">
                              <span className="block h-full rounded-full bg-gold-500" style={{ width: `${pct}%` }} />
                            </span>
                            <span className="w-8 text-right text-xs text-ink-500">{row.count}</span>
                          </li>
                        )
                      })}
                    </ul>
                  </div>

                  {/* Write a review */}
                  <form onSubmit={submitReview} className="mt-6 rounded-card border border-ink-200 bg-white p-5 shadow-card">
                    <h3 className="text-sm font-semibold text-ink">Write a review</h3>
                    {!authenticated && (
                      <Alert tone="info" className="mt-3">
                        You are browsing as a guest.{' '}
                        <Link to="/login" className="font-medium underline">
                          Sign in
                        </Link>{' '}
                        to attach your name to a review.
                      </Alert>
                    )}
                    <div className="mt-3">
                      <span className="mb-1.5 block text-sm font-medium text-ink">Your rating</span>
                      <RatingInput value={reviewRating} onChange={setReviewRating} />
                    </div>
                    <div className="mt-3 space-y-3">
                      <Input
                        label="Title"
                        placeholder="Summarise your experience"
                        value={reviewTitle}
                        onChange={(e) => setReviewTitle(e.target.value)}
                      />
                      <Textarea
                        label="Review"
                        rows={4}
                        placeholder="What did you like or dislike?"
                        value={reviewText}
                        error={reviewError}
                        onChange={(e) => {
                          setReviewText(e.target.value)
                          if (reviewError) setReviewError(undefined)
                        }}
                      />
                    </div>
                    <Button type="submit" loading={submitting} className="mt-4" fullWidth>
                      Submit review
                    </Button>
                  </form>
                </div>

                {/* Review list */}
                <div className="space-y-6">
                  {reviews.length === 0 ? (
                    <EmptyState
                      size="sm"
                      title="No reviews yet"
                      description="Be the first to share your thoughts on this product."
                    />
                  ) : (
                    reviews.map((review) => (
                      <article key={review.id} className="rounded-card border border-ink-200 bg-white p-5 shadow-card">
                        <div className="flex items-start gap-3">
                          <Avatar name={review.customerName ?? 'Customer'} src={review.customerAvatar} size="md" />
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <p className="text-sm font-semibold text-ink">{review.customerName ?? 'Shopio Customer'}</p>
                              <span className="text-xs text-ink-500">{relativeTime(review.createdAt)}</span>
                            </div>
                            <Stars rating={review.rating} size="sm" className="mt-1" />
                            {review.title && <p className="mt-2 text-sm font-medium text-ink">{review.title}</p>}
                            {review.reviewText && (
                              <p className="mt-1 text-sm leading-relaxed text-ink-600">{review.reviewText}</p>
                            )}
                            {review.sellerReply && (
                              <div className="mt-3 rounded-lg bg-sand-100 p-3">
                                <p className="flex items-center gap-1.5 text-xs font-semibold text-ink-600">
                                  <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
                                  Reply from {seller?.storeName ?? 'the seller'}
                                </p>
                                <p className="mt-1 text-sm text-ink-700">{review.sellerReply}</p>
                              </div>
                            )}
                          </div>
                        </div>
                      </article>
                    ))
                  )}
                </div>
              </div>
            ),
          }}
        />
      </div>

      <ProductRail
        eyebrow="You may also like"
        title="Related products"
        products={related}
        loading={relatedLoading}
        className="mt-16"
      />

      <p className="container-page mt-12 text-xs text-ink-400">
        Product imagery is representative. Prices and availability are subject to change.
      </p>
    </div>
  )
}
