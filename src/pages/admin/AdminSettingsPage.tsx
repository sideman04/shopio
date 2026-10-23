import { useEffect, useState } from 'react'
import { CreditCard, Mail, Save, Settings, Truck } from 'lucide-react'
import {
  Alert,
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  Checkbox,
  Input,
  PageHeader,
  Select,
  Switch,
  Tabs,
} from '@/components/ui'
import { toast } from '@/context/uiStore'
import { shippingCarriers } from '@/content/marketing'
import { adminService, geoService } from '@/services'
import type { Country } from '@/types'

interface SettingsState {
  general: {
    siteName: string
    supportEmail: string
    supportPhone: string
    currency: string
    timezone: string
    country: string
  }
  commerce: {
    commissionRate: string
    minimumPayout: string
    autoApproveProducts: boolean
    autoApproveSellers: boolean
    reviewModeration: boolean
  }
  shipping: {
    freeShippingThreshold: string
    flatShippingFee: string
    vatRate: string
    taxInclusive: boolean
    carrier: string
  }
  emails: {
    orderConfirmation: boolean
    shippingNotification: boolean
    deliveryConfirmation: boolean
    welcomeEmail: boolean
    abandonedCart: boolean
    fromName: string
    replyTo: string
  }
  payments: {
    methods: string[]
    payoutSchedule: string
  }
  maintenance: {
    maintenanceMode: boolean
  }
}

const PAYMENT_METHODS = ['M-Pesa', 'Tigo Pesa', 'Airtel Money', 'Card', 'Bank transfer']

/** Flat key names used by the `site_settings` table. */
const KEYS = {
  siteName: 'site_name',
  supportEmail: 'support_email',
  supportPhone: 'support_phone',
  currency: 'currency',
  timezone: 'timezone',
  country: 'country',
  commissionRate: 'commission_rate',
  minimumPayout: 'minimum_payout',
  autoApproveProducts: 'auto_approve_products',
  autoApproveSellers: 'auto_approve_sellers',
  reviewModeration: 'review_moderation',
  freeShippingThreshold: 'free_shipping_threshold',
  flatShippingFee: 'flat_shipping_fee',
  vatRate: 'vat_rate',
  taxInclusive: 'tax_inclusive',
  carrier: 'carrier',
  orderConfirmation: 'email_order_confirmation',
  shippingNotification: 'email_shipping_notification',
  deliveryConfirmation: 'email_delivery_confirmation',
  welcomeEmail: 'email_welcome',
  abandonedCart: 'email_abandoned_cart',
  fromName: 'email_from_name',
  replyTo: 'email_reply_to',
  methods: 'payment_methods',
  payoutSchedule: 'payout_schedule',
  maintenanceMode: 'maintenance_mode',
} as const

const SECTION_KEYS: Record<keyof SettingsState, string[]> = {
  general: [KEYS.siteName, KEYS.supportEmail, KEYS.supportPhone, KEYS.currency, KEYS.timezone, KEYS.country],
  commerce: [KEYS.commissionRate, KEYS.minimumPayout, KEYS.autoApproveProducts, KEYS.autoApproveSellers, KEYS.reviewModeration],
  shipping: [KEYS.freeShippingThreshold, KEYS.flatShippingFee, KEYS.vatRate, KEYS.taxInclusive, KEYS.carrier],
  emails: [KEYS.orderConfirmation, KEYS.shippingNotification, KEYS.deliveryConfirmation, KEYS.welcomeEmail, KEYS.abandonedCart, KEYS.fromName, KEYS.replyTo],
  payments: [KEYS.methods, KEYS.payoutSchedule],
  maintenance: [KEYS.maintenanceMode],
}

