import type { Banner } from '@/types'

/**
 * True when a banner should be visible on the public storefront.
 *
 * The shared catalogue store also holds admin-only drafts, so storefront
 * consumers must check status and the schedule rather than rendering whatever
 * happens to be first in the list.
 */
export function isBannerLive(banner: Banner, now = Date.now()): boolean {
  if (banner.status !== 'active') return false
  if (banner.startsAt && new Date(banner.startsAt).getTime() > now) return false
  if (banner.endsAt && new Date(banner.endsAt).getTime() < now) return false
  return true
}
