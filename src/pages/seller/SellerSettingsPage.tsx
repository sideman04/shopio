import { useEffect, useState } from 'react'
import { AlertTriangle, Bell, CreditCard, Package, Save, Truck } from 'lucide-react'
import {
  Alert,
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  ConfirmDialog,
  Input,
  PageHeader,
  Select,
  Switch,
  Tabs,
} from '@/components/ui'
import { useAuthStore } from '@/context'
import { toast } from '@/context/uiStore'
import { shippingCarriers } from '@/content/marketing'
import { geoService, sellerService } from '@/services'
import { errorMessage } from '@/services/apiClient'
import type { City, Region, Seller } from '@/types'

const TAB_ITEMS = [
  { id: 'notifications', label: 'Notifications' },
  { id: 'orders', label: 'Orders' },
  { id: 'shipping', label: 'Shipping' },
  { id: 'payments', label: 'Payments' },
  { id: 'danger', label: 'Danger zone' },
]

const HANDLING_TIME_OPTIONS = [
  { label: 'Same day', value: '0' },
  { label: '1 business day', value: '1' },
  { label: '2 business days', value: '2' },
  { label: '3 business days', value: '3' },
]

const AUTO_ACCEPT_OPTIONS = [
  { label: 'Manually accept every order', value: 'no' },
  { label: 'Automatically accept paid orders', value: 'paid' },
  { label: 'Automatically accept all orders', value: 'all' },
]

const PAYOUT_METHOD_OPTIONS = [
  { label: 'Bank transfer', value: 'Bank transfer' },
  { label: 'Mobile money', value: 'Mobile money' },
]

interface NotificationPrefs {
  newOrders: boolean
  lowStock: boolean
  reviews: boolean
  payouts: boolean
  marketing: boolean
}

interface OrderPrefs {
  handlingTime: string
  autoAccept: string
  confirmEmails: boolean
}

interface ShippingPrefs {
  regionId: string
  cityId: string
  carrier: string
  freeThreshold: string
  handling: string
}

interface PaymentPrefs {
  method: string
  accountName: string
  accountNumber: string
}

function readStored<T extends object>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key)
    if (!raw) return fallback
    return { ...fallback, ...(JSON.parse(raw) as Partial<T>) }
  } catch {
    return fallback
  }
}

function writeStored(key: string, value: unknown) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Storage can be unavailable (private mode); preferences then last for the session.
  }
}

