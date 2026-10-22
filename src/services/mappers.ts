/**
 * API → domain mappers.
 *
 * The PHP API returns money as decimal strings (BCMath on the server) and uses
 * snake_case for request payloads. These mappers convert to the camelCase,
 * number-based shapes the existing UI components consume. Money is only ever
 * converted for display; all authoritative arithmetic happens server-side.
 */

import type {
  ActivityLog,
  Address,
  AppNotification,
  Banner,
  CartItem,
  Category,
  City,
  Country,
  Coupon,
  Order,
  OrderAdjustment,
  OrderItem,
  OrderStatusEvent,
  Paginated,
  Payment,
  Product,
  ProductImage,
  ProductOptionType,
  ProductVariant,
  Refund,
  Region,
  Review,
  Seller,
  SellerPayout,
  SupportMessage,
  Transaction,
  User,
} from '@/types'

/* eslint-disable @typescript-eslint/no-explicit-any */
type Row = Record<string, any>

export function num(value: unknown, fallback = 0): number {
  if (value === null || value === undefined || value === '') return fallback
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

export function numOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function str(value: unknown, fallback = ''): string {
  return value === null || value === undefined ? fallback : String(value)
}

function strOrNull(value: unknown): string | null {
  return value === null || value === undefined || value === '' ? null : String(value)
}

function bool(value: unknown, fallback = false): boolean {
  if (typeof value === 'boolean') return value
  if (value === 1 || value === '1' || value === 'true') return true
  if (value === 0 || value === '0' || value === 'false') return false
  return fallback
}

function paginate<T>(items: T[], meta: Record<string, any> | undefined, pageSize: number): Paginated<T> {
  const pagination = meta?.pagination ?? {}
  const total = num(pagination.total, items.length)
  const page = num(pagination.page, 1)
  const perPage = num(pagination.per_page, pageSize)
  return {
    items,
    total,
    page,
    pageSize: perPage,
    totalPages: num(pagination.total_pages, Math.max(1, Math.ceil(total / Math.max(1, perPage)))),
  }
}

export { paginate }

/* -------------------------------------------------------------------------- */
/* Users & auth                                                                */
/* -------------------------------------------------------------------------- */

export function mapUser(row: Row): User {
  return {
    id: num(row.id),
    fullName: str(row.fullName ?? row.full_name),
    email: str(row.email),
    phone: strOrNull(row.phone),
    avatarUrl: strOrNull(row.avatarUrl ?? row.avatar_url),
    roles: (Array.isArray(row.roles) ? row.roles.map(String) : []) as User['roles'],
    status: (row.status ?? 'active') as User['status'],
    emailVerifiedAt: strOrNull(row.emailVerifiedAt ?? row.email_verified_at),
    createdAt: str(row.createdAt ?? row.created_at),
    lastLoginAt: strOrNull(row.lastLoginAt ?? row.last_login_at),
    sellerId: row.sellerId !== undefined && row.sellerId !== null ? num(row.sellerId) : undefined,
  }
}

/* -------------------------------------------------------------------------- */
/* Geography                                                                   */
/* -------------------------------------------------------------------------- */

export function mapCountry(row: Row): Country {
  return { code: str(row.code), name: str(row.name) }
}

export function mapRegion(row: Row): Region {
  return { id: num(row.id), countryCode: str(row.countryCode ?? row.country_code), name: str(row.name) }
}

export function mapCity(row: Row): City {
  return {
    id: num(row.id),
    regionId: num(row.regionId ?? row.region_id),
    name: str(row.name),
    regionName: strOrNull(row.regionName ?? row.region_name) ?? undefined,
  }
}

export function mapAddress(row: Row): Address {
  return {
    id: num(row.id),
    userId: num(row.userId ?? row.user_id),
    label: strOrNull(row.label),
    recipientName: str(row.recipientName ?? row.recipient_name),
    phone: str(row.phone),
    cityId: num(row.cityId ?? row.city_id),
    cityName: str(row.cityName ?? row.city_name),
    regionName: str(row.regionName ?? row.region_name),
    district: strOrNull(row.district),
    streetAddress: str(row.streetAddress ?? row.street_address),
    postalCode: strOrNull(row.postalCode ?? row.postal_code),
    deliveryInstructions: strOrNull(row.deliveryInstructions ?? row.delivery_instructions),
    isDefault: bool(row.isDefault ?? row.is_default),
  }
}

/* -------------------------------------------------------------------------- */
/* Sellers                                                                     */
/* -------------------------------------------------------------------------- */

export function mapSeller(row: Row): Seller {
  return {
    id: num(row.id),
    userId: num(row.userId ?? row.user_id),
    storeName: str(row.storeName ?? row.store_name),
    storeSlug: str(row.storeSlug ?? row.store_slug),
    storeDescription: strOrNull(row.storeDescription ?? row.store_description),
    logoUrl: strOrNull(row.logoUrl ?? row.logo_url),
    bannerUrl: strOrNull(row.bannerUrl ?? row.banner_url),
    businessCategory: strOrNull(row.businessCategory ?? row.business_category),
    contactPhone: strOrNull(row.contactPhone ?? row.contact_phone),
    regionId: row.regionId != null || row.region_id != null ? num(row.regionId ?? row.region_id) : null,
    cityId: row.cityId != null || row.city_id != null ? num(row.cityId ?? row.city_id) : null,
    address: strOrNull(row.address),
    verificationStatus: (row.verificationStatus ?? row.verification_status ?? 'not_submitted') as Seller['verificationStatus'],
    verificationNotes: strOrNull(row.verificationNotes ?? row.verification_notes),
    commissionRate: num(row.commissionRate ?? row.commission_rate),
    status: (row.status ?? 'active') as Seller['status'],
    createdAt: str(row.createdAt ?? row.created_at),
    ownerName: strOrNull(row.ownerName ?? row.owner_name) ?? undefined,
    ownerEmail: strOrNull(row.ownerEmail ?? row.owner_email) ?? undefined,
    ownerPhone: strOrNull(row.ownerPhone ?? row.owner_phone),
    productCount: row.productCount !== undefined || row.product_count !== undefined
      ? num(row.productCount ?? row.product_count)
      : undefined,
    totalSales: row.totalSales !== undefined ? num(row.totalSales) : undefined,
  }
}

/* -------------------------------------------------------------------------- */
/* Catalogue                                                                   */
/* -------------------------------------------------------------------------- */

export function mapCategory(row: Row): Category {
  return {
    id: num(row.id),
    parentId: numOrNull(row.parentId ?? row.parent_id),
    name: str(row.name),
    slug: str(row.slug),
    description: strOrNull(row.description),
    imageUrl: strOrNull(row.imageUrl ?? row.image_url),
    sortOrder: num(row.sortOrder ?? row.sort_order),
    status: (row.status ?? 'active') as Category['status'],
    productCount: row.productCount !== undefined || row.product_count !== undefined
      ? num(row.productCount ?? row.product_count)
      : undefined,
  }
}

export function mapProductImage(row: Row): ProductImage {
  return {
    id: num(row.id),
    productId: num(row.productId ?? row.product_id),
    imageUrl: str(row.imageUrl ?? row.image_url),
    altText: strOrNull(row.altText ?? row.alt_text),
    sortOrder: num(row.sortOrder ?? row.sort_order),
    isPrimary: bool(row.isPrimary ?? row.is_primary),
  }
}

export function mapVariant(row: Row): ProductVariant {
  return {
    id: num(row.id),
    productId: num(row.productId ?? row.product_id),
    sku: str(row.sku),
    variantName: str(row.variantName ?? row.variant_name, 'Default'),
    price: num(row.price),
    compareAtPrice: numOrNull(row.compareAtPrice ?? row.compare_at_price),
    costPrice: numOrNull(row.costPrice ?? row.cost_price),
    weightGrams: numOrNull(row.weightGrams ?? row.weight_grams),
    isDefault: bool(row.isDefault ?? row.is_default),
    isActive: bool(row.isActive ?? row.is_active, true),
    options: (row.options && typeof row.options === 'object' ? row.options : {}) as Record<string, string>,
    stock: num(row.stock ?? row.availableStock ?? row.available_stock ?? row.quantity_on_hand),
    lowStockThreshold: num(row.lowStockThreshold ?? row.low_stock_threshold, 5),
    reserved: row.quantityReserved !== undefined || row.quantity_reserved !== undefined
      ? num(row.quantityReserved ?? row.quantity_reserved)
      : undefined,
  }
}

function mapOptionTypes(row: Row): ProductOptionType[] {
  if (!Array.isArray(row.optionTypes)) return []
  return row.optionTypes.map((option: Row) => ({
    name: str(option.name),
    values: Array.isArray(option.values) ? option.values.map(String) : [],
  }))
}

function summaryImage(row: Row): ProductImage[] {
  const primary = strOrNull(row.primaryImage ?? row.primary_image)
  if (!primary) return []
  return [
    {
      id: 0,
      productId: num(row.id),
      imageUrl: primary,
      altText: strOrNull(row.name),
      sortOrder: 0,
      isPrimary: true,
    },
  ]
}

/** Public catalogue list row (no variants). Product cards degrade gracefully. */
export function mapProductSummary(row: Row): Product {
  return {
    id: num(row.id),
    sellerId: num(row.sellerId ?? row.seller_id),
    categoryId: numOrNull(row.categoryId ?? row.category_id),
    name: str(row.name),
    slug: str(row.slug),
    shortDescription: strOrNull(row.shortDescription ?? row.short_description),
    description: strOrNull(row.description),
    brand: strOrNull(row.brand),
    conditionType: (row.conditionType ?? row.condition_type ?? 'new') as Product['conditionType'],
    status: (row.status ?? 'active') as Product['status'],
    rejectionReason: strOrNull(row.rejectionReason ?? row.rejection_reason),
    currency: str(row.currency, 'TZS'),
    createdAt: str(row.createdAt ?? row.created_at),
    updatedAt: str(row.updatedAt ?? row.updated_at),
    categoryName: strOrNull(row.categoryName ?? row.category_name) ?? undefined,
    categorySlug: strOrNull(row.categorySlug ?? row.category_slug) ?? undefined,
    sellerName: strOrNull(row.sellerName ?? row.seller_name) ?? undefined,
    sellerSlug: strOrNull(row.sellerSlug ?? row.seller_slug) ?? undefined,
    images: summaryImage(row),
    variants: [],
    optionTypes: [],
    rating: num(row.rating),
    reviewCount: num(row.reviewCount ?? row.review_count),
    soldCount: num(row.soldCount ?? row.sold_count),
    tags: [],
    primaryImage: strOrNull(row.primaryImage ?? row.primary_image),
    minPrice: numOrNull(row.minPrice ?? row.min_price),
    maxPrice: numOrNull(row.maxPrice ?? row.max_price),
    availableStock: num(row.availableStock ?? row.available_stock),
    variantCount: num(row.variantCount ?? row.variant_count),
  }
}

export function mapProduct(row: Row): Product {
  const variants = Array.isArray(row.variants) ? row.variants.map(mapVariant) : []
  const images = Array.isArray(row.images) ? row.images.map(mapProductImage) : summaryImage(row)
  const prices = variants.map((variant) => variant.price).filter((price) => price > 0)
  const primary = images.find((image) => image.isPrimary)?.imageUrl ?? images[0]?.imageUrl ?? null

  return {
    ...mapProductSummary(row),
    description: strOrNull(row.description),
    images,
    variants,
    optionTypes: mapOptionTypes(row),
    primaryImage: primary,
    minPrice: prices.length > 0 ? Math.min(...prices) : numOrNull(row.minPrice ?? row.min_price),
    maxPrice: prices.length > 0 ? Math.max(...prices) : numOrNull(row.maxPrice ?? row.max_price),
    availableStock: variants.length > 0
      ? variants.reduce((sum, variant) => sum + variant.stock, 0)
      : num(row.availableStock ?? row.available_stock),
    variantCount: variants.length || num(row.variantCount ?? row.variant_count),
  }
}

export function mapReview(row: Row): Review {
  return {
    id: num(row.id),
    productId: num(row.productId ?? row.product_id),
    userId: num(row.userId ?? row.user_id),
    orderItemId: numOrNull(row.orderItemId ?? row.order_item_id),
    rating: num(row.rating),
    title: strOrNull(row.title),
    reviewText: strOrNull(row.reviewText ?? row.review_text),
    status: (row.status ?? 'published') as Review['status'],
    sellerReply: strOrNull(row.sellerReply ?? row.seller_reply),
    sellerRepliedAt: strOrNull(row.sellerRepliedAt ?? row.seller_replied_at),
    createdAt: str(row.createdAt ?? row.created_at),
    customerName: strOrNull(row.customerName ?? row.customer_name) ?? undefined,
    customerAvatar: strOrNull(row.customerAvatar ?? row.customer_avatar),
    productName: strOrNull(row.productName ?? row.product_name) ?? undefined,
    reported: bool(row.reported),
    reportReason: strOrNull(row.reportReason ?? row.report_reason),
  }
}

export function mapCoupon(row: Row): Coupon {
  return {
    id: num(row.id),
    code: str(row.code),
    description: strOrNull(row.description),
    discountType: (row.discountType ?? row.discount_type ?? 'percentage') as Coupon['discountType'],
    discountValue: num(row.discountValue ?? row.discount_value),
    minimumOrderAmount: num(row.minimumOrderAmount ?? row.minimum_order_amount),
    maximumDiscountAmount: numOrNull(row.maximumDiscountAmount ?? row.maximum_discount_amount),
    usageLimit: numOrNull(row.usageLimit ?? row.usage_limit),
    usedCount: num(row.usedCount ?? row.used_count),
    perUserLimit: numOrNull(row.perUserLimit ?? row.per_user_limit),
    startsAt: strOrNull(row.startsAt ?? row.starts_at),
    expiresAt: strOrNull(row.expiresAt ?? row.expires_at),
    status: (row.status ?? 'inactive') as Coupon['status'],
  }
}

export function mapBanner(row: Row): Banner {
  return {
    id: num(row.id),
    title: str(row.title),
    subtitle: strOrNull(row.subtitle),
    imageUrl: strOrNull(row.imageUrl ?? row.image_url),
    buttonText: strOrNull(row.buttonText ?? row.button_text),
    targetUrl: strOrNull(row.targetUrl ?? row.target_url),
    placement: (row.placement ?? 'other') as Banner['placement'],
    startsAt: strOrNull(row.startsAt ?? row.starts_at),
    endsAt: strOrNull(row.endsAt ?? row.ends_at),
    sortOrder: num(row.sortOrder ?? row.sort_order),
    status: (row.status ?? 'draft') as Banner['status'],
  }
}

/* -------------------------------------------------------------------------- */
/* Cart                                                                        */
/* -------------------------------------------------------------------------- */

export interface CartPayload {
  items: CartItem[]
  itemCount: number
  subtotal: number
  hasUnavailableItems: boolean
}

export function mapCartItem(row: Row): CartItem {
  return {
    id: num(row.id),
    variantId: num(row.variantId ?? row.variant_id),
    productId: num(row.productId ?? row.product_id),
    name: str(row.name ?? row.productName ?? row.product_name),
    slug: str(row.slug ?? row.productSlug ?? row.product_slug),
    imageUrl: str(row.imageUrl ?? row.image_url),
    variantName: str(row.variantName ?? row.variant_name, 'Default'),
    sku: str(row.sku),
    unitPrice: num(row.unitPrice ?? row.unit_price ?? row.price),
    compareAtPrice: numOrNull(row.compareAtPrice ?? row.compare_at_price),
    quantity: num(row.quantity, 1),
    stock: num(row.stock ?? row.availableStock ?? row.available_stock),
    options: {},
    sellerId: num(row.sellerId ?? row.seller_id),
    sellerName: strOrNull(row.sellerName ?? row.seller_name) ?? undefined,
    available: bool(row.available, true),
    unavailableReason: strOrNull(row.unavailableReason ?? row.unavailable_reason),
  }
}

export function mapCart(row: Row | null): CartPayload {
  const items = Array.isArray(row?.items) ? row!.items.map(mapCartItem) : []
  return {
    items,
    itemCount: num(row?.itemCount ?? row?.item_count, items.reduce((sum, item) => sum + item.quantity, 0)),
    subtotal: num(row?.subtotal, items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0)),
    hasUnavailableItems: bool(row?.hasUnavailableItems ?? row?.has_unavailable_items),
  }
}

