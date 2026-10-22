import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { CreditCard, Lock, MapPin, ShoppingBag, Smartphone, User } from 'lucide-react'
import type { Address, City, Region } from '@/types'
import { Breadcrumbs } from '@/components/ui/Breadcrumbs'
import { Button } from '@/components/ui/Button'
import { Input, Select, Textarea } from '@/components/ui/Input'
import { EmptyState } from '@/components/ui/EmptyState'
import { SmartImage } from '@/components/ui/SmartImage'
import { Alert } from '@/components/ui/Alert'
import { cn, formatCurrency } from '@/lib/utils'
import { computeTotals, useCartStore } from '@/context/cartStore'
import { useAddressesFor } from '@/context/accountStore'
import { useAuthStore, useIsAuthenticated } from '@/context/authStore'
import { toast } from '@/context/uiStore'
import { geoService, orderService } from '@/services'
import { ApiError } from '@/services/apiClient'

interface CheckoutForm {
  fullName: string
  email: string
  phone: string
  addressLine: string
  district: string
  regionId: string
  cityId: string
  postalCode: string
  instructions: string
  paymentMethod: string
  customerNote: string
}

const PAYMENT_METHODS = [
  { id: 'M-Pesa', label: 'M-Pesa', description: 'Vodacom mobile money', icon: Smartphone },
  { id: 'Tigo Pesa', label: 'Tigo Pesa', description: 'Tigo mobile money', icon: Smartphone },
  { id: 'Airtel Money', label: 'Airtel Money', description: 'Airtel mobile money', icon: Smartphone },
  { id: 'Card', label: 'Debit / credit card', description: 'Visa or Mastercard', icon: CreditCard },
  { id: 'Bank transfer', label: 'Bank transfer', description: 'Pay from your bank account', icon: Lock },
]