const DEFAULTS: SettingsState = {
  general: {
    siteName: 'Shopio',
    supportEmail: 'support@shopio.co.tz',
    supportPhone: '+255 700 000 001',
    currency: 'TZS',
    timezone: 'Africa/Dar_es_Salaam',
    country: 'TZ',
  },
  commerce: {
    commissionRate: '10',
    minimumPayout: '50000',
    autoApproveProducts: false,
    autoApproveSellers: false,
    reviewModeration: true,
  },
  shipping: {
    freeShippingThreshold: '150000',
    flatShippingFee: '12000',
    vatRate: '18',
    taxInclusive: true,
    carrier: 'Shopio Express',
  },
  emails: {
    orderConfirmation: true,
    shippingNotification: true,
    deliveryConfirmation: true,
    welcomeEmail: true,
    abandonedCart: false,
    fromName: 'Shopio',
    replyTo: 'no-reply@shopio.co.tz',
  },
  payments: {
    methods: ['M-Pesa', 'Card', 'Bank transfer'],
    payoutSchedule: 'bi-weekly',
  },
  maintenance: {
    maintenanceMode: false,
  },
}

/** Collapse the form state into the flat key/value pairs the API stores. */
function flatten(state: SettingsState): Record<string, unknown> {
  return {
    [KEYS.siteName]: state.general.siteName,
    [KEYS.supportEmail]: state.general.supportEmail,
    [KEYS.supportPhone]: state.general.supportPhone,
    [KEYS.currency]: state.general.currency,
    [KEYS.timezone]: state.general.timezone,
    [KEYS.country]: state.general.country,
    [KEYS.commissionRate]: state.commerce.commissionRate,
    [KEYS.minimumPayout]: state.commerce.minimumPayout,
    [KEYS.autoApproveProducts]: state.commerce.autoApproveProducts,
    [KEYS.autoApproveSellers]: state.commerce.autoApproveSellers,
    [KEYS.reviewModeration]: state.commerce.reviewModeration,
    [KEYS.freeShippingThreshold]: state.shipping.freeShippingThreshold,
    [KEYS.flatShippingFee]: state.shipping.flatShippingFee,
    [KEYS.vatRate]: state.shipping.vatRate,
    [KEYS.taxInclusive]: state.shipping.taxInclusive,
    [KEYS.carrier]: state.shipping.carrier,
    [KEYS.orderConfirmation]: state.emails.orderConfirmation,
    [KEYS.shippingNotification]: state.emails.shippingNotification,
    [KEYS.deliveryConfirmation]: state.emails.deliveryConfirmation,
    [KEYS.welcomeEmail]: state.emails.welcomeEmail,
    [KEYS.abandonedCart]: state.emails.abandonedCart,
    [KEYS.fromName]: state.emails.fromName,
    [KEYS.replyTo]: state.emails.replyTo,
    [KEYS.methods]: state.payments.methods,
    [KEYS.payoutSchedule]: state.payments.payoutSchedule,
    [KEYS.maintenanceMode]: state.maintenance.maintenanceMode,
  }
}