export default function SellerSettingsPage() {
  const user = useAuthStore((s) => s.session?.user)
  const sellerId = user?.sellerId ?? null
  const storageKey = `shopio:seller-settings:${sellerId ?? 'anonymous'}`

  const [regions, setRegions] = useState<Region[]>([])
  const [cities, setCities] = useState<City[]>([])
  const [storeStatus, setStoreStatus] = useState<Seller['status']>('active')
  const [busy, setBusy] = useState(false)

  const [notifications, setNotifications] = useState<NotificationPrefs>(() =>
    readStored(`${storageKey}:notifications`, {
      newOrders: true,
      lowStock: true,
      reviews: true,
      payouts: true,
      marketing: false,
    }),
  )

  const [orders, setOrders] = useState<OrderPrefs>(() =>
    readStored(`${storageKey}:orders`, {
      handlingTime: '2',
      autoAccept: 'no',
      confirmEmails: true,
    }),
  )

  const [shipping, setShipping] = useState<ShippingPrefs>(() =>
    readStored(`${storageKey}:shipping`, {
      regionId: '',
      cityId: '',
      carrier: shippingCarriers[0] ?? '',
      freeThreshold: '',
      handling: '2',
    }),
  )

  const [payments, setPayments] = useState<PaymentPrefs>(() =>
    readStored(`${storageKey}:payments`, {
      method: 'Bank transfer',
      accountName: '',
      accountNumber: '',
    }),
  )

  const [pauseOpen, setPauseOpen] = useState(false)
  const [closeOpen, setCloseOpen] = useState(false)

  // Geography is reference data served by the API, not bundled with the app.
  useEffect(() => {
    let active = true
    geoService
      .fetchRegions()
      .then((rows) => active && setRegions(rows))
      .catch(() => undefined)
    geoService
      .fetchCities()
      .then((rows) => active && setCities(rows))
      .catch(() => undefined)
    return () => {
      active = false
    }
  }, [])

  // Hydrate from the real store so defaults reflect this seller.
  useEffect(() => {
    if (sellerId == null) return
    let active = true
    sellerService
      .fetchStore()
      .then((store) => {
        if (!active) return
        setStoreStatus(store.status)
        setPayments((prev) => ({ ...prev, accountName: prev.accountName || store.storeName }))
      })
      .catch(() => undefined)
    return () => {
      active = false
    }
  }, [sellerId])

  const persist = () => {
    writeStored(`${storageKey}:notifications`, notifications)
    writeStored(`${storageKey}:orders`, orders)
    writeStored(`${storageKey}:shipping`, shipping)
    writeStored(`${storageKey}:payments`, payments)
  }

  const savePanel = (label: string) => {
    persist()
    toast.success('Settings saved', `${label} preferences updated.`)
  }

  const toggleNotification = (key: keyof NotificationPrefs, value: boolean) => {
    setNotifications((prev) => {
      const next = { ...prev, [key]: value }
      writeStored(`${storageKey}:notifications`, next)
      return next
    })
  }

  const cityOptions = cities
    .filter((c) => String(c.regionId) === shipping.regionId)
    .map((c) => ({ label: c.name, value: String(c.id) }))

  const setStoreState = async (
    status: Seller['status'],
    title: string,
    message: string,
    failure: string,
  ) => {
    setBusy(true)
    try {
      await sellerService.updateSellerStore({ status })
      setStoreStatus(status)
      toast.success(title, message)
      setPauseOpen(false)
      setCloseOpen(false)
    } catch (error) {
      toast.error(failure, errorMessage(error))
    } finally {
      setBusy(false)
    }
  }

  const pauseStore = () =>
    setStoreState(
      'paused',
      'Store paused',
      'Your products are hidden from shoppers until you resume.',
      'Could not pause store',
    )

  const resumeStore = () =>
    setStoreState(
      'active',
      'Store resumed',
      'Your products are visible to shoppers again.',
      'Could not resume store',
    )

  const closeStore = () =>
    setStoreState(
      'closed',
      'Store closed',
      'Your store is now closed to shoppers.',
      'Could not close store',
    )

  const panels = {
    notifications: (
      <Card>
        <CardHeader>
          <CardTitle>Notification preferences</CardTitle>
        </CardHeader>
        <CardBody className="space-y-5">
          <Switch
            checked={notifications.newOrders}
            onChange={(value) => toggleNotification('newOrders', value)}
            label="New order alerts"
            description="Email me whenever a new order contains one of my items."
          />
          <Switch
            checked={notifications.lowStock}
            onChange={(value) => toggleNotification('lowStock', value)}
            label="Low stock alerts"
            description="Notify me when a variant reaches its low-stock threshold."
          />
          <Switch
            checked={notifications.reviews}
            onChange={(value) => toggleNotification('reviews', value)}
            label="Review alerts"
            description="Tell me when a customer leaves a review on my products."
          />
          <Switch
            checked={notifications.payouts}
            onChange={(value) => toggleNotification('payouts', value)}
            label="Payout confirmations"
            description="Send a confirmation each time a payout is processed."
          />
          <Switch
            checked={notifications.marketing}
            onChange={(value) => toggleNotification('marketing', value)}
            label="Marketing emails"
            description="Tips, campaign ideas and Shopio product updates."
          />
          <div className="flex justify-end border-t border-ink-200 pt-4">
            <Button onClick={() => savePanel('Notification')}>
              <Save className="h-4 w-4" aria-hidden="true" />
              Save changes
            </Button>
          </div>
        </CardBody>
      </Card>
    ),

    orders: (
      <Card>
        <CardHeader>
          <CardTitle>Order handling</CardTitle>
        </CardHeader>
        <CardBody className="space-y-5">
          <Select
            label="Default order handling time"
            hint="The time you aim to pack an order before dispatch."
            options={HANDLING_TIME_OPTIONS}
            value={orders.handlingTime}
            onChange={(event) => setOrders((prev) => ({ ...prev, handlingTime: event.target.value }))}
          />
          <Select
            label="Auto-accept orders"
            options={AUTO_ACCEPT_OPTIONS}
            value={orders.autoAccept}
            onChange={(event) => setOrders((prev) => ({ ...prev, autoAccept: event.target.value }))}
          />
          <Switch
            checked={orders.confirmEmails}
            onChange={(value) => setOrders((prev) => ({ ...prev, confirmEmails: value }))}
            label="Send order confirmation emails"
            description="Send customers an email when you accept an order."
          />
          <div className="flex justify-end border-t border-ink-200 pt-4">
            <Button onClick={() => savePanel('Order')}>
              <Save className="h-4 w-4" aria-hidden="true" />
              Save changes
            </Button>
          </div>
        </CardBody>
      </Card>
    ),

    shipping: (
      <Card>
        <CardHeader>
          <CardTitle>Shipping defaults</CardTitle>
        </CardHeader>
        <CardBody className="grid gap-5 sm:grid-cols-2">
          <Select
            label="Origin region"
            options={regions.map((r) => ({ label: r.name, value: String(r.id) }))}
            value={shipping.regionId}
            onChange={(event) =>
              setShipping((prev) => ({ ...prev, regionId: event.target.value, cityId: '' }))
            }
          />
          <Select
            label="Origin city / district"
            options={cityOptions}
            value={shipping.cityId}
            onChange={(event) => setShipping((prev) => ({ ...prev, cityId: event.target.value }))}
          />
          <Select
            label="Default carrier"
            options={shippingCarriers.map((carrier) => ({ label: carrier, value: carrier }))}
            value={shipping.carrier}
            onChange={(event) => setShipping((prev) => ({ ...prev, carrier: event.target.value }))}
          />
          <Select
            label="Handling time"
            options={HANDLING_TIME_OPTIONS}
            value={shipping.handling}
            onChange={(event) => setShipping((prev) => ({ ...prev, handling: event.target.value }))}
          />
          <Input
            className="sm:col-span-2"
            label="Free-shipping threshold (TZS)"
            type="number"
            inputMode="numeric"
            min={0}
            hint="Orders above this value ship free. Set to 0 to disable."
            value={shipping.freeThreshold}
            onChange={(event) => setShipping((prev) => ({ ...prev, freeThreshold: event.target.value }))}
          />
          <div className="flex justify-end border-t border-ink-200 pt-4 sm:col-span-2">
            <Button onClick={() => savePanel('Shipping')}>
              <Save className="h-4 w-4" aria-hidden="true" />
              Save changes
            </Button>
          </div>
        </CardBody>
      </Card>
    ),

    payments: (
      <Card>
        <CardHeader>
          <CardTitle>Payment &amp; payout details</CardTitle>
        </CardHeader>
        <CardBody className="space-y-5">
          <Select
            label="Payout method"
            options={PAYOUT_METHOD_OPTIONS}
            value={payments.method}
            onChange={(event) => setPayments((prev) => ({ ...prev, method: event.target.value }))}
          />
          <Input
            label="Account name"
            value={payments.accountName}
            onChange={(event) => setPayments((prev) => ({ ...prev, accountName: event.target.value }))}
          />
          <div>
            <span className="mb-1.5 block text-sm font-medium text-ink">Account number</span>
            <div className="flex h-10 items-center rounded-lg border border-ink-200 bg-ink-50 px-3 text-sm text-ink-500">
              {payments.accountNumber || 'Not configured'}
            </div>
            <p className="mt-1.5 text-xs text-ink-500">
              Your payout destination is verified before the first payout. Contact support to update it.
            </p>
          </div>
          <Switch
            checked={false}
            onChange={() => undefined}
            disabled
            label="Enable instant payouts"
            description="Instant payouts are not available for your account yet. Complete verification to unlock them."
          />
          <div className="flex justify-end border-t border-ink-200 pt-4">
            <Button onClick={() => savePanel('Payment')}>
              <Save className="h-4 w-4" aria-hidden="true" />
              Save changes
            </Button>
          </div>
        </CardBody>
      </Card>
    ),

    danger: (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Pause store</CardTitle>
          </CardHeader>
          <CardBody className="space-y-4">
            <p className="text-sm text-ink-600">
              Pausing hides your products from shoppers. Existing orders can still be fulfilled and you can resume
              at any time.
            </p>
            {storeStatus !== 'active' && (
              <Alert tone="warning" title={storeStatus === 'paused' ? 'Your store is paused' : 'Your store is closed'}>
                Shoppers cannot see or order your products while the store is {storeStatus}.
              </Alert>
            )}
            <div>
              {storeStatus === 'active' ? (
                <Button variant="outline" onClick={() => setPauseOpen(true)} loading={busy}>
                  <Package className="h-4 w-4" aria-hidden="true" />
                  Pause store
                </Button>
              ) : (
                <Button variant="outline" onClick={resumeStore} loading={busy}>
                  <Package className="h-4 w-4" aria-hidden="true" />
                  Resume store
                </Button>
              )}
            </div>
          </CardBody>
        </Card>

        <Card className="border-danger-100">
          <CardHeader>
            <CardTitle className="text-danger-700">Close store</CardTitle>
          </CardHeader>
          <CardBody className="space-y-4">
            <Alert tone="danger" title="Closing hides your storefront">
              Closing a store delists all products and starts the payout of any remaining balance. You can reopen
              the store from this page at any time.
            </Alert>
            <div>
              <Button variant="danger" onClick={() => setCloseOpen(true)} loading={busy} disabled={storeStatus === 'closed'}>
                <AlertTriangle className="h-4 w-4" aria-hidden="true" />
                {storeStatus === 'closed' ? 'Store is closed' : 'Close store'}
              </Button>
            </div>
          </CardBody>
        </Card>
      </div>
    ),
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        description="Control notifications, order handling, shipping and payout preferences."
      />

      <div className="flex flex-wrap items-center gap-3 text-xs text-ink-500">
        <span className="inline-flex items-center gap-1.5">
          <Bell className="h-3.5 w-3.5" aria-hidden="true" /> Notifications
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Package className="h-3.5 w-3.5" aria-hidden="true" /> Orders
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Truck className="h-3.5 w-3.5" aria-hidden="true" /> Shipping
        </span>
        <span className="inline-flex items-center gap-1.5">
          <CreditCard className="h-3.5 w-3.5" aria-hidden="true" /> Payments
        </span>
        <span className="ml-auto">Preferences are saved on this device.</span>
      </div>

      <Tabs items={TAB_ITEMS} panels={panels} />

      <ConfirmDialog
        open={pauseOpen}
        onClose={() => setPauseOpen(false)}
        onConfirm={pauseStore}
        title="Pause store"
        description="Your products will be hidden from shoppers until you resume. Existing orders are unaffected."
        confirmLabel="Pause store"
        loading={busy}
      />

      <ConfirmDialog
        open={closeOpen}
        onClose={() => setCloseOpen(false)}
        onConfirm={closeStore}
        title="Close store"
        description="Closing hides your storefront from shoppers. You can reopen the store from this page at any time."
        confirmLabel="Close store"
        tone="danger"
        loading={busy}
      />
    </div>
  )
}
