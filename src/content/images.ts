/**
 * Image helpers.
 *
 * Product photography is sourced from Unsplash's CDN. Every id below was
 * verified to resolve, and `<SmartImage>` still falls back to a branded
 * placeholder on error so the UI never shows a broken image.
 */

const BASE = 'https://images.unsplash.com'

export type ImageId = string

/** Build a sized, cropped Unsplash URL. */
export function img(id: ImageId, width = 800, height?: number) {
  const h = height ?? width
  return `${BASE}/${id}?auto=format&fit=crop&w=${width}&h=${h}&q=80`
}

/** A single 4:5 portrait crop, good for product cards. */
export function imgCard(id: ImageId) {
  return img(id, 600, 750)
}

/** A wide 16:9 crop, good for banners and hero blocks. */
export function imgWide(id: ImageId, w = 1200) {
  return img(id, w, Math.round((w * 9) / 16))
}

/** A square crop, good for thumbnails, categories and avatars. */
export function imgSquare(id: ImageId, size = 400) {
  return img(id, size, size)
}

/**
 * Curated Unsplash ids, grouped so products can reuse believable
 * category-appropriate photography without repeating the same shot.
 */
export const PHOTOS = {
  furniture: [
    'photo-1555041469-a586c61ea9bc',
    'photo-1567016432779-094069958ea5',
    'photo-1586023492125-27b2c045efd7',
    'photo-1524758631624-e2822e304c36',
    'photo-1616486338812-3dadae4b4ace',
    'photo-1540574163026-643ea20ade25',
    'photo-1550226891-ef816aed4a98',
    'photo-1567538096630-e0c55bd6374c',
    'photo-1538688525198-9b88f6f53126',
    'photo-1519710164239-da123dc03ef4',
    'photo-1503602642458-232111445657',
    'photo-1493663284031-b7e3aefcae8e',
    'photo-1533090161767-e6ffed986c88',
    'photo-1506439773649-6e0eb8cfb237',
    'photo-1497366216548-37526070297c',
    'photo-1615529182904-14819c35db37',
  ],
  electronics: [
    'photo-1498049794561-7780e7231661',
    'photo-1517336714731-489689fd1ca8',
    'photo-1531297484001-80022131f5a1',
    'photo-1542751371-adc38448a05e',
    'photo-1587829741301-dc798b83add3',
    'photo-1572569511254-d8f925fe2cbb',
    'photo-1583394838336-acd977736f90',
    'photo-1523170335258-f5ed11844a49',
    'photo-1526178613552-2b45c6c302f0',
    'photo-1505740420928-5e560c06d30e',
    'photo-1484704849700-f032a568e944',
    'photo-1493666438817-866a91353ca9',
    'photo-1511707171634-5f897ff02aa9',
    'photo-1523275335684-37898b6baf30',
    'photo-1526170375885-4d8ecf77b99f',
    'photo-1550009158-9ebf69173e03',
  ],
  fashion: [
    'photo-1496747611176-843222e1e57c',
    'photo-1571945153237-4929e783af4a',
    'photo-1469334031218-e382a71b716b',
    'photo-1483985988355-763728e1935b',
    'photo-1445205170230-053b83016050',
    'photo-1479064555552-3ef4979f8908',
    'photo-1441984904996-e0b6ba687e04',
    'photo-1434389677669-e08b4cac3105',
    'photo-1542291026-7eec264c27ff',
    'photo-1560769629-975ec94e6a86',
    'photo-1595950653106-6c9ebd614d3a',
    'photo-1549298916-b41d501d3772',
    'photo-1608231387042-66d1773070a5',
    'photo-1524504388940-b1c1722653e1',
  ],
  'home-decor': [
    'photo-1615529182904-14819c35db37',
    'photo-1592078615290-033ee584e267',
    'photo-1595428774223-ef52624120d2',
    'photo-1558211583-d26f610c1eb1',
    'photo-1519710164239-da123dc03ef4',
    'photo-1513506003901-1e6a229e2d15',
    'photo-1497366216548-37526070297c',
    'photo-1583847268964-b28dc8f51f92',
  ],
  accessories: [
    'photo-1523275335684-37898b6baf30',
    'photo-1526170375885-4d8ecf77b99f',
    'photo-1493666438817-866a91353ca9',
    'photo-1484704849700-f032a568e944',
    'photo-1441984904996-e0b6ba687e04',
    'photo-1542291026-7eec264c27ff',
  ],
} as const

/** Warm, neutral lifestyle shot used for the storefront hero. */
export const HERO_IMAGE = PHOTOS.furniture[2]
/** Lifestyle shot used for the "Summer Sale" promotional banner. */
export const PROMO_IMAGE = PHOTOS.furniture[0]

/** Deterministic avatar generator (no external dependency, never broken). */
export function avatarUrl(seed: string) {
  const colors = ['#111111', '#4B4B4B', '#C7A67F', '#E8B02E', '#6B6B6B']
  const index = Math.abs(
    seed.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0),
  ) % colors.length
  const label = seed
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('')
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96"><rect width="96" height="96" fill="${colors[index]}"/><text x="50%" y="53%" dominant-baseline="middle" text-anchor="middle" font-family="Inter,Arial,sans-serif" font-size="34" font-weight="600" fill="#ffffff">${label}</text></svg>`
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
}