/* -------------------------------------------------------------------------- */
/* Orders & payments                                                           */
/* -------------------------------------------------------------------------- */

export function mapOrderItem(row: Row): OrderItem {
  return {
    id: num(row.id),
    orderId: num(row.orderId ?? row.order_id),
    productId: numOrNull(row.productId ?? row.product_id),
    variantId: numOrNull(row.variantId ?? row.variant_id),
    sellerId: numOrNull(row.sellerId ?? row.seller_id),
    productSlug: str(row.productSlug ?? row.product_slug),
    productName: str(row.productName ?? row.product_name),
    sku: str(row.sku),
    variantName: str(row.variantName ?? row.variant_name, 'Default'),
    imageUrl: strOrNull(row.imageUrl ?? row.image_url),
    quantity: num(row.quantity),
    unitPrice: num(row.unitPrice ?? row.unit_price),
    discountAmount: num(row.discountAmount ?? row.discount_amount),
    sellerCommissionRate: num(row.sellerCommissionRate ?? row.seller_commission_rate),
    fulfillmentStatus: (row.fulfillmentStatus ?? row.fulfillment_status ?? 'unfulfilled') as OrderItem['fulfillmentStatus'],
  }
}

export function mapOrderAdjustment(row: Row): OrderAdjustment {
  return {
    id: num(row.id),
    orderId: num(row.orderId ?? row.order_id),
    adjustmentType: (row.adjustmentType ?? row.adjustment_type ?? 'fee') as OrderAdjustment['adjustmentType'],
    label: str(row.label),
    amount: num(row.amount),
  }
}