/** Merge a flat key/value response over the defaults. */
function hydrate(flat: Record<string, unknown>): SettingsState {
  const next: SettingsState = structuredClone(DEFAULTS)
  const str = (key: string, fallback: string) =>
    typeof flat[key] === 'string' ? (flat[key] as string) : fallback
  const bool = (key: string, fallback: boolean) =>
    typeof flat[key] === 'boolean' ? (flat[key] as boolean) : fallback

  next.general.siteName = str(KEYS.siteName, DEFAULTS.general.siteName)
  next.general.supportEmail = str(KEYS.supportEmail, DEFAULTS.general.supportEmail)
  next.general.supportPhone = str(KEYS.supportPhone, DEFAULTS.general.supportPhone)
  next.general.currency = str(KEYS.currency, DEFAULTS.general.currency)
  next.general.timezone = str(KEYS.timezone, DEFAULTS.general.timezone)
  next.general.country = str(KEYS.country, DEFAULTS.general.country)
  next.commerce.commissionRate = str(KEYS.commissionRate, DEFAULTS.commerce.commissionRate)
  next.commerce.minimumPayout = str(KEYS.minimumPayout, DEFAULTS.commerce.minimumPayout)
  next.commerce.autoApproveProducts = bool(KEYS.autoApproveProducts, DEFAULTS.commerce.autoApproveProducts)
  next.commerce.autoApproveSellers = bool(KEYS.autoApproveSellers, DEFAULTS.commerce.autoApproveSellers)
  next.commerce.reviewModeration = bool(KEYS.reviewModeration, DEFAULTS.commerce.reviewModeration)
  next.shipping.freeShippingThreshold = str(KEYS.freeShippingThreshold, DEFAULTS.shipping.freeShippingThreshold)
  next.shipping.flatShippingFee = str(KEYS.flatShippingFee, DEFAULTS.shipping.flatShippingFee)
  next.shipping.vatRate = str(KEYS.vatRate, DEFAULTS.shipping.vatRate)
  next.shipping.taxInclusive = bool(KEYS.taxInclusive, DEFAULTS.shipping.taxInclusive)
  next.shipping.carrier = str(KEYS.carrier, DEFAULTS.shipping.carrier)
  next.emails.orderConfirmation = bool(KEYS.orderConfirmation, DEFAULTS.emails.orderConfirmation)
  next.emails.shippingNotification = bool(KEYS.shippingNotification, DEFAULTS.emails.shippingNotification)
  next.emails.deliveryConfirmation = bool(KEYS.deliveryConfirmation, DEFAULTS.emails.deliveryConfirmation)
  next.emails.welcomeEmail = bool(KEYS.welcomeEmail, DEFAULTS.emails.welcomeEmail)
  next.emails.abandonedCart = bool(KEYS.abandonedCart, DEFAULTS.emails.abandonedCart)
  next.emails.fromName = str(KEYS.fromName, DEFAULTS.emails.fromName)
  next.emails.replyTo = str(KEYS.replyTo, DEFAULTS.emails.replyTo)
  if (Array.isArray(flat[KEYS.methods])) {
    next.payments.methods = (flat[KEYS.methods] as unknown[]).map(String)
  }
  next.payments.payoutSchedule = str(KEYS.payoutSchedule, DEFAULTS.payments.payoutSchedule)
  next.maintenance.maintenanceMode = bool(KEYS.maintenanceMode, DEFAULTS.maintenance.maintenanceMode)
  return next
}

