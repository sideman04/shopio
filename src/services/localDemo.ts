import { imgCard, imgWide, PHOTOS } from '@/content/images'

/**
 * Small browser-only API adapter used for presentations.
 *
 * It intentionally has no fetch calls. Records are kept in localStorage so a
 * deployed demo can be refreshed or opened on another device without a PHP
 * server or database.
 */

export const LOCAL_DEMO = import.meta.env.VITE_LOCAL_DEMO !== 'false'

type Row = Record<string, any>
type LocalResponse<T> = { success: true; message: string; data: T; meta: Record<string, any> }

const keys = {
  user: 'shopio.demo.user',
  orders: 'shopio.demo.orders',
  cart: 'shopio.demo.cart',
  addresses: 'shopio.demo.addresses',
  wishlist: 'shopio.demo.wishlist',
}

function read<T>(key: string, fallback: T): T {
  try {
    const value = localStorage.getItem(key)
    return value ? (JSON.parse(value) as T) : fallback
  } catch {
    return fallback
  }
}

function write(key: string, value: unknown) {
  try { localStorage.setItem(key, JSON.stringify(value)) } catch { /* private mode */ }
}

const now = new Date().toISOString()
const categories: Row[] = [
  { id: 1, name: 'Furniture & Home', slug: 'furniture-home', description: 'Comfort for every room', status: 'active', sort_order: 1, product_count: 6 },
  { id: 2, name: 'Electronics', slug: 'electronics', description: 'Smart tech for modern living', status: 'active', sort_order: 2, product_count: 6 },
  { id: 3, name: 'Fashion & Apparel', slug: 'fashion-apparel', description: 'Everyday looks, elevated', status: 'active', sort_order: 3, product_count: 5 },
  { id: 4, name: 'Home Decor', slug: 'home-decor', description: 'Finishing touches with character', status: 'active', sort_order: 4, product_count: 5 },
]

const seller = { id: 1, user_id: 1, store_name: 'Demo Marketplace', store_slug: 'demo-marketplace', store_description: 'A ready-to-present Shopio store', business_category: 'Lifestyle', verification_status: 'approved', commission_rate: 10, status: 'active', created_at: now, owner_name: 'Demo Seller', owner_email: 'seller@shopio.test' }

const photoSets = [PHOTOS.furniture, PHOTOS.electronics, PHOTOS.fashion, PHOTOS['home-decor']]
const names = [
  'Linen Lounge Chair', 'Oak Coffee Table', 'Studio Desk Lamp', 'Wireless Headphones',
  'Everyday Smart Watch', 'Minimal Laptop Stand', 'Classic Canvas Sneaker', 'Relaxed Linen Shirt',
  'Leather Crossbody Bag', 'Ceramic Table Vase', 'Soft Accent Cushion', 'Modern Sideboard',
  'Boucle Accent Armchair', 'Round Nesting Tables', 'Portable Bluetooth Speaker', 'Mechanical Keyboard',
  'Oversized Cotton Hoodie', 'Everyday Leather Belt', 'Woven Storage Basket', 'Artisan Wall Mirror',
  'Rechargeable Reading Light', 'Compact Travel Backpack',
]
const prices = [420000, 680000, 185000, 320000, 450000, 210000, 165000, 125000, 230000, 95000, 75000, 890000, 510000, 295000, 275000, 390000, 185000, 90000, 120000, 260000, 140000, 310000]

const products: Row[] = names.map((name, index) => {
  const categoryIndex = index % 4
  const photo = photoSets[categoryIndex][index % photoSets[categoryIndex].length]
  const id = index + 1
  const price = prices[index]
  return {
    id, seller_id: 1, category_id: categoryIndex + 1, name, slug: name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    short_description: 'A thoughtfully selected demo product for your Shopio store.',
    description: 'A beautiful, practical product with a polished presentation. This sample record is stored locally for your demonstration.',
    brand: 'Shopio Select', condition_type: 'new', status: 'active', currency: 'TZS', created_at: now, updated_at: now,
    category_name: categories[categoryIndex].name, category_slug: categories[categoryIndex].slug, seller_name: seller.store_name, seller_slug: seller.store_slug,
    primary_image: imgCard(photo), rating: 4.5 - (index % 3) * 0.2, review_count: 12 + index * 3, sold_count: 18 + index * 7,
    min_price: price, max_price: price, available_stock: 12 + index, variant_count: 1,
    images: [{ id, product_id: id, image_url: imgCard(photo), alt_text: name, sort_order: 0, is_primary: true }],
    variants: [{ id: id * 10, product_id: id, sku: `DEMO-${String(id).padStart(3, '0')}`, variant_name: 'Default', price, compare_at_price: Math.round(price * 1.15), is_default: true, is_active: true, options: {}, stock: 12 + index, low_stock_threshold: 3 }],
  }
})

function envelope<T>(data: T, message = 'Demo data loaded'): LocalResponse<T> {
  return { success: true, message, data, meta: { pagination: { total: Array.isArray(data) ? data.length : 1, page: 1, per_page: 100, total_pages: 1, has_more: false } } }
}