export function mapOrderHistory(row: Row): OrderStatusEvent {
  return {
    id: num(row.id),
    orderId: num(row.orderId ?? row.order_id),
    oldStatus: strOrNull(row.oldStatus ?? row.old_status),
    newStatus: str(row.newStatus ?? row.new_status),
    note: strOrNull(row.note),
    createdAt: str(row.createdAt ?? row.created_at),
  }
}

export function mapOrder(row: Row): Order {
  return {
    id: num(row.id),
    orderNumber: str(row.orderNumber ?? row.order_number),
    userId: numOrNull(row.userId ?? row.user_id),
    customerEmail: str(row.customerEmail ?? row.customer_email),
    customerName: str(row.customerName ?? row.customer_name),
    customerPhone: str(row.customerPhone ?? row.customer_phone),
    currency: str(row.currency, 'TZS'),
    status: (row.status ?? 'pending') as Order['status'],
    paymentStatus: (row.paymentStatus ?? row.payment_status ?? 'unpaid') as Order['paymentStatus'],
    fulfillmentStatus: (row.fulfillmentStatus ?? row.fulfillment_status ?? 'unfulfilled') as Order['fulfillmentStatus'],
    shippingAddressLine: str(row.shippingAddressLine ?? row.shipping_address_line),
    shippingDistrict: strOrNull(row.shippingDistrict ?? row.shipping_district),
    shippingCity: str(row.shippingCity ?? row.shipping_city),
    shippingRegion: str(row.shippingRegion ?? row.shipping_region),
    shippingCountryCode: str(row.shippingCountryCode ?? row.shipping_country_code, 'TZ'),
    shippingPostalCode: strOrNull(row.shippingPostalCode ?? row.shipping_postal_code),
    shippingInstructions: strOrNull(row.shippingInstructions ?? row.shipping_instructions),
    customerNote: strOrNull(row.customerNote ?? row.customer_note),
    placedAt: str(row.placedAt ?? row.placed_at),
    deliveredAt: strOrNull(row.deliveredAt ?? row.delivered_at),
    items: Array.isArray(row.items) ? row.items.map(mapOrderItem) : [],
    adjustments: Array.isArray(row.adjustments) ? row.adjustments.map(mapOrderAdjustment) : [],
    history: Array.isArray(row.history) ? row.history.map(mapOrderHistory) : [],
    itemsSubtotal: num(row.itemsSubtotal ?? row.items_subtotal),
    itemsDiscount: num(row.itemsDiscount ?? row.items_discount),
    shippingTotal: num(row.shippingTotal ?? row.shipping_total),
    taxTotal: num(row.taxTotal ?? row.tax_total),
    grandTotal: num(row.grandTotal ?? row.grand_total),
    paymentMethod: strOrNull(row.paymentMethod ?? row.payment_method) ?? undefined,
    itemCount: row.itemCount !== undefined || row.item_count !== undefined
      ? num(row.itemCount ?? row.item_count)
      : undefined,
    sellerCount: row.sellerCount !== undefined || row.seller_count !== undefined
      ? num(row.sellerCount ?? row.seller_count)
      : undefined,
    sellerSubtotal: row.sellerSubtotal !== undefined || row.seller_subtotal !== undefined
      ? num(row.sellerSubtotal ?? row.seller_subtotal)
      : undefined,
  }
}