/** Platform configuration, persisted through the admin settings API. */
export default function AdminSettingsPage() {
  const [tab, setTab] = useState('general')
  const [settings, setSettings] = useState<SettingsState>(DEFAULTS)
  const [countries, setCountries] = useState<Country[]>([])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    void geoService.fetchCountries().then(setCountries).catch(() => setCountries([]))
    void adminService
      .fetchSettings()
      .then((flat) => setSettings(hydrate(flat)))
      .catch((error) =>
        toast.error('Could not load settings', error instanceof Error ? error.message : 'Please try again.'),
      )
  }, [])

  const update = <K extends keyof SettingsState>(section: K, patch: Partial<SettingsState[K]>) =>
    setSettings((current) => ({ ...current, [section]: { ...current[section], ...patch } }))

  const save = async (label: string, section?: keyof SettingsState) => {
    if ((!section || section === 'payments') && settings.payments.methods.length === 0) {
      toast.error('Enable at least one payment method', 'Checkout needs at least one method to offer.')
      return
    }
    if ((!section || section === 'general') && !/^\S+@\S+\.\S+$/.test(settings.general.supportEmail.trim())) {
      toast.error('Enter a valid support email', 'Use a valid email address before saving general settings.')
      return
    }
    if ((!section || section === 'emails') && !/^\S+@\S+\.\S+$/.test(settings.emails.replyTo.trim())) {
      toast.error('Enter a valid reply-to address', 'Use a valid email address before saving email settings.')
      return
    }
    if (!section || section === 'commerce') {
      const commission = Number(settings.commerce.commissionRate)
      const payout = Number(settings.commerce.minimumPayout)
      if (!Number.isFinite(commission) || commission < 0 || commission > 40 || !Number.isFinite(payout) || payout < 0) {
        toast.error('Check commerce values', 'Commission must be 0–40% and minimum payout cannot be negative.')
        return
      }
    }
    if (!section || section === 'shipping') {
      const vat = Number(settings.shipping.vatRate)
      if (![settings.shipping.freeShippingThreshold, settings.shipping.flatShippingFee].every((value) => Number.isFinite(Number(value)) && Number(value) >= 0) || !Number.isFinite(vat) || vat < 0 || vat > 100) {
        toast.error('Check shipping and tax values', 'Amounts must be non-negative and VAT must be between 0 and 100%.')
        return
      }
    }
    setSaving(true)
    try {
      const allValues = flatten(settings)
      const values = section
        ? Object.fromEntries(Object.entries(allValues).filter(([key]) => SECTION_KEYS[section].includes(key)))
        : allValues
      const flat = await adminService.updateSettings(values)
      const savedSettings = hydrate(flat)
      if (!section) setSettings(savedSettings)
      toast.success(`${label} settings saved`, 'The configuration was stored on the server.')
    } catch (error) {
      toast.error('Settings not saved', error instanceof Error ? error.message : 'Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const reloadSettings = async () => {
    setSaving(true)
    try {
      setSettings(hydrate(await adminService.fetchSettings()))
      toast.success('Settings reloaded', 'The latest saved configuration is now shown.')
    } catch (error) {
      toast.error('Could not reload settings', error instanceof Error ? error.message : 'Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const toggleMethod = (method: string) =>
    update('payments', {
      methods: settings.payments.methods.includes(method)
        ? settings.payments.methods.filter((m) => m !== method)
        : [...settings.payments.methods, method],
    })

  const generalPanel = (
    <Card>
      <CardHeader>
        <CardTitle>General</CardTitle>
      </CardHeader>
      <CardBody className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Site name"
            value={settings.general.siteName}
            onChange={(e) => update('general', { siteName: e.target.value })}
          />
          <Input
            label="Support email"
            type="email"
            value={settings.general.supportEmail}
            onChange={(e) => update('general', { supportEmail: e.target.value })}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Support phone"
            value={settings.general.supportPhone}
            onChange={(e) => update('general', { supportPhone: e.target.value })}
          />
          <Select
            label="Default currency"
            value={settings.general.currency}
            onChange={(e) => update('general', { currency: e.target.value })}
            options={[
              { label: 'Tanzanian Shilling (TZS)', value: 'TZS' },
              { label: 'Kenyan Shilling (KES)', value: 'KES' },
              { label: 'US Dollar (USD)', value: 'USD' },
            ]}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Select
            label="Timezone"
            value={settings.general.timezone}
            onChange={(e) => update('general', { timezone: e.target.value })}
            options={[
              { label: 'Africa/Dar es Salaam', value: 'Africa/Dar_es_Salaam' },
              { label: 'Africa/Nairobi', value: 'Africa/Nairobi' },
              { label: 'Africa/Kampala', value: 'Africa/Kampala' },
              { label: 'UTC', value: 'UTC' },
            ]}
          />
          <Select
            label="Default country"
            value={settings.general.country}
            onChange={(e) => update('general', { country: e.target.value })}
            options={countries.map((c) => ({ label: c.name, value: c.code }))}
          />
        </div>
        <div className="flex justify-end">
          <Button onClick={() => save('General', 'general')} loading={saving}>
            <Save className="h-4 w-4" />
            Save general
          </Button>
        </div>
      </CardBody>
    </Card>
  )

  const commercePanel = (
    <Card>
      <CardHeader>
        <CardTitle>Commerce</CardTitle>
      </CardHeader>
      <CardBody className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Default commission rate (%)"
            type="number"
            min={0}
            max={40}
            value={settings.commerce.commissionRate}
            onChange={(e) => update('commerce', { commissionRate: e.target.value })}
          />
          <Input
            label="Minimum payout amount (TSh)"
            type="number"
            min={0}
            value={settings.commerce.minimumPayout}
            onChange={(e) => update('commerce', { minimumPayout: e.target.value })}
          />
        </div>
        <div className="space-y-4 border-t border-ink-100 pt-4">
          <Switch
            checked={settings.commerce.autoApproveProducts}
            onChange={(checked) => update('commerce', { autoApproveProducts: checked })}
            label="Auto-approve products"
            description="Publish new listings without moderation. This bypasses the review queue."
          />
          {settings.commerce.autoApproveProducts && (
            <Alert tone="warning" title="Moderation bypassed">
              Enabling this means new products go live immediately. Reported or non-compliant listings will only be caught after publication.
            </Alert>
          )}
          <Switch
            checked={settings.commerce.autoApproveSellers}
            onChange={(checked) => update('commerce', { autoApproveSellers: checked })}
            label="Auto-approve sellers"
            description="Verify new seller applications automatically without document review."
          />
          <Switch
            checked={settings.commerce.reviewModeration}
            onChange={(checked) => update('commerce', { reviewModeration: checked })}
            label="Review moderation"
            description="Hold new reviews for approval before they appear on product pages."
          />
        </div>
        <div className="flex justify-end">
          <Button onClick={() => save('Commerce', 'commerce')} loading={saving}>
            <Save className="h-4 w-4" />
            Save commerce
          </Button>
        </div>
      </CardBody>
    </Card>
  )

  const shippingPanel = (
    <Card>
      <CardHeader>
        <CardTitle>Shipping &amp; tax</CardTitle>
      </CardHeader>
      <CardBody className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Free shipping threshold (TSh)"
            type="number"
            min={0}
            value={settings.shipping.freeShippingThreshold}
            onChange={(e) => update('shipping', { freeShippingThreshold: e.target.value })}
          />
          <Input
            label="Flat shipping fee (TSh)"
            type="number"
            min={0}
            value={settings.shipping.flatShippingFee}
            onChange={(e) => update('shipping', { flatShippingFee: e.target.value })}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="VAT rate (%)"
            type="number"
            min={0}
            max={100}
            value={settings.shipping.vatRate}
            onChange={(e) => update('shipping', { vatRate: e.target.value })}
          />
          <Select
            label="Default carrier"
            value={settings.shipping.carrier}
            onChange={(e) => update('shipping', { carrier: e.target.value })}
            options={shippingCarriers.map((c) => ({ label: c, value: c }))}
          />
        </div>
        <div className="border-t border-ink-100 pt-4">
          <Switch
            checked={settings.shipping.taxInclusive}
            onChange={(checked) => update('shipping', { taxInclusive: checked })}
            label="Tax-inclusive pricing"
            description="Displayed prices already include VAT."
          />
        </div>
        <div className="flex justify-end">
          <Button onClick={() => save('Shipping and tax', 'shipping')} loading={saving}>
            <Truck className="h-4 w-4" />
            Save shipping
          </Button>
        </div>
      </CardBody>
    </Card>
  )

  const emailsPanel = (
    <Card>
      <CardHeader>
        <CardTitle>Emails</CardTitle>
      </CardHeader>
      <CardBody className="space-y-5">
        <Alert tone="info" title="Transactional email">
          These toggles control which messages the platform dispatches. Delivery depends on the configured mail
          transport.
        </Alert>
        <div className="space-y-4">
          <Switch checked={settings.emails.orderConfirmation} onChange={(v) => update('emails', { orderConfirmation: v })} label="Order confirmation" description="Sent when a customer places an order." />
          <Switch checked={settings.emails.shippingNotification} onChange={(v) => update('emails', { shippingNotification: v })} label="Shipping notification" description="Sent when an order is marked as shipped." />
          <Switch checked={settings.emails.deliveryConfirmation} onChange={(v) => update('emails', { deliveryConfirmation: v })} label="Delivery confirmation" description="Sent when an order is delivered." />
          <Switch checked={settings.emails.welcomeEmail} onChange={(v) => update('emails', { welcomeEmail: v })} label="Welcome email" description="Sent to new account registrations." />
          <Switch checked={settings.emails.abandonedCart} onChange={(v) => update('emails', { abandonedCart: v })} label="Abandoned cart reminder" description="Sent when a cart is left without checkout." />
        </div>
        <div className="grid gap-4 border-t border-ink-100 pt-4 sm:grid-cols-2">
          <Input
            label="From name"
            value={settings.emails.fromName}
            onChange={(e) => update('emails', { fromName: e.target.value })}
          />
          <Input
            label="Reply-to address"
            type="email"
            value={settings.emails.replyTo}
            onChange={(e) => update('emails', { replyTo: e.target.value })}
          />
        </div>
        <div className="flex justify-end">
          <Button onClick={() => save('Emails', 'emails')} loading={saving}>
            <Mail className="h-4 w-4" />
            Save emails
          </Button>
        </div>
      </CardBody>
    </Card>
  )

  const paymentsPanel = (
    <Card>
      <CardHeader>
        <CardTitle>Payments</CardTitle>
      </CardHeader>
      <CardBody className="space-y-5">
        <Alert tone="warning" title="Payment methods">
          Enabled methods are offered at checkout. Actual charges are handled by the configured payment provider.
        </Alert>
        <fieldset>
          <legend className="mb-2 text-sm font-medium text-ink">Enabled payment methods</legend>
          <div className="space-y-3">
            {PAYMENT_METHODS.map((method) => (
              <Checkbox
                key={method}
                label={method}
                checked={settings.payments.methods.includes(method)}
                onChange={() => toggleMethod(method)}
              />
            ))}
          </div>
          {settings.payments.methods.length === 0 && (
            <p role="alert" className="mt-2 text-xs font-medium text-danger-600">
              At least one payment method is required.
            </p>
          )}
        </fieldset>
        <Select
          label="Payout schedule"
          value={settings.payments.payoutSchedule}
          onChange={(e) => update('payments', { payoutSchedule: e.target.value })}
          options={[
            { label: 'Weekly', value: 'weekly' },
            { label: 'Bi-weekly', value: 'bi-weekly' },
            { label: 'Monthly', value: 'monthly' },
          ]}
        />
        <div className="flex justify-end">
          <Button onClick={() => save('Payments', 'payments')} loading={saving}>
            <CreditCard className="h-4 w-4" />
            Save payments
          </Button>
        </div>
      </CardBody>
    </Card>
  )

  const maintenancePanel = (
    <Card>
      <CardHeader>
        <CardTitle>Maintenance</CardTitle>
      </CardHeader>
      <CardBody className="space-y-5">
        <Switch
          checked={settings.maintenance.maintenanceMode}
          onChange={(checked) => update('maintenance', { maintenanceMode: checked })}
          label="Maintenance mode"
          description="Flag the storefront as read-only. Enforcing it is a deployment concern; the setting is recorded so operational tooling can act on it."
        />
        <div className="flex justify-end border-t border-ink-100 pt-4">
          <Button onClick={() => save('Maintenance', 'maintenance')} loading={saving}>
            <Save className="h-4 w-4" />
            Save maintenance
          </Button>
        </div>
      </CardBody>
    </Card>
  )

  return (
    <div className="space-y-6">
      <PageHeader
        title="Platform settings"
        description="Marketplace-wide configuration for commerce, shipping, email and payments."
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={reloadSettings} loading={saving}>Reload saved</Button>
            <Button onClick={() => save('Platform')} loading={saving}>
              <Save className="h-4 w-4" />
              Save changes
            </Button>
          </div>
        }
      />

      <Tabs
        value={tab}
        onChange={setTab}
        items={[
          { id: 'general', label: 'General' },
          { id: 'commerce', label: 'Commerce' },
          { id: 'shipping', label: 'Shipping & tax' },
          { id: 'emails', label: 'Emails' },
          { id: 'payments', label: 'Payments' },
          { id: 'maintenance', label: 'Maintenance' },
        ]}
        panels={{
          general: generalPanel,
          commerce: commercePanel,
          shipping: shippingPanel,
          emails: emailsPanel,
          payments: paymentsPanel,
          maintenance: maintenancePanel,
        }}
      />

      <p className="flex items-center gap-1.5 text-xs text-ink-500">
        <Settings className="h-3.5 w-3.5" aria-hidden="true" />
        Settings are stored server-side and recorded in the audit log when changed.
      </p>
    </div>
  )
}
