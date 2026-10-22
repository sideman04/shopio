/**
 * Service layer barrel.
 *
 * Pages import from these modules rather than calling the API directly. Every
 * function talks to the versioned PHP API at `/api/v1`.
 */
export * as apiClient from './apiClient'
export * as authService from './authService'
export * as productService from './productService'
export * as categoryService from './categoryService'
export * as cartService from './cartService'
export * as orderService from './orderService'
export * as reviewService from './reviewService'
export * as sellerService from './sellerService'
export * as adminService from './adminService'
export * as accountService from './accountService'
export * as geoService from './geoService'
export * as catalogService from './catalogService'
export type { AdminOverview, CartPayload } from './mappers'