export function mapPayment(row: Row): Payment {
  return {
    id: num(row.id),
    orderId: num(row.orderId ?? row.order_id),
    provider: str(row.provider),
    providerReference: strOrNull(row.providerReference ?? row.provider_reference),
    amount: num(row.amount),
    currency: str(row.currency, 'TZS'),
    status: (row.status ?? 'pending') as Payment['status'],
    paymentMethod: strOrNull(row.paymentMethod ?? row.payment_method),
    paidAt: strOrNull(row.paidAt ?? row.paid_at),
    createdAt: str(row.createdAt ?? row.created_at),
  }
}

export function mapTransaction(row: Row): Transaction {
  const status = str(row.status)
  return {
    id: num(row.id),
    reference: str(row.providerReference ?? row.provider_reference ?? row.reference),
    orderId: numOrNull(row.orderId ?? row.order_id),
    orderNumber: str(row.orderNumber ?? row.order_number),
    customerName: str(row.customerName ?? row.customer_name),
    sellerName: str(row.sellerName ?? row.seller_name),
    amount: num(row.amount),
    commission: num(row.commission),
    netToSeller: num(row.netToSeller ?? row.net_to_seller, num(row.amount)),
    method: str(row.paymentMethod ?? row.payment_method ?? row.provider),
    status:
      status === 'succeeded' || status === 'paid'
        ? 'paid'
        : status === 'refunded' || status === 'partially_refunded'
          ? 'refunded'
          : status === 'failed' || status === 'cancelled'
            ? 'failed'
            : 'pending',
    createdAt: str(row.createdAt ?? row.created_at),
  }
}

