/**
 * Shopio domain types.
 *
 * These mirror the PHP/MySQL schema (`shopio` v2 normalized) so that the
 * service layer in `src/services` can map real REST responses without
 * reshaping UI code.
 *
 * Where the API would "hydrate" a row with its relations (e.g. a product with
 * its images, variants and rating summary), the type below reflects that
 * hydrated shape rather than a raw table row.
 */

/* -------------------------------------------------------------------------- */
/* Users, roles & auth                                                         */
/* -------------------------------------------------------------------------- */

export type RoleCode = 'customer' | 'seller' | 'admin'

export type UserStatus = 'pending' | 'active' | 'suspended' | 'disabled'

export interface User {
  id: number
  fullName: string
  email: string
  phone: string | null
  avatarUrl?: string | null
  roles: RoleCode[]
  status: UserStatus
  emailVerifiedAt: string | null
  /** ISO date — matches users.created_at */
  createdAt: string
  lastLoginAt?: string | null
  /** Only present for seller accounts. */
  sellerId?: number
}

export interface AuthSession {
  user: User
  token: string
  /** Unix ms. Tokens expire after a while. */
  expiresAt: number
}

export interface Credentials {
  email: string
  password: string
}

/* -------------------------------------------------------------------------- */
/* Geography & addresses                                                       */
/* -------------------------------------------------------------------------- */

export interface Country {
  code: string
  name: string
}

export interface Region {
  id: number
  countryCode: string
  name: string
}

export interface City {
  id: number
  regionId: number
  name: string
  regionName?: string
}

export interface Address {
  id: number
  userId: number
  label: string | null
  recipientName: string
  phone: string
  cityId: number
  cityName: string
  regionName: string
  district: string | null
  streetAddress: string
  postalCode: string | null
  deliveryInstructions?: string | null
  isDefault: boolean
}

/* -------------------------------------------------------------------------- */
/* Sellers                                                                     */
/* -------------------------------------------------------------------------- */

export type VerificationStatus = 'not_submitted' | 'pending' | 'approved' | 'rejected'
export type SellerStatus = 'active' | 'paused' | 'suspended' | 'closed'

export interface Seller {
  id: number
  userId: number
  storeName: string
  storeSlug: string
  storeDescription: string | null
  logoUrl: string | null
  bannerUrl: string | null
  businessCategory: string | null
  contactPhone?: string | null
  regionId?: number | null
  cityId?: number | null
  verificationStatus: VerificationStatus
  verificationNotes?: string | null
  commissionRate: number
  status: SellerStatus
  createdAt: string
  /** Hydrated convenience fields. */
  ownerName?: string
  ownerEmail?: string
  ownerPhone?: string | null
  address?: string | null
  productCount?: number
  totalSales?: number
  rating?: number
  reviewCount?: number
}

/* -------------------------------------------------------------------------- */
/* Catalog                                                                     */
/* -------------------------------------------------------------------------- */

export interface Category {
  id: number
  parentId: number | null
  name: string
  slug: string
  description: string | null
  imageUrl: string | null
  sortOrder: number
  status: 'active' | 'inactive'
  /** Derived: number of active products. */
  productCount?: number
}

export type ProductStatus = 'draft' | 'pending_review' | 'active' | 'rejected' | 'archived'
export type ConditionType = 'new' | 'used' | 'refurbished'

export interface ProductImage {
  id: number
  productId: number
  imageUrl: string
  altText: string | null
  sortOrder: number
  isPrimary: boolean
}

export interface ProductVariant {
  id: number
  productId: number
  sku: string
  variantName: string
  price: number
  compareAtPrice: number | null
  costPrice: number | null
  weightGrams: number | null
  isDefault: boolean
  isActive: boolean
  /** Hydrated from `product_option_values` via `variant_option_values`. */
  options: Record<string, string>
  /** Derived from the `inventory` table. */
  stock: number
  lowStockThreshold: number
  reserved?: number
}

export interface ProductOptionType {
  name: string
  values: string[]
}

export interface Review {
  id: number
  productId: number
  userId: number
  orderItemId: number | null
  rating: number
  title: string | null
  reviewText: string | null
  status: 'pending' | 'published' | 'hidden' | 'rejected'
  sellerReply: string | null
  sellerRepliedAt: string | null
  createdAt: string
  /** Hydrated. */
  customerName?: string
  customerAvatar?: string | null
  productName?: string
  /** Moderation: reported reviews surface here. */
  reported?: boolean
  reportReason?: string | null
}