function currentUser(): Row | null { return read<Row | null>(keys.user, null) }
function cartRows(): Row[] { return read<Row[]>(keys.cart, []) }
function cartPayload() {
  const items = cartRows()
  return { items, item_count: items.reduce((sum, item) => sum + Number(item.quantity || 0), 0), subtotal: items.reduce((sum, item) => sum + Number(item.unit_price || 0) * Number(item.quantity || 0), 0), has_unavailable_items: false }
}

export async function localRequest<T>(method: string, path: string, body?: unknown): Promise<LocalResponse<T>> {
  const input = (body ?? {}) as Row
  if (path === '/auth/login' || path === '/auth/register') {
    const isSeller = Boolean(input.store_name)
    const user = { id: 1, full_name: input.full_name || 'Demo Customer', email: input.email || 'demo@shopio.test', phone: input.phone || '+255 700 000 000', roles: isSeller ? ['customer', 'seller', 'admin'] : ['customer', 'seller', 'admin'], status: 'active', email_verified_at: now, created_at: now, seller_id: 1 }
    write(keys.user, user)
    return envelope({ user, token: 'local-demo-token', expiresAt: new Date(Date.now() + 86400000).toISOString() } as T, 'Welcome to Shopio demo mode')
  }
  if (path === '/auth/me') {
    const user = currentUser(); if (!user) return envelope(null as T)
    return envelope(user as T)
  }
  if (path === '/auth/logout') { localStorage.removeItem(keys.user); return envelope(null as T, 'Signed out') }
  if (path === '/customers/profile' && method === 'PATCH') { const user = { ...currentUser(), full_name: input.full_name, phone: input.phone }; write(keys.user, user); return envelope(user as T) }
  if (path === '/customers/addresses' && method === 'POST') {
    const list = read<Row[]>(keys.addresses, [])
    const address = { ...input, id: Date.now(), user_id: currentUser()?.id ?? 1, city_id: input.city_id || 1, city_name: 'Dar es Salaam', region_name: 'Dar es Salaam', is_default: Boolean(input.is_default) || list.length === 0 }
    const next = address.is_default ? list.map((item) => ({ ...item, is_default: false })) : list
    write(keys.addresses, [...next, address]); return envelope(address as T, 'Address saved locally')
  }
  if (path.startsWith('/customers/addresses/')) {
    const id = Number(path.split('/').pop()); let list = read<Row[]>(keys.addresses, [])
    if (method === 'DELETE') { write(keys.addresses, list.filter((item) => item.id !== id)); return envelope(null as T) }
    const existing = list.find((item) => item.id === id) ?? { id, user_id: currentUser()?.id ?? 1, city_name: 'Dar es Salaam', region_name: 'Dar es Salaam' }
    const updated = { ...existing, ...input, is_default: input.is_default ? true : existing.is_default }
    if (updated.is_default) list = list.map((item) => ({ ...item, is_default: item.id === id }))
    write(keys.addresses, list.some((item) => item.id === id) ? list.map((item) => item.id === id ? updated : item) : [...list, updated])
    return envelope(updated as T, 'Address updated locally')
  }
  if (path === '/products') return envelope(products as T)
  if (path.startsWith('/products/')) { const product = products.find((item) => item.slug === decodeURIComponent(path.slice('/products/'.length))); return envelope((product ?? null) as T) }
  if (path === '/categories') return envelope(categories as T)
  if (path.startsWith('/categories/')) return envelope((categories.find((item) => item.slug === decodeURIComponent(path.split('/').pop() || '')) ?? null) as T)
  if (path === '/banners') return envelope([{ id: 1, title: 'Thoughtful pieces for everyday living', subtitle: 'Discover the Shopio demo collection', image_url: imgWide(PHOTOS.furniture[2]), button_text: 'Shop now', target_url: '/shop', placement: 'home_hero', status: 'active', sort_order: 1 }] as T)
  if (path === '/sellers/store' || path.startsWith('/stores/')) return envelope(seller as T)
  if (path === '/cart' || path === '/cart/items' || path.startsWith('/cart/items/')) {
    let items = cartRows()
    if (method === 'POST') { const variant = products.flatMap((p) => p.variants).find((v) => v.id === Number(input.variant_id)); if (variant) { const product = products.find((p) => p.id === variant.product_id)!; const existing = items.find((i) => i.variant_id === variant.id); const next = { id: variant.id, variant_id: variant.id, product_id: product.id, name: product.name, slug: product.slug, image_url: product.primary_image, variant_name: variant.variant_name, sku: variant.sku, unit_price: variant.price, compare_at_price: variant.compare_at_price, quantity: Math.min(Number(existing?.quantity || 0) + Number(input.quantity || 1), variant.stock), stock: variant.stock, seller_id: 1, seller_name: seller.store_name }; items = existing ? items.map((i) => i.variant_id === variant.id ? next : i) : [...items, next]; write(keys.cart, items) } }
    if (method === 'DELETE') { if (path === '/cart') items = []; else items = items.filter((i) => i.id !== Number(path.split('/').pop())); write(keys.cart, items) }
    if (method === 'PATCH') { items = items.map((i) => i.id === Number(path.split('/').pop()) ? { ...i, quantity: Number(input.quantity) } : i); write(keys.cart, items) }
    return envelope(cartPayload() as T)
  }
  if (path === '/orders' && method === 'POST') {
    const items = cartRows(); const subtotal = items.reduce((sum, i) => sum + Number(i.unit_price) * Number(i.quantity), 0); const id = Date.now()
    const order = { id, order_number: `SHP-${String(id).slice(-6)}`, user_id: currentUser()?.id ?? 1, customer_name: input.customer_name || currentUser()?.full_name || 'Demo Customer', customer_email: input.customer_email || currentUser()?.email || 'demo@shopio.test', customer_phone: input.customer_phone || '', currency: 'TZS', status: 'confirmed', payment_status: 'paid', fulfillment_status: 'unfulfilled', shipping_address_line: input.shipping_address_line || '', shipping_district: input.shipping_district || null, shipping_city: input.shipping_city || 'Dar es Salaam', shipping_region: input.shipping_region || 'Dar es Salaam', shipping_country_code: 'TZ', shipping_postal_code: input.shipping_postal_code || null, shipping_instructions: input.shipping_instructions || null, customer_note: input.customer_note || null, placed_at: now, items: items.map((i, n) => ({ id: id + n, order_id: id, product_id: i.product_id, variant_id: i.variant_id, seller_id: 1, product_slug: i.slug, product_name: i.name, sku: i.sku, variant_name: i.variant_name, image_url: i.image_url, quantity: i.quantity, unit_price: i.unit_price, discount_amount: 0, seller_commission_rate: 10, fulfillment_status: 'unfulfilled' })), adjustments: [{ id: id + 99, order_id: id, adjustment_type: 'shipping', label: 'Delivery', amount: subtotal >= 1000000 ? 0 : 25000 }, { id: id + 100, order_id: id, adjustment_type: 'tax', label: 'VAT', amount: Math.round(subtotal * 0.18) }], history: [], items_subtotal: subtotal, items_discount: 0, shipping_total: subtotal >= 1000000 ? 0 : 25000, tax_total: Math.round(subtotal * 0.18), grand_total: subtotal + Math.round(subtotal * 0.18) + (subtotal >= 1000000 ? 0 : 25000), payment_method: input.payment_method || 'demo', item_count: items.length }
    const orders = read<Row[]>(keys.orders, []); write(keys.orders, [order, ...orders]); write(keys.cart, []); return envelope({ order, payment: null } as T, 'Demo order placed successfully')
  }
  if ((path.includes('/cancel') || path.endsWith('/status')) && path.includes('/orders/')) {
    const id = Number(path.split('/').find((part) => /^\d+$/.test(part)) ?? 0); const orders = read<Row[]>(keys.orders, []); const current = orders.find((o) => o.id === id)
    if (current) { const status = path.endsWith('/cancel') ? 'cancelled' : String(input.status || 'processing'); const updated = { ...current, status, payment_status: status === 'cancelled' ? 'refunded' : current.payment_status }; write(keys.orders, orders.map((o) => o.id === id ? updated : o)); return envelope(updated as T) }
  }
  if (path === '/orders' || path === '/sellers/orders' || path === '/admin/orders') return envelope(read<Row[]>(keys.orders, []) as T)
  if (path.startsWith('/orders/') || path.startsWith('/sellers/orders/') || path.startsWith('/admin/orders/')) { const id = Number(path.split('/').pop()); return envelope((read<Row[]>(keys.orders, []).find((o) => o.id === id) ?? null) as T) }
  if (path === '/customers/addresses') return envelope(read<Row[]>(keys.addresses, []) as T)
  if (path.startsWith('/countries')) return envelope([{ code: 'TZ', name: 'Tanzania' }] as T)
  if (path.startsWith('/regions')) return envelope([{ id: 1, country_code: 'TZ', name: 'Dar es Salaam' }] as T)
  if (path.startsWith('/cities')) return envelope([{ id: 1, region_id: 1, name: 'Dar es Salaam', region_name: 'Dar es Salaam' }] as T)
  if (path === '/customers/wishlist') return envelope(read<Row[]>(keys.wishlist, []) as T)
  if (path.startsWith('/customers/wishlist')) { const id = Number(input.product_id ?? path.split('/').pop()); const list = read<Row[]>(keys.wishlist, []); write(keys.wishlist, method === 'DELETE' ? list.filter((x) => x.productId !== id) : [...list, { productId: id, addedAt: now }]); return envelope(null as T) }
  if (path.startsWith('/admin/') || path.startsWith('/sellers/')) return envelope((path.includes('products') ? products : path.includes('categories') ? categories : path.includes('sellers') ? [seller] : []) as T)
  return envelope([] as T)
}