export function mapRefund(row: Row): Refund {
  return {
    id: num(row.id),
    orderId: num(row.orderId ?? row.order_id),
    orderNumber: str(row.orderNumber ?? row.order_number),
    customerName: str(row.customerName ?? row.customer_name),
    amount: num(row.amount),
    reason: str(row.reason),
    status: (row.status ?? 'requested') as Refund['status'],
    createdAt: str(row.createdAt ?? row.created_at),
  }
}

export function mapPayout(row: Row): SellerPayout {
  return {
    id: num(row.id),
    sellerId: num(row.sellerId ?? row.seller_id),
    payoutReference: str(row.payoutReference ?? row.payout_reference),
    amount: num(row.amount),
    currency: str(row.currency, 'TZS'),
    payoutMethod: strOrNull(row.payoutMethod ?? row.payout_method),
    destinationLabel: strOrNull(row.destinationLabel ?? row.destination_label),
    status: (row.status ?? 'requested') as SellerPayout['status'],
    requestedAt: str(row.requestedAt ?? row.requested_at),
    processedAt: strOrNull(row.processedAt ?? row.processed_at),
    adminNote: strOrNull(row.adminNote ?? row.admin_note),
    sellerName: strOrNull(row.sellerName ?? row.seller_name) ?? undefined,
    itemCount: row.itemCount !== undefined || row.item_count !== undefined
      ? num(row.itemCount ?? row.item_count)
      : undefined,
  }
}

