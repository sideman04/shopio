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
  users: 'shopio.demo.users',
  sellers: 'shopio.demo.sellers',
  products: 'shopio.demo.products',
  categories: 'shopio.demo.categories',
  banners: 'shopio.demo.banners',
  resources: 'shopio.demo.resources',
  orders: 'shopio.demo.orders',
  cart: 'shopio.demo.cart',
  addresses: 'shopio.demo.addresses',
  wishlist: 'shopio.demo.wishlist',
}

function categoryImage(label: string, background: string, accent: string) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600"><rect width="800" height="600" fill="${background}"/><circle cx="650" cy="125" r="150" fill="${accent}" opacity=".38"/><circle cx="150" cy="525" r="190" fill="${accent}" opacity=".25"/><rect x="245" y="180" width="310" height="230" rx="24" fill="${accent}" opacity=".72"/><path d="M275 365l78-82 58 56 54-66 105 92H275z" fill="${background}" opacity=".78"/><circle cx="390" cy="245" r="25" fill="${background}" opacity=".78"/><text x="400" y="470" text-anchor="middle" font-family="Arial,sans-serif" font-size="28" font-weight="600" fill="${accent}">${label}</text></svg>`
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`
}

function read<T>(key: string, fallback: T): T {
  const value = localStorage.getItem(key)
  return value ? (JSON.parse(value) as T) : fallback
}

function write(key: string, value: unknown) {
  localStorage.setItem(key, JSON.stringify(value))
}

const now = new Date().toISOString()
const categories: Row[] = [
  { id: 1, name: 'Furniture & Home', slug: 'furniture-home', description: 'Comfort for every room', image_url: categoryImage('Furniture & Home', '#e8ddd0', '#9a7550'), status: 'active', sort_order: 1 },
  { id: 2, name: 'Electronics', slug: 'electronics', description: 'Smart tech for modern living', image_url: categoryImage('Electronics', '#e1e8e7', '#5f8584'), status: 'active', sort_order: 2 },
  { id: 3, name: 'Fashion & Apparel', slug: 'fashion-apparel', description: 'Everyday looks, elevated', image_url: categoryImage('Fashion & Apparel', '#eadfe2', '#a46679'), status: 'active', sort_order: 3 },
  { id: 4, name: 'Home Decor', slug: 'home-decor', description: 'Finishing touches with character', image_url: categoryImage('Home Decor', '#eee4d5', '#b18a55'), status: 'active', sort_order: 4 },
]

const defaultSeller = { id: 1, user_id: 1, store_name: 'Demo Marketplace', store_slug: 'demo-marketplace', store_description: 'A ready-to-present RAGIZE store', business_category: 'Lifestyle', verification_status: 'pending', commission_rate: 10, status: 'active', created_at: now, owner_name: 'Demo Seller', owner_email: 'seller@shopio.test' }

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
    short_description: 'A thoughtfully selected demo product for your RAGIZE store.',
    description: 'A beautiful, practical product with a polished presentation. This sample record is stored locally for your demonstration.',
    brand: 'RAGIZE Select', condition_type: 'new', status: 'active', currency: 'TZS', created_at: now, updated_at: now,
    category_name: categories[categoryIndex].name, category_slug: categories[categoryIndex].slug, seller_name: defaultSeller.store_name, seller_slug: defaultSeller.store_slug,
    primary_image: imgCard(photo), rating: 4.5 - (index % 3) * 0.2, review_count: 12 + index * 3, sold_count: 18 + index * 7,
    min_price: price, max_price: price, available_stock: 12 + index, variant_count: 1,
    images: [{ id, product_id: id, image_url: imgCard(photo), alt_text: name, sort_order: 0, is_primary: true }],
    variants: [{ id: id * 10, product_id: id, sku: `DEMO-${String(id).padStart(3, '0')}`, variant_name: 'Default', price, compare_at_price: Math.round(price * 1.15), is_default: true, is_active: true, options: {}, stock: 12 + index, low_stock_threshold: 3 }],
  }
})

function envelope<T>(data: T, message = 'Demo data loaded'): LocalResponse<T> {
  return { success: true, message, data, meta: { pagination: { total: Array.isArray(data) ? data.length : 1, page: 1, per_page: 100, total_pages: 1, has_more: false } } }
}
function fileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => typeof reader.result === 'string'
      ? resolve(reader.result)
      : reject(new Error('The selected file could not be read.'))
    reader.onerror = () => reject(reader.error ?? new Error('The selected file could not be read.'))
    reader.readAsDataURL(file)
  })
}

function currentUser(): Row | null { return read<Row | null>(keys.user, null) }
function storedRows(key: string, defaults: Row[] = []): Row[] {
  const rows = read<Row[] | null>(key, null)
  if (rows) return rows
  write(key, defaults)
  return defaults
}
function saveRows(key: string, rows: Row[]) { write(key, rows) }
function upsertRow(rows: Row[], row: Row): Row[] {
  return rows.some((item) => item.id === row.id)
    ? rows.map((item) => item.id === row.id ? { ...item, ...row } : item)
    : [...rows, row]
}
function storageSafe(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(storageSafe)
  if (!value || typeof value !== 'object') return value
  return Object.fromEntries(
    Object.entries(value).filter(([key]) => !/(password|token|secret|authorization|csrf)/i.test(key))
      .map(([key, item]) => [key, storageSafe(item)]),
  )
}
function demoUsers(): Row[] {
  return storedRows(keys.users, [
    { id: 1, full_name: 'Demo Seller', email: 'seller@shopio.test', roles: ['seller', 'customer'], status: 'active', seller_id: 1, phone: '+255 700 000 000', email_verified_at: now, created_at: now },
    { id: 2, full_name: 'Demo Administrator', email: 'admin@shopio.test', roles: ['admin'], status: 'active', phone: '+255 700 000 001', email_verified_at: now, created_at: now },
  ])
}
function demoSellers(): Row[] { return storedRows(keys.sellers, [defaultSeller]) }
function demoProducts(): Row[] { return storedRows(keys.products, products) }
function demoCategories(): Row[] { return storedRows(keys.categories, categories) }
function publicProducts(): Row[] {
  const approvedSellerIds = new Set(
    demoSellers()
      .filter((item) => item.verification_status === 'approved' && item.status === 'active')
      .map((item) => Number(item.id)),
  )
  return demoProducts().filter((product) => approvedSellerIds.has(Number(product.seller_id)))
}
function getSeller(id: number | undefined): Row | null {
  return demoSellers().find((item) => item.id === id) ?? null
}
function saveUser(user: Row) {
  const safeUser = storageSafe(user) as Row
  saveRows(keys.users, upsertRow(demoUsers(), safeUser))
  write(keys.user, safeUser)
}
function resourceBase(path: string): string {
  const parts = path.split('/').filter(Boolean)
  if (parts[0] === 'admin' && parts[1] === 'reviews' && parts[2] === 'reports') return '/admin/reviews/reports'
  if (parts[0] === 'products' && parts[2] === 'reviews') return `/${parts.slice(0, 3).join('/')}`
  if (['admin', 'sellers', 'customers'].includes(parts[0])) return `/${parts.slice(0, 2).join('/')}`
  return `/${parts[0] ?? ''}`
}
function resourceRows(base: string): Row[] {
  if (base === '/admin/users') return demoUsers()
  if (base === '/admin/products' || base === '/sellers/products' || base === '/products') return demoProducts()
  if (base === '/admin/categories' || base === '/categories') return demoCategories()
  if (base === '/admin/sellers') return demoSellers()
  if (base === '/admin/banners' || base === '/banners') {
    return storedRows(keys.banners, [{ id: 1, title: 'Thoughtful pieces for everyday living', subtitle: 'Discover the RAGIZE demo collection', image_url: imgWide(PHOTOS.furniture[2]), button_text: 'Shop now', target_url: '/shop', placement: 'home_hero', status: 'active', sort_order: 1 }])
  }
  if (base === '/orders' || base === '/sellers/orders' || base === '/admin/orders') return read<Row[]>(keys.orders, [])
  if (base === '/sellers/inventory') {
    return demoProducts().flatMap((product) => (product.variants ?? []).map((variant: Row) => ({
      variant_id: variant.id,
      product_id: product.id,
      product_name: product.name,
      sku: variant.sku,
      variant_name: variant.variant_name,
      price: variant.price,
      stock: variant.stock,
      low_stock_threshold: variant.low_stock_threshold,
      status: product.status,
    })))
  }
  return read<Record<string, Row[]>>(keys.resources, {})[base] ?? []
}
function saveResourceRows(base: string, rows: Row[]) {
  if (base === '/admin/users') return saveRows(keys.users, rows)
  if (base === '/admin/products' || base === '/sellers/products' || base === '/products') return saveRows(keys.products, rows)
  if (base === '/admin/categories' || base === '/categories') return saveRows(keys.categories, rows)
  if (base === '/admin/sellers') return saveRows(keys.sellers, rows)
  if (base === '/admin/banners' || base === '/banners') return saveRows(keys.banners, rows)
  if (base === '/orders' || base === '/sellers/orders' || base === '/admin/orders') return saveRows(keys.orders, rows)
  const resources = read<Record<string, Row[]>>(keys.resources, {})
  write(keys.resources, { ...resources, [base]: rows })
}
function filterRows(rows: Row[], query: Record<string, unknown> | undefined): Row[] {
  if (!query) return rows
  const text = String(query.q ?? '').trim().toLowerCase()
  return rows.filter((row) =>
    (!query.status || row.status === query.status) &&
    (!query.verification_status || row.verification_status === query.verification_status) &&
    (!query.role || (Array.isArray(row.roles) && row.roles.includes(query.role))) &&
    (!query.seller_id || Number(row.seller_id ?? row.sellerId) === Number(query.seller_id)) &&
    (!text || JSON.stringify(row).toLowerCase().includes(text)),
  )
}
async function handleResourceRequest<T>(
  method: string,
  path: string,
  input: Row,
  query?: Record<string, unknown>,
): Promise<LocalResponse<T>> {
  const base = resourceBase(path)
  const parts = path.split('/').filter(Boolean)
  const baseParts = base.split('/').filter(Boolean)
  const resourceId = parts.length > baseParts.length && /^\d+$/.test(parts[baseParts.length])
    ? Number(parts[baseParts.length])
    : null
  let rows = resourceRows(base)

  if (base === '/uploads' && method === 'POST') {
    const file = input.file as File | undefined
    if (!file || typeof file.arrayBuffer !== 'function') throw new Error('Choose a file before uploading.')
    const dataUrl = await fileAsDataUrl(file)
    const uploads = resourceRows(base)
    const upload = {
      id: Math.max(0, ...uploads.map((item) => Number(item.id) || 0)) + 1,
      url: dataUrl,
      path: dataUrl,
      mimeType: file.type || 'application/octet-stream',
      sizeBytes: file.size,
      originalName: file.name,
    }
    saveResourceRows(base, [...uploads, upload])
    return envelope(upload as T, 'File saved in this browser')
  }

  if (base === '/sellers/documents' && method === 'POST') {
    const file = input.file as File | undefined
    if (!file || typeof file.arrayBuffer !== 'function') throw new Error('Choose a document before uploading.')
    const dataUrl = await fileAsDataUrl(file)
    const documents = resourceRows(base)
    const id = Math.max(0, ...documents.map((item) => Number(item.id) || 0)) + 1
    const document = {
      id,
      seller_id: currentUser()?.seller_id ?? 1,
      document_type: input.document_type ?? 'other',
      label: input.label ?? null,
      file_url: dataUrl,
      original_name: file.name,
      mime_type: file.type || 'application/octet-stream',
      size_bytes: file.size,
      status: 'pending',
      review_notes: null,
      reviewed_at: null,
      created_at: now,
    }
    saveResourceRows(base, [...documents, document])
    return envelope(document as T, 'Document saved in this browser')
  }

  if (base === '/admin/settings' || base === '/sellers/preferences') {
    const resources = read<Record<string, Row>>(keys.resources, {})
    const stored = resources[base] ?? {}
    if (method === 'GET') return envelope(stored as T)
    const safeSettings = storageSafe(input) as Row
    const updated = {
      ...stored,
      ...(safeSettings.settings && typeof safeSettings.settings === 'object' ? safeSettings.settings : {}),
      ...(safeSettings.preferences && typeof safeSettings.preferences === 'object' ? safeSettings.preferences : {}),
    }
    write(keys.resources, { ...resources, [base]: updated })
    return envelope(updated as T, 'Settings saved in this browser')
  }

  if (method === 'GET') {
    if (resourceId === null) return envelope(filterRows(rows, query) as T)
    return envelope((rows.find((item) => item.id === resourceId) ?? null) as T)
  }

  if (method === 'POST' && resourceId === null) {
    const id = Math.max(0, ...rows.map((row) => Number(row.id) || 0)) + 1
    const created = {
      ...storageSafe(input) as Row,
      id,
      created_at: now,
      ...(base.endsWith('/products') ? {
        seller_id: currentUser()?.seller_id ?? 1,
        status: input.status ?? 'draft',
        variants: Array.isArray(input.variants)
          ? input.variants.map((variant: Row, index: number) => ({ ...variant, id: id * 100 + index + 1, product_id: id }))
          : [],
        images: Array.isArray(input.images)
          ? input.images.map((image: Row, index: number) => ({ ...image, id: id * 100 + index + 1, product_id: id }))
          : [],
      } : {}),
    }
    saveResourceRows(base, [...rows, created])
    return envelope(created as T, 'Saved in this browser')
  }

  if (resourceId !== null) {
    const existing = rows.find((row) => row.id === resourceId)
    if (method === 'DELETE') {
      saveResourceRows(base, rows.filter((row) => row.id !== resourceId))
      return envelope(null as T, 'Removed from this browser')
    }
    if (!existing) throw new Error('The requested demo record was not found.')
    if (method === 'POST' && parts[baseParts.length + 1] === 'submit') {
      const updated = { ...existing, status: 'pending_review', rejection_reason: null }
      rows = rows.map((row) => row.id === resourceId ? updated : row)
      saveResourceRows(base, rows)
      return envelope(updated as T, 'Submitted for review')
    }
    if (method === 'PATCH' || method === 'PUT' || method === 'POST') {
      let updated = { ...existing, ...storageSafe(input) as Row }
      if (base === '/admin/users' && parts[parts.length - 1] === 'roles') updated = { ...existing, roles: input.roles ?? existing.roles }
      rows = rows.map((row) => row.id === resourceId ? updated : row)
      saveResourceRows(base, rows)
      return envelope(updated as T, 'Changes saved in this browser')
    }
  }

  throw new Error(`Demo mode does not support ${method} ${path} yet.`)
}
function cartRows(): Row[] { return read<Row[]>(keys.cart, []) }
function cartPayload() {
  const items = cartRows()
  return { items, item_count: items.reduce((sum, item) => sum + Number(item.quantity || 0), 0), subtotal: items.reduce((sum, item) => sum + Number(item.unit_price || 0) * Number(item.quantity || 0), 0), has_unavailable_items: false }
}

export async function localRequest<T>(
  method: string,
  path: string,
  body?: unknown,
  query?: Record<string, string | number | boolean | null | undefined | Array<string | number>>,
): Promise<LocalResponse<T>> {
  const formData = typeof FormData !== 'undefined' && body instanceof FormData ? body : null
  const input = (formData
    ? Object.fromEntries(Array.from(formData.entries()).filter(([, value]) => typeof value === 'string'))
    : body ?? {}) as Row
  if (formData?.get('file') instanceof File) input.file = formData.get('file')
  if (path === '/auth/login' || path === '/auth/register') {
    const email = String(input.email || 'demo@shopio.test').trim().toLowerCase()
    if (path === '/auth/login' && !String(input.password ?? '').trim()) {
      throw new Error('Enter a password to continue. Demo accounts accept any password.')
    }
    const isSellerRegistration = path === '/auth/register' && Boolean(input.store_name)
    const users = demoUsers()
    let account = path === '/auth/login'
      ? users.find((item) => item.email.toLowerCase() === email)
      : undefined
    if (!account) {
      const id = Math.max(0, ...users.map((item) => Number(item.id) || 0)) + 1
      account = {
        id,
        full_name: input.full_name || (email === 'admin@shopio.test' ? 'Demo Administrator' : email === 'seller@shopio.test' ? 'Demo Seller' : 'Demo Customer'),
        roles: email === 'admin@shopio.test' ? ['admin'] : email === 'seller@shopio.test' ? ['seller', 'customer'] : isSellerRegistration ? ['seller', 'customer'] : ['customer'],
        ...(email === 'seller@shopio.test' || isSellerRegistration ? { seller_id: email === 'seller@shopio.test' ? 1 : id } : {}),
      }
    }
    if (isSellerRegistration) {
      const sellers = demoSellers()
      const sellerId = Number(account.seller_id ?? account.id)
      const application = {
        ...defaultSeller,
        id: sellerId,
        user_id: account.id,
        store_name: input.store_name,
        store_slug: String(input.store_name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
        store_description: input.store_description ?? null,
        business_category: input.business_category ?? null,
        contact_phone: input.phone ?? null,
        region_id: input.region_id ?? null,
        city_id: input.city_id ?? null,
        address: input.address ?? null,
        verification_status: 'pending',
        status: 'active',
        owner_name: account.full_name,
        owner_email: email,
        created_at: now,
      }
      saveRows(keys.sellers, upsertRow(sellers, application))
      account = { ...account, seller_id: sellerId, roles: Array.from(new Set([...(account.roles as string[]), 'customer', 'seller'])) }
    }
    const user = {
      ...account,
      email,
      phone: input.phone || '+255 700 000 000',
      status: 'active',
      email_verified_at: now,
      created_at: account.created_at ?? now,
    }
    saveUser(user)
    return envelope({ user, token: 'local-demo-token', expiresAt: new Date(Date.now() + 86400000).toISOString() } as T, 'Welcome to RAGIZE demo mode')
  }
  if (path === '/auth/me') {
    const user = currentUser(); if (!user) return envelope(null as T)
    return envelope(user as T)
  }
  if (path === '/auth/logout') { localStorage.removeItem(keys.user); return envelope(null as T, 'Signed out') }
  if (path === '/customers/profile' && method === 'GET') return envelope(currentUser() as T)
  if (path === '/customers/profile' && method === 'PATCH') { const user = { ...currentUser(), full_name: input.full_name, phone: input.phone }; saveUser(user); return envelope(user as T) }
  if (path === '/customers/notifications/read-all' && method === 'POST') {
    const notifications = resourceRows('/customers/notifications')
    const updated = notifications.map((item) => ({ ...item, is_read: true, read_at: now }))
    saveResourceRows('/customers/notifications', updated)
    return envelope({ updated: updated.length } as T)
  }
  const notificationRead = path.match(/^\/customers\/notifications\/(\d+)\/read$/)
  if (notificationRead && method === 'POST') {
    const id = Number(notificationRead[1])
    const notifications = resourceRows('/customers/notifications')
    const updated = notifications.map((item) => item.id === id ? { ...item, is_read: true, read_at: now } : item)
    saveResourceRows('/customers/notifications', updated)
    return envelope({ updated: notifications.some((item) => item.id === id) } as T)
  }
  if (path === '/customers/sessions/revoke-others' && method === 'POST') {
    const sessions = resourceRows('/customers/sessions')
    const remaining = sessions.slice(0, 1)
    saveResourceRows('/customers/sessions', remaining)
    return envelope({ revoked: Math.max(0, sessions.length - remaining.length) } as T)
  }
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
  if (path === '/sellers/register' && method === 'POST') {
    const user = currentUser()
    if (!user) throw new Error('Sign in before creating a seller application.')
    const sellerId = Number(user.seller_id ?? user.id)
    const application = {
      ...defaultSeller,
      id: sellerId,
      user_id: user.id,
      store_name: input.store_name,
      store_slug: String(input.store_name ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
      store_description: input.store_description ?? null,
      business_category: input.business_category ?? null,
      contact_phone: input.contact_phone ?? null,
      region_id: input.region_id ?? null,
      city_id: input.city_id ?? null,
      address: input.address ?? null,
      verification_status: 'pending',
      status: 'active',
      owner_name: user.full_name,
      owner_email: user.email,
      created_at: now,
    }
    saveRows(keys.sellers, upsertRow(demoSellers(), application))
    const updatedUser = { ...user, seller_id: sellerId, roles: Array.from(new Set([...(user.roles as string[]), 'customer', 'seller'])) }
    saveUser(updatedUser)
    return envelope(application as T, 'Seller application submitted for review')
  }
  if (path === '/admin/sellers') {
    const q = String(query?.q ?? '').toLowerCase()
    const status = String(query?.verification_status ?? '')
    const sellers = demoSellers().filter((item) =>
      (!status || item.verification_status === status) &&
      (!query?.status || item.status === query.status) &&
      (!q || `${item.store_name} ${item.owner_name} ${item.owner_email}`.toLowerCase().includes(q)),
    )
    return envelope(sellers as T)
  }
  if (path.startsWith('/admin/sellers/')) {
    const parts = path.split('/')
    const sellerId = Number(parts[3])
    if (parts[4] === 'documents') {
      return envelope(resourceRows('/sellers/documents').filter((document) => Number(document.seller_id) === sellerId) as T)
    }
    const sellers = demoSellers()
    const existing = sellers.find((item) => item.id === sellerId)
    if (!existing) throw new Error('Seller application was not found.')
    if (method === 'DELETE') {
      saveRows(keys.sellers, sellers.filter((item) => item.id !== sellerId))
      return envelope(null as T, 'Seller removed from the demo browser data')
    }
    const updated = { ...existing, ...storageSafe(input) as Row }
    saveRows(keys.sellers, upsertRow(sellers, updated))
    return envelope(updated as T, 'Seller application updated')
  }
  if (path === '/sellers/store') {
    const user = currentUser()
    const existing = getSeller(Number(user?.seller_id))
    if (method === 'PATCH') {
      if (!existing) throw new Error('Submit a seller application before editing the store.')
      const updated = { ...existing, ...input }
      saveRows(keys.sellers, upsertRow(demoSellers(), updated))
      return envelope(updated as T, 'Store details saved in this browser')
    }
    return envelope(existing as T)
  }
  if (path.startsWith('/stores/')) {
    const slug = decodeURIComponent(path.split('/').pop() ?? '')
    return envelope((demoSellers().find((item) =>
      item.store_slug === slug && item.verification_status === 'approved' && item.status === 'active',
    ) ?? null) as T)
  }
  if (path === '/products') return envelope(publicProducts() as T)
  if (path.startsWith('/products/')) { const product = publicProducts().find((item) => item.slug === decodeURIComponent(path.slice('/products/'.length))); return envelope((product ?? null) as T) }
  if (path === '/categories') return envelope(demoCategories() as T)
  if (path.startsWith('/categories/')) return envelope((demoCategories().find((item) => item.slug === decodeURIComponent(path.split('/').pop() || '')) ?? null) as T)
  if (path === '/banners') {
    const defaults = [{ id: 1, title: 'Thoughtful pieces for everyday living', subtitle: 'Discover the RAGIZE demo collection', image_url: imgWide(PHOTOS.furniture[2]), button_text: 'Shop now', target_url: '/shop', placement: 'home_hero', status: 'active', sort_order: 1 }]
    return envelope(storedRows(keys.banners, defaults) as T)
  }
  if (path === '/cart' || path === '/cart/items' || path.startsWith('/cart/items/')) {
    let items = cartRows()
    if (method === 'POST') { const productRows = demoProducts(); const variant = productRows.flatMap((p) => p.variants).find((v) => v.id === Number(input.variant_id)); if (variant) { const product = productRows.find((p) => p.id === variant.product_id)!; const existing = items.find((i) => i.variant_id === variant.id); const next = { id: variant.id, variant_id: variant.id, product_id: product.id, name: product.name, slug: product.slug, image_url: product.primary_image, variant_name: variant.variant_name, sku: variant.sku, unit_price: variant.price, compare_at_price: variant.compare_at_price, quantity: Math.min(Number(existing?.quantity || 0) + Number(input.quantity || 1), variant.stock), stock: variant.stock, seller_id: 1, seller_name: getSeller(1)?.store_name ?? defaultSeller.store_name }; items = existing ? items.map((i) => i.variant_id === variant.id ? next : i) : [...items, next]; write(keys.cart, items) } }
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
  if (path === '/customers/addresses' && method === 'GET') return envelope(read<Row[]>(keys.addresses, []) as T)
  if (path.startsWith('/countries')) return envelope([{ code: 'TZ', name: 'Tanzania' }] as T)
  if (path.startsWith('/regions')) return envelope([{ id: 1, country_code: 'TZ', name: 'Dar es Salaam' }] as T)
  if (path.startsWith('/cities')) return envelope([{ id: 1, region_id: 1, name: 'Dar es Salaam', region_name: 'Dar es Salaam' }] as T)
  if (path === '/customers/wishlist') return envelope(read<Row[]>(keys.wishlist, []) as T)
  if (path.startsWith('/customers/wishlist')) { const id = Number(input.product_id ?? path.split('/').pop()); const list = read<Row[]>(keys.wishlist, []); write(keys.wishlist, method === 'DELETE' ? list.filter((x) => x.productId !== id) : [...list, { productId: id, addedAt: now }]); return envelope(null as T) }
  if (path === '/admin/overview') {
    const orders = read<Row[]>(keys.orders, [])
    const sellers = demoSellers()
    return envelope({
      totalRevenue: orders.reduce((sum, order) => sum + Number(order.grand_total ?? 0), 0),
      totalOrders: orders.length,
      totalCustomers: demoUsers().filter((user) => (user.roles as string[]).includes('customer')).length,
      activeSellers: sellers.filter((item) => item.verification_status === 'approved').length,
      totalProducts: demoProducts().length,
      pendingApplications: sellers.filter((item) => item.verification_status === 'pending').length,
      pendingProducts: demoProducts().filter((item) => item.status === 'pending_review').length,
    } as T)
  }
  if (path === '/admin/analytics' || path === '/sellers/analytics') return envelope({ series: [], statusBreakdown: [], revenueByCategory: [], topProducts: [], topSellers: [], customerGrowth: [], totals: {}, refundsPending: 0, payoutsPending: 0 } as T)
  if (path === '/sellers/dashboard') return envelope({ revenue: {}, orders: { total: read<Row[]>(keys.orders, []).length }, products: { total: demoProducts().length }, inventory: {}, payouts: {}, recentOrders: read<Row[]>(keys.orders, []) } as T)
  if (path === '/sellers/payouts/summary') return envelope({ recent: [] } as T)
  if (path.startsWith('/sellers/variants/') && method === 'PATCH') {
    const variantId = Number(path.split('/').pop())
    let updatedVariant: Row | null = null
    const productRows = demoProducts().map((product) => ({
      ...product,
      variants: (product.variants ?? []).map((variant: Row) => {
        if (variant.id !== variantId) return variant
        updatedVariant = {
          ...variant,
          ...(input.price !== undefined ? { price: Number(input.price) } : {}),
          ...(input.compare_at_price !== undefined ? { compare_at_price: input.compare_at_price } : {}),
        }
        return updatedVariant
      }),
    }))
    if (!updatedVariant) throw new Error('The requested demo product variant was not found.')
    saveRows(keys.products, productRows)
    return envelope(updatedVariant as T, 'Variant saved in this browser')
  }
  const sellerFulfillmentMatch = path.match(/^\/sellers\/orders\/(\d+)\/items\/(\d+)$/)
  if (sellerFulfillmentMatch && method === 'PATCH') {
    const orderId = Number(sellerFulfillmentMatch[1])
    const itemId = Number(sellerFulfillmentMatch[2])
    const orders = read<Row[]>(keys.orders, [])
    const order = orders.find((row) => row.id === orderId)
    if (!order) throw new Error('The requested demo order was not found.')
    const updated = {
      ...order,
      items: (order.items ?? []).map((item: Row) => item.id === itemId
        ? { ...item, fulfillment_status: input.status, note: input.note ?? null }
        : item),
    }
    saveRows(keys.orders, orders.map((row) => row.id === orderId ? updated : row))
    return envelope(updated as T, 'Order fulfillment saved in this browser')
  }
  if (path === '/sellers/inventory/adjust' && method === 'POST') {
    const variantId = Number(input.variant_id)
    const productRows = demoProducts().map((product) => ({
      ...product,
      variants: (product.variants ?? []).map((variant: Row) => variant.id === variantId
        ? { ...variant, stock: Math.max(0, Number(variant.stock ?? 0) + Number(input.quantity ?? 0)) }
        : variant),
    }))
    saveRows(keys.products, productRows)
    return envelope(null as T, 'Inventory adjustment saved in this browser')
  }
  if (path === '/sellers/inventory/threshold' && method === 'PATCH') {
    const variantId = Number(input.variant_id)
    const productRows = demoProducts().map((product) => ({
      ...product,
      variants: (product.variants ?? []).map((variant: Row) => variant.id === variantId
        ? { ...variant, low_stock_threshold: Number(input.low_stock_threshold) }
        : variant),
    }))
    saveRows(keys.products, productRows)
    return envelope(null as T, 'Inventory threshold saved in this browser')
  }
  return handleResourceRequest<T>(method, path, input, query)
}
