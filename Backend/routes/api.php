<?php

declare(strict_types=1);

/**
 * API route table.
 *
 * Paths are relative to the configured `API_PREFIX` (default `/api/v1`); the
 * kernel strips the prefix before dispatch. Middleware order is outermost-first:
 *   index 0  runs first  (auth)  …  last index runs just before the controller.
 *
 * Writes use the `mw.csrf` double-submit check for cookie sessions (a no-op for
 * bearer clients, which are not forgeable cross-site). Retryable money/order
 * operations additionally use `mw.idempotency`.
 */

use Shopio\Controllers\AdminController;
use Shopio\Controllers\AuthController;
use Shopio\Controllers\CartController;
use Shopio\Controllers\CatalogController;
use Shopio\Controllers\CronController;
use Shopio\Controllers\CustomerController;
use Shopio\Controllers\HealthController;
use Shopio\Controllers\OrderController;
use Shopio\Controllers\PaymentWebhookController;
use Shopio\Controllers\SellerController;
use Shopio\Controllers\SellerProductController;
use Shopio\Controllers\UploadController;
use Shopio\Http\Router;

return static function (Router $r): void {
    // --- Middleware shorthand -------------------------------------------------
    $auth = ['mw.auth'];
    $authCsrf = ['mw.auth', 'mw.csrf'];
    $seller = ['mw.auth', 'mw.role.seller', 'mw.csrf'];
    $admin = ['mw.auth', 'mw.role.admin', 'mw.csrf'];
    $write = ['mw.ratelimit.write'];

    // --- Health / infrastructure ---------------------------------------------
    $r->get('/health', [HealthController::class, 'show']);
    $r->post('/internal/maintenance', [CronController::class, 'run']);
    $r->post('/webhooks/payments/{provider}', [PaymentWebhookController::class, 'handle']);

    // --- Authentication -------------------------------------------------------
    $r->post('/auth/register', [AuthController::class, 'register'], ['mw.ratelimit.register']);
    $r->post('/auth/login', [AuthController::class, 'login'], ['mw.ratelimit.login']);
    $r->post('/auth/logout', [AuthController::class, 'logout'], $authCsrf);
    $r->get('/auth/me', [AuthController::class, 'me'], $auth);
    $r->post('/auth/forgot-password', [AuthController::class, 'forgotPassword'], ['mw.ratelimit.password']);
    $r->post('/auth/reset-password', [AuthController::class, 'resetPassword'], ['mw.ratelimit.password']);
    $r->post('/auth/verify-email', [AuthController::class, 'verifyEmail'], ['mw.ratelimit.password']);
    $r->post('/auth/resend-verification', [AuthController::class, 'resendVerification'], ['mw.ratelimit.password']);
    $r->post('/auth/change-password', [AuthController::class, 'changePassword'], array_merge($authCsrf, ['mw.ratelimit.password']));
    $r->post('/auth/phone/verify', [AuthController::class, 'requestPhoneVerification'], $authCsrf);
    $r->post('/auth/phone/confirm', [AuthController::class, 'verifyPhone'], $authCsrf);

    // --- Public catalogue -----------------------------------------------------
    $r->get('/products', [CatalogController::class, 'products']);
    $r->get('/products/{slug}', [CatalogController::class, 'product']);
    $r->get('/products/{slug}/reviews', [CatalogController::class, 'productReviews']);
    $r->get('/categories', [CatalogController::class, 'categories']);
    $r->get('/categories/{slug}', [CatalogController::class, 'category']);
    $r->get('/banners', [CatalogController::class, 'banners']);
    $r->get('/stores/{slug}', [CatalogController::class, 'store']);
    $r->get('/countries', [CatalogController::class, 'countries']);
    $r->get('/regions', [CatalogController::class, 'regions']);
    $r->get('/cities', [CatalogController::class, 'cities']);
    $r->get('/cities/{id}', [CatalogController::class, 'city']);

    // --- Cart -----------------------------------------------------------------
    $r->get('/cart', [CartController::class, 'show'], $auth);
    $r->post('/cart/items', [CartController::class, 'addItem'], array_merge($authCsrf, $write));
    $r->patch('/cart/items/{id}', [CartController::class, 'updateItem'], array_merge($authCsrf, $write));
    $r->put('/cart/items/{id}', [CartController::class, 'updateItem'], array_merge($authCsrf, $write));
    $r->delete('/cart/items/{id}', [CartController::class, 'removeItem'], array_merge($authCsrf, $write));
    $r->delete('/cart', [CartController::class, 'clear'], array_merge($authCsrf, $write));

    // --- Orders & checkout ----------------------------------------------------
    $r->get('/orders', [OrderController::class, 'index'], $auth);
    $r->post('/orders', [OrderController::class, 'store'], array_merge($authCsrf, ['mw.ratelimit.checkout', 'mw.idempotency']));
    $r->get('/orders/{id}', [OrderController::class, 'show'], $auth);
    $r->post('/orders/{id}/cancel', [OrderController::class, 'cancel'], array_merge($authCsrf, $write));
    $r->post('/orders/{id}/payments', [OrderController::class, 'pay'], array_merge($authCsrf, $write, ['mw.idempotency']));
    $r->get('/orders/{id}/refunds', [OrderController::class, 'refunds'], $auth);
    $r->post('/orders/{id}/refunds', [OrderController::class, 'requestRefund'], array_merge($authCsrf, $write, ['mw.idempotency']));

    // --- Customer account -----------------------------------------------------
    $r->get('/customers/profile', [CustomerController::class, 'profile'], $auth);
    $r->patch('/customers/profile', [CustomerController::class, 'updateProfile'], $authCsrf);
    $r->get('/customers/addresses', [CustomerController::class, 'addresses'], $auth);
    $r->post('/customers/addresses', [CustomerController::class, 'createAddress'], $authCsrf);
    $r->patch('/customers/addresses/{id}', [CustomerController::class, 'updateAddress'], $authCsrf);
    $r->delete('/customers/addresses/{id}', [CustomerController::class, 'deleteAddress'], $authCsrf);
    $r->get('/customers/notifications', [CustomerController::class, 'notifications'], $auth);
    $r->post('/customers/notifications/read-all', [CustomerController::class, 'readAllNotifications'], $authCsrf);
    $r->post('/customers/notifications/{id}/read', [CustomerController::class, 'readNotification'], $authCsrf);
    $r->get('/customers/sessions', [CustomerController::class, 'sessions'], $auth);
    $r->post('/customers/sessions/revoke-others', [CustomerController::class, 'revokeOtherSessions'], $authCsrf);
    $r->delete('/customers/sessions/{id}', [CustomerController::class, 'revokeSession'], $authCsrf);
    $r->get('/customers/login-activity', [CustomerController::class, 'loginActivity'], $auth);
    $r->get('/customers/wishlist', [CustomerController::class, 'wishlist'], $auth);
    $r->post('/customers/wishlist', [CustomerController::class, 'addToWishlist'], $authCsrf);
    $r->delete('/customers/wishlist/{productId}', [CustomerController::class, 'removeFromWishlist'], $authCsrf);
    $r->post('/coupons/validate', [CustomerController::class, 'validateCoupon'], $authCsrf);

    // --- Reviews & support ----------------------------------------------------
    $r->get('/products/{id}/review-eligibility', [CustomerController::class, 'reviewEligibility'], $auth);
    $r->post('/products/{id}/reviews', [CustomerController::class, 'createReview'], array_merge($authCsrf, $write));
    $r->post('/reviews/{id}/report', [CustomerController::class, 'reportReview'], array_merge($authCsrf, $write));
    $r->post('/support', [CustomerController::class, 'submitSupport'], ['mw.auth.optional', 'mw.ratelimit.support']);

    // --- Uploads --------------------------------------------------------------
    $r->post('/uploads/images', [UploadController::class, 'image'], array_merge($authCsrf, ['mw.ratelimit.upload']));

    // --- Seller: onboarding + workspace --------------------------------------
    // Registration is open to any authenticated customer (role grants happen server-side).
    $r->post('/sellers/register', [SellerController::class, 'register'], array_merge($authCsrf, $write));
    $r->get('/sellers/store', [SellerController::class, 'store'], ['mw.auth', 'mw.role.seller']);
    $r->patch('/sellers/store', [SellerController::class, 'updateStore'], $seller);
    $r->get('/sellers/dashboard', [SellerController::class, 'dashboard'], ['mw.auth', 'mw.role.seller']);
    $r->get('/sellers/analytics', [SellerController::class, 'analytics'], ['mw.auth', 'mw.role.seller']);
    $r->get('/sellers/orders', [SellerController::class, 'orders'], ['mw.auth', 'mw.role.seller']);
    $r->get('/sellers/orders/{id}', [SellerController::class, 'order'], ['mw.auth', 'mw.role.seller']);
    $r->patch('/sellers/orders/{id}/items/{itemId}', [SellerController::class, 'fulfillItem'], $seller);
    $r->get('/sellers/payouts/summary', [SellerController::class, 'payoutSummary'], ['mw.auth', 'mw.role.seller']);
    $r->get('/sellers/payouts', [SellerController::class, 'payouts'], ['mw.auth', 'mw.role.seller']);
    $r->post('/sellers/payouts', [SellerController::class, 'requestPayout'], array_merge($seller, ['mw.idempotency']));
    $r->get('/sellers/reviews', [SellerController::class, 'reviews'], ['mw.auth', 'mw.role.seller']);
    $r->post('/sellers/reviews/{id}/reply', [SellerController::class, 'replyToReview'], $seller);

    // --- Seller: catalogue & inventory ---------------------------------------
    $r->get('/sellers/products', [SellerProductController::class, 'index'], ['mw.auth', 'mw.role.seller']);
    $r->post('/sellers/products', [SellerProductController::class, 'store'], $seller);
    $r->get('/sellers/products/{id}', [SellerProductController::class, 'show'], ['mw.auth', 'mw.role.seller']);
    $r->patch('/sellers/products/{id}', [SellerProductController::class, 'update'], $seller);
    $r->delete('/sellers/products/{id}', [SellerProductController::class, 'destroy'], $seller);
    $r->post('/sellers/products/{id}/submit', [SellerProductController::class, 'submit'], $seller);
    $r->post('/sellers/products/{id}/images', [SellerProductController::class, 'attachImage'], $seller);
    $r->delete('/sellers/products/{id}/images/{imageId}', [SellerProductController::class, 'deleteImage'], $seller);
    $r->post('/sellers/products/{id}/variants', [SellerProductController::class, 'createVariant'], $seller);
    $r->put('/sellers/products/{id}/options', [SellerProductController::class, 'setOptions'], $seller);
    $r->patch('/sellers/variants/{variantId}', [SellerProductController::class, 'updateVariant'], $seller);
    $r->delete('/sellers/variants/{variantId}', [SellerProductController::class, 'deleteVariant'], $seller);
    $r->get('/sellers/inventory', [SellerProductController::class, 'inventory'], ['mw.auth', 'mw.role.seller']);
    $r->post('/sellers/inventory/adjust', [SellerProductController::class, 'adjustInventory'], $seller);
    $r->patch('/sellers/inventory/threshold', [SellerProductController::class, 'setThreshold'], $seller);

    // --- Admin ----------------------------------------------------------------
    $r->get('/admin/overview', [AdminController::class, 'overview'], ['mw.auth', 'mw.role.admin']);
    $r->get('/admin/analytics', [AdminController::class, 'analytics'], ['mw.auth', 'mw.role.admin']);
    $r->get('/admin/users', [AdminController::class, 'users'], ['mw.auth', 'mw.role.admin']);
    $r->patch('/admin/users/{id}/status', [AdminController::class, 'updateUserStatus'], $admin);
    $r->put('/admin/users/{id}/roles', [AdminController::class, 'updateUserRoles'], $admin);
    $r->get('/admin/sellers', [AdminController::class, 'sellers'], ['mw.auth', 'mw.role.admin']);
    $r->patch('/admin/sellers/{id}', [AdminController::class, 'verifySeller'], $admin);
    $r->get('/admin/products', [AdminController::class, 'products'], ['mw.auth', 'mw.role.admin']);
    $r->patch('/admin/products/{id}', [AdminController::class, 'moderateProduct'], $admin);
    $r->get('/admin/categories', [AdminController::class, 'categories'], ['mw.auth', 'mw.role.admin']);
    $r->post('/admin/categories', [AdminController::class, 'createCategory'], $admin);
    $r->patch('/admin/categories/{id}', [AdminController::class, 'updateCategory'], $admin);
    $r->delete('/admin/categories/{id}', [AdminController::class, 'deleteCategory'], $admin);
    $r->get('/admin/orders', [AdminController::class, 'orders'], ['mw.auth', 'mw.role.admin']);
    $r->get('/admin/orders/{id}', [AdminController::class, 'order'], ['mw.auth', 'mw.role.admin']);
    $r->patch('/admin/orders/{id}/status', [AdminController::class, 'updateOrderStatus'], $admin);
    $r->get('/admin/transactions', [AdminController::class, 'transactions'], ['mw.auth', 'mw.role.admin']);
    $r->get('/admin/promotions', [AdminController::class, 'promotions'], ['mw.auth', 'mw.role.admin']);
    $r->post('/admin/promotions', [AdminController::class, 'createPromotion'], $admin);
    $r->patch('/admin/promotions/{id}', [AdminController::class, 'updatePromotion'], $admin);
    $r->delete('/admin/promotions/{id}', [AdminController::class, 'deletePromotion'], $admin);
    $r->get('/admin/reviews', [AdminController::class, 'reviews'], ['mw.auth', 'mw.role.admin']);
    $r->get('/admin/reviews/reports', [AdminController::class, 'reviewReports'], ['mw.auth', 'mw.role.admin']);
    $r->patch('/admin/reviews/reports/{id}', [AdminController::class, 'resolveReport'], $admin);
    $r->patch('/admin/reviews/{id}', [AdminController::class, 'moderateReview'], $admin);
    $r->get('/admin/banners', [AdminController::class, 'banners'], ['mw.auth', 'mw.role.admin']);
    $r->post('/admin/banners', [AdminController::class, 'createBanner'], $admin);
    $r->patch('/admin/banners/{id}', [AdminController::class, 'updateBanner'], $admin);
    $r->delete('/admin/banners/{id}', [AdminController::class, 'deleteBanner'], $admin);
    $r->get('/admin/settings', [AdminController::class, 'settings'], ['mw.auth', 'mw.role.admin']);
    $r->patch('/admin/settings', [AdminController::class, 'updateSettings'], $admin);
    $r->get('/admin/activity', [AdminController::class, 'activity'], ['mw.auth', 'mw.role.admin']);
    $r->get('/admin/refunds', [AdminController::class, 'refunds'], ['mw.auth', 'mw.role.admin']);
    $r->patch('/admin/refunds/{id}', [AdminController::class, 'decideRefund'], $admin);
    $r->get('/admin/payouts', [AdminController::class, 'payouts'], ['mw.auth', 'mw.role.admin']);
    $r->patch('/admin/payouts/{id}', [AdminController::class, 'decidePayout'], $admin);
    $r->get('/admin/support', [AdminController::class, 'supportMessages'], ['mw.auth', 'mw.role.admin']);
    $r->patch('/admin/support/{id}', [AdminController::class, 'updateSupportMessage'], $admin);
};