/* -------------------------------------------------------------------------- */
/* Notifications, support, activity                                            */
/* -------------------------------------------------------------------------- */

export function mapNotification(row: Row): AppNotification {
  return {
    id: num(row.id),
    userId: num(row.userId ?? row.user_id),
    type: str(row.type, 'system'),
    title: str(row.title),
    message: str(row.message),
    targetUrl: strOrNull(row.targetUrl ?? row.target_url),
    readAt: strOrNull(row.readAt ?? row.read_at),
    createdAt: str(row.createdAt ?? row.created_at),
  }
}

export function mapSupport(row: Row): SupportMessage {
  return {
    id: num(row.id),
    name: str(row.name),
    email: str(row.email),
    subject: str(row.subject),
    message: str(row.message),
    status: (row.status ?? 'new') as SupportMessage['status'],
    createdAt: str(row.createdAt ?? row.created_at),
    assignedToName: strOrNull(row.assignedToName ?? row.assigned_to_name) ?? undefined,
  }
}

export function mapActivity(row: Row): ActivityLog {
  const details = row.details && typeof row.details === 'object' ? (row.details as Row) : {}
  const entityId = row.entityId ?? row.entity_id
  return {
    id: num(row.id),
    actorName: str(row.actorName ?? row.actor_name, 'System'),
    action: str(row.action),
    entityType: str(row.entityType ?? row.entity_type, 'system'),
    entityLabel:
      strOrNull(details.label) ??
      (entityId !== null && entityId !== undefined ? `#${entityId}` : ''),
    createdAt: str(row.createdAt ?? row.created_at),
    actorEmail: strOrNull(row.actorEmail ?? row.actor_email) ?? undefined,
    details,
  }
}

/* -------------------------------------------------------------------------- */
/* Analytics                                                                   */
/* -------------------------------------------------------------------------- */

export interface AdminOverview {
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

export function mapOverview(row: Row): AdminOverview {
  return {
    totalRevenue: num(row.totalRevenue),
    revenueChange: num(row.revenueChange),
    totalOrders: num(row.totalOrders),
    ordersChange: num(row.ordersChange),
    totalCustomers: num(row.totalCustomers),
    customersChange: num(row.customersChange),
    activeSellers: num(row.activeSellers),
    sellersChange: num(row.sellersChange),
    totalProducts: num(row.totalProducts),
    productsChange: num(row.productsChange),
    pendingApplications: num(row.pendingApplications),
    pendingProducts: num(row.pendingProducts),
    conversionRate: num(row.conversionRate),
    averageOrderValue: num(row.averageOrderValue),
  }
}
