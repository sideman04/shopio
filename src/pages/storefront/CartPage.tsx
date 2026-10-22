import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowRight, Tag, Trash2, Truck, X } from 'lucide-react'
import { Breadcrumbs } from '@/components/ui/Breadcrumbs'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { Input } from '@/components/ui/Input'
import { QuantitySelector } from '@/components/ui/QuantitySelector'
import { SmartImage } from '@/components/ui/SmartImage'
import { formatCurrency } from '@/lib/utils'
import { cartService } from '@/services'
import { computeTotals, FREE_SHIPPING_THRESHOLD, useCartStore } from '@/context/cartStore'
import { useIsAuthenticated } from '@/context/authStore'
import { toast } from '@/context/uiStore'
import { ShoppingCart } from 'lucide-react'

/** Shopping cart: line editing, coupon entry and the order summary. */
export default function CartPage() {
  const navigate = useNavigate()
  const items = useCartStore((s) => s.items)
  const couponCode = useCartStore((s) => s.couponCode)
  const discount = useCartStore((s) => s.discount)
  const removeCoupon = useCartStore((s) => s.removeCoupon)
  const authenticated = useIsAuthenticated()

  const [code, setCode] = useState('')
  const [codeError, setCodeError] = useState<string | undefined>()

  const subtotal = items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0)
  const totals = computeTotals(subtotal, discount)
  const remainingForFreeShipping = Math.max(0, FREE_SHIPPING_THRESHOLD - subtotal)
  const progress = Math.min(100, (subtotal / FREE_SHIPPING_THRESHOLD) * 100)

  const handleApply = async (event: React.FormEvent) => {
    event.preventDefault()
    const result = await cartService.applyCoupon(code.trim())
    if (!result.ok) {
      setCodeError(result.message)
      return
    }
    setCodeError(undefined)
    setCode('')
    toast.success('Coupon applied', `${result.coupon?.code ?? code} — you saved ${formatCurrency(result.discount)}.`)
  }

  const handleCheckout = () => {
    if (!authenticated) {
      navigate('/login', { state: { from: '/checkout' } })
      return
    }
    navigate('/checkout')
  }

  if (items.length === 0) {
    return (
      <div className="container-page py-16">
        <EmptyState
          icon={<ShoppingCart className="h-5 w-5" />}
          title="Your cart is empty"
          description="Browse the marketplace and add products to your cart to check out."
          action={{ label: 'Start shopping', to: '/shop' }}
          secondaryAction={{ label: 'View categories', to: '/categories' }}
        />
      </div>
    )
  }

  return (
    <div>
      <div className="border-b border-ink-200 bg-sand-50">
        <div className="container-page py-8 sm:py-10">
          <Breadcrumbs items={[{ label: 'Cart' }]} />
          <h1 className="mt-4 text-2xl font-bold tracking-tight sm:text-3xl">Your cart</h1>
          <p className="mt-2 text-sm text-ink-600">
            {items.length} line item{items.length === 1 ? '' : 's'} · prices in Tanzanian Shillings
          </p>
        </div>
      </div>

      <div className="container-page grid gap-10 py-8 lg:grid-cols-[1fr_360px]">
        {/* Line items */}
        <div>
          {/* Free-shipping progress */}
          <div className="mb-6 rounded-card border border-ink-200 bg-white p-4 shadow-card">
            <p className="flex items-center gap-2 text-sm text-ink-600">
              <Truck className="h-4 w-4 text-ink-400" aria-hidden="true" />
              {remainingForFreeShipping > 0 ? (
                <>
                  Spend <span className="font-semibold text-ink">{formatCurrency(remainingForFreeShipping)}</span> more for
                  free countrywide delivery.
                </>
              ) : (
                <span className="font-medium text-success-700">You have unlocked free delivery.</span>
              )}
            </p>
            <span className="mt-3 block h-2 overflow-hidden rounded-full bg-ink-100">
              <span className="block h-full rounded-full bg-ink transition-all" style={{ width: `${progress}%` }} />
            </span>
          </div>

          <ul className="divide-y divide-ink-100 overflow-hidden rounded-card border border-ink-200 bg-white shadow-card">
            {items.map((item) => (
              <li key={item.variantId} className="flex gap-4 p-4 sm:p-5">
                <Link to={`/product/${item.slug}`} className="w-20 shrink-0 sm:w-24">
                  <SmartImage
                    src={item.imageUrl}
                    alt={item.name}
                    wrapperClassName="aspect-square rounded-lg"
                    fallbackLabel={item.name}
                  />
                </Link>

                <div className="flex min-w-0 flex-1 flex-col">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className="line-clamp-2 text-sm font-medium text-ink sm:text-base">
                        <Link to={`/product/${item.slug}`} className="hover:underline">
                          {item.name}
                        </Link>
                      </h2>
                      <p className="mt-0.5 text-xs text-ink-500">
                        {item.variantName}
                        {item.sellerName && <> · {item.sellerName}</>}
                      </p>
                      <p className="mt-0.5 text-xs text-ink-400">SKU {item.sku}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        void cartService
                          .removeCartItem(item.variantId)
                          .then(() => toast.success('Removed from cart', item.name))
                          .catch((error) =>
                            toast.error('Could not remove item', error instanceof Error ? error.message : 'Please try again.'),
                          )
                      }}
                      aria-label={`Remove ${item.name} from cart`}
                      className="shrink-0 rounded-lg p-2 text-ink-400 transition hover:bg-danger-50 hover:text-danger-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/70"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="mt-auto flex flex-wrap items-center justify-between gap-3 pt-3">
                    <QuantitySelector
                      size="sm"
                      value={item.quantity}
                      max={Math.max(1, item.stock)}
                      onChange={(value) => {
                        void cartService.updateCartItem(item.variantId, value).catch((error) =>
                          toast.error('Could not update cart', error instanceof Error ? error.message : 'Please try again.'),
                        )
                      }}
                    />
                    <div className="text-right">
                      <p className="text-sm font-semibold text-ink">
                        {formatCurrency(item.unitPrice * item.quantity)}
                      </p>
                      <p className="text-xs text-ink-400">{formatCurrency(item.unitPrice)} each</p>
                    </div>
                  </div>

                  {item.quantity >= item.stock && (
                    <p className="mt-2 text-xs text-gold-600">Only {item.stock} in stock.</p>
                  )}
                </div>
              </li>
            ))}
          </ul>

          <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
            <Button variant="outline" to="/shop">
              Continue shopping
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                void cartService
                  .clearCart()
                  .then(() => toast.success('Cart cleared'))
                  .catch((error) =>
                    toast.error('Could not clear cart', error instanceof Error ? error.message : 'Please try again.'),
                  )
              }}
              className="text-danger-600 hover:bg-danger-50"
            >
              <Trash2 className="h-4 w-4" />
              Clear cart
            </Button>
          </div>
        </div>

        {/* Summary */}
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="rounded-card border border-ink-200 bg-white p-5 shadow-card">
            <h2 className="text-base font-semibold text-ink">Order summary</h2>

            {/* Coupon */}
            <form onSubmit={handleApply} className="mt-4">
              {couponCode ? (
                <div className="flex items-center justify-between rounded-lg border border-success-100 bg-success-50 px-3 py-2.5">
                  <span className="inline-flex items-center gap-2 text-sm font-medium text-success-700">
                    <Tag className="h-4 w-4" />
                    {couponCode}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      removeCoupon()
                      toast.info('Coupon removed')
                    }}
                    aria-label="Remove coupon"
                    className="rounded p-1 text-success-700 transition hover:bg-success-100"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : (
                <>
                  <label htmlFor="coupon" className="mb-1.5 block text-sm font-medium text-ink">
                    Promo code
                  </label>
                  <div className="flex gap-2">
                    <Input
                      id="coupon"
                      placeholder="e.g. SHOPIO10"
                      value={code}
                      error={codeError}
                      onChange={(e) => {
                        setCode(e.target.value)
                        if (codeError) setCodeError(undefined)
                      }}
                      className="flex-1"
                    />
                    <Button type="submit" variant="secondary" className="shrink-0">
                      Apply
                    </Button>
                  </div>
                </>
              )}
            </form>

            <dl className="mt-5 space-y-2.5 border-t border-ink-200 pt-5 text-sm">
              <div className="flex justify-between">
                <dt className="text-ink-500">Subtotal</dt>
                <dd className="font-medium text-ink">{formatCurrency(totals.subtotal)}</dd>
              </div>
              {totals.discount > 0 && (
                <div className="flex justify-between">
                  <dt className="text-ink-500">Discount</dt>
                  <dd className="font-medium text-success-700">−{formatCurrency(totals.discount)}</dd>
                </div>
              )}
              <div className="flex justify-between">
                <dt className="text-ink-500">Delivery</dt>
                <dd className="font-medium text-ink">
                  {totals.shipping === 0 ? 'Free' : formatCurrency(totals.shipping)}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-ink-500">VAT (18%)</dt>
                <dd className="font-medium text-ink">{formatCurrency(totals.tax)}</dd>
              </div>
              <div className="flex justify-between border-t border-ink-200 pt-3 text-base">
                <dt className="font-semibold text-ink">Total</dt>
                <dd className="font-bold text-ink">{formatCurrency(totals.total)}</dd>
              </div>
            </dl>

            <Button
              size="lg"
              fullWidth
              className="mt-5"
              onClick={handleCheckout}
            >
              {authenticated ? 'Proceed to checkout' : 'Sign in to checkout'}
              <ArrowRight className="h-4 w-4" />
            </Button>


          </div>
        </aside>
      </div>
    </div>
  )
}