/** Checkout: contact, delivery, payment and order review. */
export default function CheckoutPage() {
  const navigate = useNavigate()
  const items = useCartStore((s) => s.items)
  const discount = useCartStore((s) => s.discount)
  const couponCode = useCartStore((s) => s.couponCode)
  const user = useAuthStore((s) => s.session?.user ?? null)
  const authenticated = useIsAuthenticated()
  const savedAddresses = useAddressesFor(user?.id)

  const [regions, setRegions] = useState<Region[]>([])
  const [cities, setCities] = useState<City[]>([])
  const [selectedAddressId, setSelectedAddressId] = useState<number | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const subtotal = items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0)
  const totals = computeTotals(subtotal, discount)

  const defaultAddress: Address | undefined = useMemo(
    () => savedAddresses.find((a) => a.isDefault) ?? savedAddresses[0],
    [savedAddresses],
  )

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<CheckoutForm>({
    defaultValues: {
      fullName: user?.fullName ?? '',
      email: user?.email ?? '',
      phone: user?.phone ?? '',
      addressLine: '',
      district: '',
      regionId: '',
      cityId: '',
      postalCode: '',
      instructions: '',
      paymentMethod: 'M-Pesa',
      customerNote: '',
    },
  })

  const regionId = watch('regionId')
  const paymentMethod = watch('paymentMethod')

  const cityOptions = useMemo(
    () =>
      cities
        .filter((c) => String(c.regionId) === regionId)
        .map((c) => ({ label: c.name, value: String(c.id) })),
    [cities, regionId],
  )

  useEffect(() => {
    void geoService.fetchRegions().then(setRegions).catch(() => setRegions([]))
    void geoService.fetchCities().then(setCities).catch(() => setCities([]))
  }, [])

  useEffect(() => {
    if (!defaultAddress || selectedAddressId != null) return
    const city = cities.find((c) => c.id === defaultAddress.cityId)
    setSelectedAddressId(defaultAddress.id)
    setValue('fullName', defaultAddress.recipientName)
    setValue('phone', defaultAddress.phone)
    setValue('addressLine', defaultAddress.streetAddress)
    setValue('district', defaultAddress.district ?? '')
    setValue('regionId', city ? String(city.regionId) : '')
    setValue('cityId', String(defaultAddress.cityId))
    setValue('postalCode', defaultAddress.postalCode ?? '')
    setValue('instructions', defaultAddress.deliveryInstructions ?? '')
  }, [defaultAddress, cities, selectedAddressId, setValue])

  if (items.length === 0) {
    return (
      <div className="container-page py-16">
        <EmptyState
          icon={<ShoppingBag className="h-5 w-5" />}
          title="Nothing to check out"
          description="Your cart is empty. Add a product before proceeding to checkout."
          action={{ label: 'Start shopping', to: '/shop' }}
        />
      </div>
    )
  }

  const applyAddress = (address: Address) => {
    const city = cities.find((c) => c.id === address.cityId)
    setSelectedAddressId(address.id)
    setValue('fullName', address.recipientName)
    setValue('phone', address.phone)
    setValue('addressLine', address.streetAddress)
    setValue('district', address.district ?? '')
    setValue('regionId', city ? String(city.regionId) : '')
    setValue('cityId', String(address.cityId))
    setValue('postalCode', address.postalCode ?? '')
    setValue('instructions', address.deliveryInstructions ?? '')
    toast.info('Address applied', `${address.label ?? 'Saved address'} copied into the form.`)
  }

  const onSubmit = handleSubmit(async (values) => {
    if (!authenticated) {
      navigate('/login', { state: { from: '/checkout' } })
      return
    }

    setSubmitting(true)
    try {
      const city = cities.find((c) => String(c.id) === values.cityId)
      const region = regions.find((r) => String(r.id) === values.regionId)

      const result = await orderService.createOrder({
        // When a saved address is selected the server uses it; the inline fields
        // remain available for a one-off delivery address.
        addressId: selectedAddressId ?? undefined,
        customerName: values.fullName.trim(),
        customerEmail: values.email.trim(),
        customerPhone: values.phone.trim(),
        shipping: {
          addressLine: values.addressLine.trim(),
          district: values.district.trim() || undefined,
          city: city?.name ?? '',
          region: region?.name ?? '',
          countryCode: 'TZ',
          postalCode: values.postalCode.trim() || undefined,
          instructions: values.instructions.trim() || undefined,
        },
        couponCode: couponCode || null,
        paymentProvider: 'sandbox',
        paymentMethod: values.paymentMethod,
        customerNote: values.customerNote.trim() || undefined,
      })

      toast.success('Order placed', `Order ${result.order.orderNumber} has been created.`)
      navigate(`/order-confirmation/${result.order.id}`)
    } catch (error) {
      // The session can expire while the checkout page is open. Send the
      // shopper back through sign-in instead of leaving them with a dead
      // "unauthenticated" error. The server cart is retained.
      if (error instanceof ApiError && error.status === 401) {
        toast.info(
          'Please sign in again',
          'Your session expired, but your cart is saved. Sign in to finish placing the order.',
        )
        navigate('/login', { state: { from: '/checkout' } })
        return
      }

      toast.error('Order not placed', error instanceof Error ? error.message : 'Please review your details and try again.')
    } finally {
      setSubmitting(false)
    }
  })

  return (
    <div>
      <div className="border-b border-ink-200 bg-sand-50">
        <div className="container-page py-8 sm:py-10">
          <Breadcrumbs items={[{ label: 'Cart', to: '/cart' }, { label: 'Checkout' }]} />
          <h1 className="mt-4 text-2xl font-bold tracking-tight sm:text-3xl">Checkout</h1>
          <p className="mt-2 text-sm text-ink-600">
            Confirm your delivery details and payment method. Totals are verified by the server when the order
            is placed.
          </p>
        </div>
      </div>

      <form onSubmit={onSubmit} className="container-page grid gap-10 py-8 lg:grid-cols-[1fr_360px]" noValidate>
        <div className="space-y-8">
          {authenticated && savedAddresses.length > 0 && (
            <section className="rounded-card border border-ink-200 bg-white p-5 shadow-card">
              <h2 className="flex items-center gap-2 text-base font-semibold text-ink">
                <MapPin className="h-4 w-4 text-ink-400" aria-hidden="true" />
                Saved addresses
              </h2>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {savedAddresses.map((address) => (
                  <button
                    key={address.id}
                    type="button"
                    onClick={() => applyAddress(address)}
                    aria-pressed={selectedAddressId === address.id}
                    className={cn(
                      'rounded-lg border p-3 text-left text-sm transition',
                      selectedAddressId === address.id
                        ? 'border-ink bg-ink-50'
                        : 'border-ink-200 hover:border-ink-400',
                    )}
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span className="font-medium text-ink">{address.label ?? 'Address'}</span>
                      {address.isDefault && <span className="text-xs text-ink-400">Default</span>}
                    </span>
                    <span className="mt-1 block text-ink-600">{address.streetAddress}</span>
                    <span className="block text-ink-500">
                      {address.cityName}, {address.regionName}
                    </span>
                  </button>
                ))}
              </div>
            </section>
          )}

          <section className="rounded-card border border-ink-200 bg-white p-5 shadow-card">
            <h2 className="flex items-center gap-2 text-base font-semibold text-ink">
              <User className="h-4 w-4 text-ink-400" aria-hidden="true" />
              Contact details
            </h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Input
                label="Full name"
                autoComplete="name"
                error={errors.fullName?.message}
                {...register('fullName', { required: 'Enter the recipient name.' })}
              />
              <Input
                label="Phone"
                type="tel"
                autoComplete="tel"
                placeholder="+255 7XX XXX XXX"
                error={errors.phone?.message}
                {...register('phone', { required: 'A delivery phone number is required.' })}
              />
              <Input
                label="Email"
                type="email"
                autoComplete="email"
                className="sm:col-span-2"
                error={errors.email?.message}
                {...register('email', {
                  required: 'An email address is required for your receipt.',
                  pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/, message: 'Enter a valid email address.' },
                })}
              />
            </div>
          </section>

          <section className="rounded-card border border-ink-200 bg-white p-5 shadow-card">
            <h2 className="flex items-center gap-2 text-base font-semibold text-ink">
              <MapPin className="h-4 w-4 text-ink-400" aria-hidden="true" />
              Delivery address
            </h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Input
                label="Street address"
                autoComplete="street-address"
                className="sm:col-span-2"
                error={errors.addressLine?.message}
                {...register('addressLine', { required: 'Enter the street address.' })}
              />
              <Input
                label="District / ward"
                error={errors.district?.message}
                {...register('district', { required: 'Enter the district or ward.' })}
              />
              <Select
                label="Region"
                placeholder="Select a region"
                options={regions.map((r) => ({ label: r.name, value: String(r.id) }))}
                error={errors.regionId?.message}
                {...register('regionId', { required: 'Choose a region.' })}
              />
              <Select
                label="City / district"
                placeholder={regionId ? 'Select a city' : 'Choose a region first'}
                options={cityOptions}
                error={errors.cityId?.message}
                {...register('cityId', { required: 'Choose a city.' })}
              />
              <Input label="Postal code" autoComplete="postal-code" {...register('postalCode')} />
              <Textarea
                label="Delivery instructions"
                rows={2}
                placeholder="Landmarks, gate colour, preferred delivery window…"
                className="sm:col-span-2"
                {...register('instructions')}
              />
            </div>
          </section>

          <section className="rounded-card border border-ink-200 bg-white p-5 shadow-card">
            <h2 className="flex items-center gap-2 text-base font-semibold text-ink">
              <CreditCard className="h-4 w-4 text-ink-400" aria-hidden="true" />
              Payment method
            </h2>
            <p className="mt-1 text-sm text-ink-500">
              Select how you would like to pay. The payment provider confirms the charge separately.
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {PAYMENT_METHODS.map((method) => {
                const Icon = method.icon
                const selected = paymentMethod === method.id
                return (
                  <label
                    key={method.id}
                    className={cn(
                      'flex cursor-pointer items-start gap-3 rounded-lg border p-3.5 transition',
                      selected ? 'border-ink bg-ink-50' : 'border-ink-200 hover:border-ink-400',
                    )}
                  >
                    <input
                      type="radio"
                      value={method.id}
                      className="sr-only"
                      {...register('paymentMethod', { required: true })}
                    />
                    <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-ink-600 shadow-card">
                      <Icon className="h-4 w-4" aria-hidden="true" />
                    </span>
                    <span>
                      <span className="block text-sm font-medium text-ink">{method.label}</span>
                      <span className="block text-xs text-ink-500">{method.description}</span>
                    </span>
                  </label>
                )
              })}
            </div>
          </section>

          <section className="rounded-card border border-ink-200 bg-white p-5 shadow-card">
            <h2 className="text-base font-semibold text-ink">Order notes</h2>
            <Textarea
              className="mt-3"
              rows={3}
              label="Anything the seller should know?"
              placeholder="Optional — e.g. preferred delivery day, gift wrapping."
              {...register('customerNote')}
            />
          </section>
        </div>

        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="rounded-card border border-ink-200 bg-white p-5 shadow-card">
            <h2 className="text-base font-semibold text-ink">Order review</h2>

            <ul className="mt-4 space-y-3">
              {items.map((item) => (
                <li key={item.variantId} className="flex items-center gap-3">
                  <SmartImage
                    src={item.imageUrl}
                    alt={item.name}
                    wrapperClassName="h-12 w-12 shrink-0 rounded-lg"
                    fallbackLabel={item.name}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-ink">{item.name}</p>
                    <p className="text-xs text-ink-500">
                      {item.variantName} · ×{item.quantity}
                    </p>
                  </div>
                  <span className="text-sm font-medium text-ink">
                    {formatCurrency(item.unitPrice * item.quantity)}
                  </span>
                </li>
              ))}
            </ul>

            <dl className="mt-5 space-y-2.5 border-t border-ink-200 pt-5 text-sm">
              <div className="flex justify-between">
                <dt className="text-ink-500">Subtotal</dt>
                <dd className="font-medium text-ink">{formatCurrency(totals.subtotal)}</dd>
              </div>
              {totals.discount > 0 && (
                <div className="flex justify-between">
                  <dt className="text-ink-500">Discount{couponCode ? ` (${couponCode})` : ''}</dt>
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
                <dt className="font-semibold text-ink">Estimated total</dt>
                <dd className="font-bold text-ink">{formatCurrency(totals.total)}</dd>
              </div>
            </dl>

            <Button type="submit" size="lg" fullWidth className="mt-5" loading={submitting}>
              <Lock className="h-4 w-4" />
              Place order
            </Button>

            <Alert tone="info" className="mt-4">
              The final total, stock availability and coupon eligibility are confirmed by the server when your
              order is placed.
            </Alert>
          </div>
        </aside>
      </form>
    </div>
  )
}