export interface Product {
  id: number
  sellerId: number
  categoryId: number | null
  name: string
  slug: string
  shortDescription: string | null
  description: string | null
  brand: string | null
  conditionType: ConditionType
  status: ProductStatus
  rejectionReason?: string | null
  currency: string
  createdAt: string
  updatedAt: string
  /** Hydrated relations. */
  categoryName?: string
  categorySlug?: string
  sellerName?: string
  sellerSlug?: string
  images: ProductImage[]
  variants: ProductVariant[]
  optionTypes: ProductOptionType[]
  /** Derived from v_product_rating_summary. */
  rating: number
  reviewCount: number
  soldCount: number
  tags?: string[]
  /** Present on catalogue summaries (the card can render without variants). */
  primaryImage?: string | null
  minPrice?: number | null
  maxPrice?: number | null
  availableStock?: number
  variantCount?: number
}

/* -------------------------------------------------------------------------- */
/* Cart & wishlist                                                             */
/* -------------------------------------------------------------------------- */

export interface CartItem {
  /** Server cart-line id, used by PATCH/DELETE /cart/items/{id}. */
  id?: number
  /** Client-side line key: variantId is unique per cart (uq_cart_variant). */
  variantId: number
  productId: number
  name: string
  slug: string
  imageUrl: string
  variantName: string
  sku: string
  unitPrice: number
  compareAtPrice: number | null
  quantity: number
  stock: number
  options: Record<string, string>
  sellerId: number
  sellerName?: string
  available?: boolean
  unavailableReason?: string | null
}

export interface WishlistEntry {
  productId: number
  addedAt: string
}

/* -------------------------------------------------------------------------- */
/* Promotions                                                                  */
/* -------------------------------------------------------------------------- */

export interface Coupon {
  id: number
  code: string
  description: string | null
  discountType: 'percentage' | 'fixed'
  discountValue: number
  minimumOrderAmount: number
  maximumDiscountAmount: number | null
  usageLimit: number | null
  usedCount: number
  perUserLimit: number | null
  startsAt: string | null
  expiresAt: string | null
  status: 'active' | 'inactive' | 'expired'
}

export interface Banner {
  id: number
  title: string
  subtitle: string | null
  imageUrl: string | null
  buttonText: string | null
  targetUrl: string | null
  placement: 'home_hero' | 'home_promo' | 'category' | 'other'
  startsAt: string | null
  endsAt: string | null
  sortOrder: number
  status: 'draft' | 'active' | 'inactive'
}

/* -------------------------------------------------------------------------- */
/* Orders                                                                      */
/* -------------------------------------------------------------------------- */

export type OrderStatus =
  | 'pending'
  | 'confirmed'
  | 'processing'
  | 'partially_shipped'
  | 'shipped'
  | 'delivered'
  | 'cancelled'
  | 'refunded'

export type PaymentStatus =
  | 'unpaid'
  | 'pending'
  | 'paid'
  | 'partially_refunded'
  | 'refunded'
  | 'failed'

export type FulfillmentStatus = 'unfulfilled' | 'partial' | 'fulfilled' | 'returned'

export interface OrderItem {
  id: number
  orderId: number
  productId: number | null
  variantId: number | null
  sellerId: number | null
  productSlug: string
  productName: string
  sku: string
  variantName: string
  imageUrl: string | null
  quantity: number
  unitPrice: number
  discountAmount: number
  sellerCommissionRate: number
  fulfillmentStatus: 'unfulfilled' | 'processing' | 'shipped' | 'delivered' | 'cancelled' | 'returned'
}

export interface OrderAdjustment {
  id: number
  orderId: number
  adjustmentType: 'shipping' | 'tax' | 'discount' | 'fee' | 'refund_adjustment'
  label: string
  amount: number
}

export interface OrderStatusEvent {
  id: number
  orderId: number
  oldStatus: string | null
  newStatus: string
  note: string | null
  createdAt: string
}

