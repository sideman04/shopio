import { useCallback, useEffect, useState } from 'react'
import {
  AlertTriangle,
  Bell,
  CreditCard,
  ExternalLink,
  FileText,
  Loader2,
  Package,
  Save,
  ShieldCheck,
  Trash2,
  Truck,
} from 'lucide-react'
import {
  Alert,
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  ConfirmDialog,
  FileDropzone,
  Input,
  PageHeader,
  Select,
  StatusBadge,
  Switch,
  Tabs,
} from '@/components/ui'
import { useAuthStore } from '@/context'
import { toast } from '@/context/uiStore'
import { shippingCarriers } from '@/content/marketing'
import { geoService, sellerService } from '@/services'
import { errorMessage } from '@/services/apiClient'
import { formatFileSize } from '@/services/uploadService'
import { formatDate } from '@/lib/utils'
import type { City, Region, Seller, SellerDocument, SellerDocumentType } from '@/types'

const TAB_ITEMS = [
  { id: 'notifications', label: 'Notifications' },
  { id: 'orders', label: 'Orders' },
  { id: 'shipping', label: 'Shipping' },
  { id: 'payments', label: 'Payments' },
  { id: 'verification', label: 'Verification' },
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

const DEFAULT_NOTIFICATIONS: NotificationPrefs = {
  newOrders: true,
  lowStock: true,
  reviews: true,
  payouts: true,
  marketing: false,
}

const DEFAULT_ORDERS: OrderPrefs = {
  handlingTime: '2',
  autoAccept: 'no',
  confirmEmails: true,
}

const DEFAULT_SHIPPING: ShippingPrefs = {
  regionId: '',
  cityId: '',
  carrier: shippingCarriers[0] ?? '',
  freeThreshold: '',
  handling: '2',
}

const DEFAULT_PAYMENTS: PaymentPrefs = {
  method: 'Bank transfer',
  accountName: '',
  accountNumber: '',
}

const DOCUMENT_TYPES: Array<{ label: string; value: SellerDocumentType }> = [
  { label: 'Business licence', value: 'business_licence' },
  { label: 'Tax certificate (TIN)', value: 'tax_certificate' },
  { label: 'National ID / passport', value: 'id_document' },
  { label: 'Proof of address', value: 'address_proof' },
  { label: 'Bank statement', value: 'bank_statement' },
  { label: 'Other supporting document', value: 'other' },
]

const DOCUMENT_TONES: Record<SellerDocument['status'], 'success' | 'warning' | 'danger'> = {
  approved: 'success',
  pending: 'warning',
  rejected: 'danger',
}

function hydratePreferences(preferences: Record<string, unknown> | null | undefined) {
  const read = <T extends object>(key: string, fallback: T): T => {
    const value = preferences?.[key]
    if (!value || typeof value !== 'object' || Array.isArray(value)) return fallback
    return { ...fallback, ...(value as Partial<T>) }
  }

  return {
    notifications: read('notifications', DEFAULT_NOTIFICATIONS),
    orders: read('orders', DEFAULT_ORDERS),
    shipping: read('shipping', DEFAULT_SHIPPING),
    payments: read('payments', DEFAULT_PAYMENTS),
  }
}

export default function SellerSettingsPage() {
  const user = useAuthStore((s) => s.session?.user)
  const sellerId = user?.sellerId ?? null

  const [regions, setRegions] = useState<Region[]>([])
  const [cities, setCities] = useState<City[]>([])
  const [storeStatus, setStoreStatus] = useState<Seller['status']>('active')
  const [verificationStatus, setVerificationStatus] = useState<Seller['verificationStatus']>('not_submitted')
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [savingSection, setSavingSection] = useState<string | null>(null)
  const [dirty, setDirty] = useState(false)

  const [notifications, setNotifications] = useState<NotificationPrefs>(DEFAULT_NOTIFICATIONS)
  const [orders, setOrders] = useState<OrderPrefs>(DEFAULT_ORDERS)
  const [shipping, setShipping] = useState<ShippingPrefs>(DEFAULT_SHIPPING)
  const [payments, setPayments] = useState<PaymentPrefs>(DEFAULT_PAYMENTS)

  const [documents, setDocuments] = useState<SellerDocument[]>([])
  const [documentsLoading, setDocumentsLoading] = useState(false)
  const [documentsError, setDocumentsError] = useState<string | null>(null)
  const [documentType, setDocumentType] = useState<SellerDocumentType>('business_licence')
  const [documentLabel, setDocumentLabel] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<SellerDocument | null>(null)
  const [deleting, setDeleting] = useState(false)

  const [pauseOpen, setPauseOpen] = useState(false)
  const [closeOpen, setCloseOpen] = useState(false)

  const loadDocuments = useCallback(async () => {
    if (sellerId == null) return
    setDocumentsLoading(true)
    setDocumentsError(null)
    try {
      setDocuments(await sellerService.fetchDocuments())
    } catch (error) {
      setDocumentsError(errorMessage(error))
    } finally {
      setDocumentsLoading(false)
    }
  }, [sellerId])

  const loadSettings = useCallback(async () => {
    if (sellerId == null) {
      setLoading(false)
      return
    }

    setLoading(true)
    setLoadError(null)
    try {
      const [store, preferences] = await Promise.all([
        sellerService.fetchStore(),
        sellerService.fetchPreferences(),
      ])
      const hydrated = hydratePreferences(preferences)
      setStoreStatus(store.status)
      setVerificationStatus(store.verificationStatus)
      setNotifications(hydrated.notifications)
      setOrders(hydrated.orders)
      setShipping(hydrated.shipping)
      setPayments({
        ...hydrated.payments,
        accountName: hydrated.payments.accountName || store.storeName,
      })
      setDirty(false)
    } catch (error) {
      setLoadError(errorMessage(error))
    } finally {
      setLoading(false)
    }
  }, [sellerId])

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

  useEffect(() => {
    void loadSettings()
  }, [loadSettings])

  useEffect(() => {
    void loadDocuments()
  }, [loadDocuments])

  const updateNotifications = (key: keyof NotificationPrefs, value: boolean) => {
    setNotifications((prev) => ({ ...prev, [key]: value }))
    setDirty(true)
  }

  const updateOrders = (patch: Partial<OrderPrefs>) => {
    setOrders((prev) => ({ ...prev, ...patch }))
    setDirty(true)
  }

  const updateShipping = (patch: Partial<ShippingPrefs>) => {
    setShipping((prev) => ({ ...prev, ...patch }))
    setDirty(true)
  }

  const updatePayments = (patch: Partial<PaymentPrefs>) => {
    setPayments((prev) => ({ ...prev, ...patch }))
    setDirty(true)
  }

  const saveSection = async (section: string, label: string) => {
    setSavingSection(section)
    try {
      const saved = await sellerService.updatePreferences({
        notifications,
        orders,
        shipping,
        payments,
      })
      const hydrated = hydratePreferences(saved)
      setNotifications(hydrated.notifications)
      setOrders(hydrated.orders)
      setShipping(hydrated.shipping)
      setPayments(hydrated.payments)
      setDirty(false)
      toast.success('Settings saved', `${label} preferences updated.`)
    } catch (error) {
      toast.error('Could not save settings', errorMessage(error))
    } finally {
      setSavingSection(null)
    }
  }

  const uploadDocuments = async (files: File[]) => {
    const failures: string[] = []
    for (const file of files) {
      try {
        await sellerService.uploadDocument({
          file,
          documentType,
          label: documentLabel.trim() || undefined,
        })
      } catch (error) {
        failures.push(`${file.name}: ${errorMessage(error)}`)
      }
    }

    setDocumentLabel('')
    await loadDocuments()

    if (failures.length > 0) {
      throw new Error(failures.join(' '))
    }

    toast.success('Documents uploaded', 'They will be reviewed with your store verification.')
  }

  const confirmDeleteDocument = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await sellerService.deleteDocument(deleteTarget.id)
      setDeleteTarget(null)
      await loadDocuments()
      toast.success('Document removed', 'The document was deleted from your verification file.')
    } catch (error) {
      toast.error('Could not remove document', errorMessage(error))
    } finally {
      setDeleting(false)
    }
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
            onChange={(value) => updateNotifications('newOrders', value)}
            label="New order alerts"
            description="Email me whenever a new order contains one of my items."
          />
          <Switch
            checked={notifications.lowStock}
            onChange={(value) => updateNotifications('lowStock', value)}
            label="Low stock alerts"
            description="Notify me when a variant reaches its low-stock threshold."
          />
          <Switch
            checked={notifications.reviews}
            onChange={(value) => updateNotifications('reviews', value)}
            label="Review alerts"
            description="Tell me when a customer leaves a review on my products."
          />
          <Switch
            checked={notifications.payouts}
            onChange={(value) => updateNotifications('payouts', value)}
            label="Payout confirmations"
            description="Send a confirmation each time a payout is processed."
          />
          <Switch
            checked={notifications.marketing}
            onChange={(value) => updateNotifications('marketing', value)}
            label="Marketing emails"
            description="Tips, campaign ideas and RAGIZE product updates."
          />
          <div className="flex justify-end border-t border-ink-200 pt-4">
            <Button
              onClick={() => void saveSection('notifications', 'Notification')}
              loading={savingSection === 'notifications'}
              disabled={savingSection !== null}
            >
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
            onChange={(event) => updateOrders({ handlingTime: event.target.value })}
          />
          <Select
            label="Auto-accept orders"
            options={AUTO_ACCEPT_OPTIONS}
            value={orders.autoAccept}
            onChange={(event) => updateOrders({ autoAccept: event.target.value })}
          />
          <Switch
            checked={orders.confirmEmails}
            onChange={(value) => updateOrders({ confirmEmails: value })}
            label="Send order confirmation emails"
            description="Send customers an email when you accept an order."
          />
          <div className="flex justify-end border-t border-ink-200 pt-4">
            <Button
              onClick={() => void saveSection('orders', 'Order')}
              loading={savingSection === 'orders'}
              disabled={savingSection !== null}
            >
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
            onChange={(event) => updateShipping({ regionId: event.target.value, cityId: '' })}
          />
          <Select
            label="Origin city / district"
            options={cityOptions}
            value={shipping.cityId}
            onChange={(event) => updateShipping({ cityId: event.target.value })}
          />
          <Select
            label="Default carrier"
            options={shippingCarriers.map((carrier) => ({ label: carrier, value: carrier }))}
            value={shipping.carrier}
            onChange={(event) => updateShipping({ carrier: event.target.value })}
          />
          <Select
            label="Handling time"
            options={HANDLING_TIME_OPTIONS}
            value={shipping.handling}
            onChange={(event) => updateShipping({ handling: event.target.value })}
          />
          <Input
            className="sm:col-span-2"
            label="Free-shipping threshold (TZS)"
            type="number"
            inputMode="numeric"
            min={0}
            hint="Orders above this value ship free. Set to 0 to disable."
            value={shipping.freeThreshold}
            onChange={(event) => updateShipping({ freeThreshold: event.target.value })}
          />
          <div className="flex justify-end border-t border-ink-200 pt-4 sm:col-span-2">
            <Button
              onClick={() => void saveSection('shipping', 'Shipping')}
              loading={savingSection === 'shipping'}
              disabled={savingSection !== null}
            >
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
            onChange={(event) => updatePayments({ method: event.target.value })}
          />
          <Input
            label="Account name"
            value={payments.accountName}
            onChange={(event) => updatePayments({ accountName: event.target.value })}
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
            <Button
              onClick={() => void saveSection('payments', 'Payment')}
              loading={savingSection === 'payments'}
              disabled={savingSection !== null}
            >
              <Save className="h-4 w-4" aria-hidden="true" />
              Save changes
            </Button>
          </div>
        </CardBody>
      </Card>
    ),

    verification: (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Store verification</CardTitle>
          </CardHeader>
          <CardBody className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <StatusBadge status={verificationStatus} kind="verification" />
              <span className="text-sm text-ink-600">
                {verificationStatus === 'approved'
                  ? 'Your store is verified. Keep your documents up to date if your business details change.'
                  : verificationStatus === 'pending'
                    ? 'Your documents are in the review queue. We will notify you when verification is complete.'
                    : verificationStatus === 'rejected'
                      ? 'Your verification was rejected. Review the notes below and upload updated documents.'
                      : 'Upload your business documents to start verification.'}
              </span>
            </div>

            {verificationStatus === 'approved' && (
              <Alert tone="success" title="Verified seller">
                Buyers can see your verified badge and instant payouts may be available.
              </Alert>
            )}
            {verificationStatus === 'rejected' && (
              <Alert tone="danger" title="Action needed">
                Replace or add the documents requested by our verification team, then wait for another review.
              </Alert>
            )}
            {verificationStatus === 'pending' && (
              <Alert tone="warning" title="Review in progress">
                Uploading a new document keeps your application in the queue; it does not cancel the review.
              </Alert>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <Select
                label="Document type"
                options={DOCUMENT_TYPES}
                value={documentType}
                onChange={(event) => setDocumentType(event.target.value as SellerDocumentType)}
              />
              <Input
                label="Label (optional)"
                placeholder="e.g. 2026 business licence"
                value={documentLabel}
                onChange={(event) => setDocumentLabel(event.target.value)}
              />
            </div>

            <FileDropzone
              accept=".pdf,image/jpeg,image/png,image/webp"
              multiple
              label="Upload verification documents"
              hint="PDF, JPG, PNG or WebP · up to 10 MB each"
              maxSize={10 * 1024 * 1024}
              onFiles={uploadDocuments}
            />
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Uploaded documents</CardTitle>
          </CardHeader>
          <CardBody>
            {documentsLoading ? (
              <div className="flex items-center gap-2 py-4 text-sm text-ink-500">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                Loading documents…
              </div>
            ) : documentsError ? (
              <div className="space-y-3">
                <Alert tone="danger" title="Could not load documents">
                  {documentsError}
                </Alert>
                <Button variant="outline" size="sm" onClick={() => void loadDocuments()}>
                  Try again
                </Button>
              </div>
            ) : documents.length === 0 ? (
              <div className="rounded-lg border border-dashed border-ink-200 px-4 py-8 text-center">
                <FileText className="mx-auto h-6 w-6 text-ink-400" aria-hidden="true" />
                <p className="mt-2 text-sm font-medium text-ink">No documents uploaded yet</p>
                <p className="mt-1 text-xs text-ink-500">Add a business licence, tax certificate or ID to speed up verification.</p>
              </div>
            ) : (
              <ul className="divide-y divide-ink-100 rounded-lg border border-ink-200">
                {documents.map((document) => (
                  <li key={document.id} className="flex flex-col gap-3 px-3 py-3 sm:flex-row sm:items-center">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-ink-100 text-ink-500">
                      <FileText className="h-4 w-4" aria-hidden="true" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-sm font-medium text-ink">
                          {document.label || document.originalName || 'Verification document'}
                        </p>
                        <Badge tone={DOCUMENT_TONES[document.status]}>{document.status}</Badge>
                      </div>
                      <p className="mt-0.5 text-xs text-ink-500">
                        {DOCUMENT_TYPES.find((type) => type.value === document.documentType)?.label ?? document.documentType}
                        {' · '}
                        {formatFileSize(document.sizeBytes)}
                        {' · '}
                        Uploaded {formatDate(document.createdAt)}
                      </p>
                      {document.reviewNotes && (
                        <p className="mt-1 text-xs text-ink-600">Reviewer note: {document.reviewNotes}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-1 sm:shrink-0">
                      <a
                        href={document.fileUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-sm font-medium text-ink-600 transition hover:bg-ink-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-300"
                      >
                        <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                        View
                      </a>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDeleteTarget(document)}
                        aria-label={`Delete ${document.label || document.originalName || 'document'}`}
                      >
                        <Trash2 className="h-4 w-4 text-danger-600" aria-hidden="true" />
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      </div>
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
        <span className="inline-flex items-center gap-1.5">
          <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" /> Verification
        </span>
        <span className="ml-auto inline-flex items-center gap-2">
          {dirty && <Badge tone="warning">Unsaved changes</Badge>}
          Preferences are saved to your account.
        </span>
      </div>

      {loadError && (
        <Alert tone="danger" title="Could not load settings">
          <div className="flex flex-wrap items-center gap-3">
            <span>{loadError}</span>
            <Button variant="outline" size="sm" onClick={() => void loadSettings()}>
              Retry
            </Button>
          </div>
        </Alert>
      )}

      {loading ? (
        <Card>
          <CardBody className="flex items-center gap-2 py-10 text-sm text-ink-500">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            Loading your settings…
          </CardBody>
        </Card>
      ) : (
        <Tabs items={TAB_ITEMS} panels={panels} />
      )}

      <ConfirmDialog
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => void confirmDeleteDocument()}
        title="Remove document"
        description={`Remove “${deleteTarget?.label || deleteTarget?.originalName || 'this document'}” from your verification file? You can upload it again later.`}
        confirmLabel="Remove document"
        tone="danger"
        loading={deleting}
      />

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