export interface Order {
  id: number
  orderNumber: string
  userId: number | null
  customerEmail: string
  customerName: string
  customerPhone: string
  currency: string
  status: OrderStatus
  paymentStatus: PaymentStatus
  fulfillmentStatus: FulfillmentStatus
  shippingAddressLine: string
  shippingDistrict: string | null
  shippingCity: string
  shippingRegion: string
  shippingCountryCode: string
  shippingPostalCode: string | null
  shippingInstructions: string | null
  customerNote: string | null
  placedAt: string
  deliveredAt?: string | null
  items: OrderItem[]
  adjustments: OrderAdjustment[]
  history: OrderStatusEvent[]
  itemsSubtotal: number
  itemsDiscount: number
  shippingTotal: number
  taxTotal: number
  grandTotal: number
  paymentMethod?: string
  itemCount?: number
  sellerCount?: number
  sellerSubtotal?: number
}

/* -------------------------------------------------------------------------- */
/* Payments, shipments, refunds, payouts                                       */
/* -------------------------------------------------------------------------- */

export interface Payment {
  id: number
  orderId: number
  provider: string
  providerReference: string | null
  amount: number
  currency: string
  status: 'initiated' | 'pending' | 'succeeded' | 'failed' | 'cancelled' | 'refunded' | 'partially_refunded'
  paymentMethod: string | null
  paidAt: string | null
  createdAt: string
}

export interface Shipment {
  id: number
  orderId: number
  carrier: string | null
  serviceName: string | null
  trackingNumber: string | null
  status: 'pending' | 'packed' | 'shipped' | 'in_transit' | 'delivered' | 'failed' | 'returned'
  shippingCost: number
  shippedAt: string | null
  deliveredAt: string | null
}

export type PayoutStatus = 'requested' | 'pending' | 'processing' | 'paid' | 'rejected' | 'failed'

export interface SellerPayout {
  id: number
  sellerId: number
  payoutReference: string
  amount: number
  currency: string
  payoutMethod: string | null
  destinationLabel: string | null
  status: PayoutStatus
  requestedAt: string
  processedAt: string | null
  adminNote: string | null
  sellerName?: string
  itemCount?: number
}

export interface Transaction {
  id: number
  reference: string
  orderId: number | null
  orderNumber: string
  customerName: string
  sellerName: string
  amount: number
  commission: number
  netToSeller: number
  method: string
  status: 'paid' | 'pending' | 'refunded' | 'failed'
  createdAt: string
}

export interface Refund {
  id: number
  orderId: number
  orderNumber: string
  customerName: string
  amount: number
  reason: string
  status: 'requested' | 'approved' | 'rejected' | 'processing' | 'succeeded' | 'failed'
  createdAt: string
}

/* -------------------------------------------------------------------------- */
/* Notifications, support, activity                                            */
/* -------------------------------------------------------------------------- */

export interface AppNotification {
  id: number
  userId: number
  type: string
  title: string
  message: string
  targetUrl: string | null
  readAt: string | null
  createdAt: string
}

export interface SupportMessage {
  id: number
  name: string
  email: string
  subject: string
  message: string
  status: 'new' | 'in_progress' | 'resolved' | 'closed'
  createdAt: string
  assignedToName?: string | null
}

export interface ActivityLog {
  id: number
  actorName: string
  action: string
  entityType: string
  entityLabel: string
  createdAt: string
  actorEmail?: string
  details?: Record<string, unknown>
}

/* -------------------------------------------------------------------------- */
/* Analytics                                                                   */
/* -------------------------------------------------------------------------- */

export interface SeriesPoint {
  label: string
  revenue: number
  orders: number
}

export interface DashboardStats {
  totalRevenue: number
  revenueChange: number
  totalOrders: number
  ordersChange: number
  totalCustomers: number
  customersChange: number
  activeSellers: number
  sellersChange: number
  totalProducts: number
  productsChange: number
  pendingApplications: number
  pendingProducts: number
  conversionRate: number
  averageOrderValue: number
}

/* -------------------------------------------------------------------------- */
/* Shared UI helpers                                                           */
/* -------------------------------------------------------------------------- */

export interface SelectOption {
  label: string
  value: string
}

export interface Paginated<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export type SortKey =
  | 'popularity'
  | 'newest'
  | 'price-asc'
  | 'price-desc'
  | 'rating'
  | 'name-asc'
