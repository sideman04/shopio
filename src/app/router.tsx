import { Route, Routes } from 'react-router-dom'

/* Layouts */
import { RequireAuth } from '@/components/auth/ProtectedRoute'
import { StorefrontLayout } from '@/components/layouts/StorefrontLayout'
import { AuthLayout } from '@/components/layouts/AuthLayout'
import { CustomerLayout } from '@/components/layouts/CustomerLayout'
import { SellerLayout } from '@/components/layouts/SellerLayout'
import { AdminLayout } from '@/components/layouts/AdminLayout'

/* Storefront */
import HomePage from '@/pages/storefront/HomePage'
import ShopPage from '@/pages/storefront/ShopPage'
import CategoriesPage from '@/pages/storefront/CategoriesPage'
import CategoryDetailPage from '@/pages/storefront/CategoryDetailPage'
import ProductDetailPage from '@/pages/storefront/ProductDetailPage'
import SearchPage from '@/pages/storefront/SearchPage'
import WishlistPage from '@/pages/storefront/WishlistPage'
import CartPage from '@/pages/storefront/CartPage'
import CheckoutPage from '@/pages/storefront/CheckoutPage'
import OrderConfirmationPage from '@/pages/storefront/OrderConfirmationPage'
import AboutPage from '@/pages/storefront/AboutPage'
import ContactPage from '@/pages/storefront/ContactPage'

/* Auth */
import LoginPage from '@/pages/auth/LoginPage'
import RegisterPage from '@/pages/auth/RegisterPage'
import ForgotPasswordPage from '@/pages/auth/ForgotPasswordPage'
import ResetPasswordPage from '@/pages/auth/ResetPasswordPage'

/* Legal & utility */
import FaqPage from '@/pages/legal/FaqPage'
import ShippingReturnsPage from '@/pages/legal/ShippingReturnsPage'
import PrivacyPolicyPage from '@/pages/legal/PrivacyPolicyPage'
import TermsPage from '@/pages/legal/TermsPage'
import NotFoundPage from '@/pages/legal/NotFoundPage'

/* Seller onboarding (public) */
import SellLandingPage from '@/pages/seller/SellLandingPage'
import SellerRegisterPage from '@/pages/seller/SellerRegisterPage'

/* Customer */
import AccountOverviewPage from '@/pages/customer/AccountOverviewPage'
import AccountOrdersPage from '@/pages/customer/AccountOrdersPage'
import AccountOrderDetailPage from '@/pages/customer/AccountOrderDetailPage'
import AccountProfilePage from '@/pages/customer/AccountProfilePage'
import AccountAddressesPage from '@/pages/customer/AccountAddressesPage'
import AccountWishlistPage from '@/pages/customer/AccountWishlistPage'
import AccountReviewsPage from '@/pages/customer/AccountReviewsPage'
import AccountNotificationsPage from '@/pages/customer/AccountNotificationsPage'
import AccountSecurityPage from '@/pages/customer/AccountSecurityPage'

/* Seller */
import SellerDashboardPage from '@/pages/seller/SellerDashboardPage'
import SellerProductsPage from '@/pages/seller/SellerProductsPage'
import SellerProductFormPage from '@/pages/seller/SellerProductFormPage'
import SellerOrdersPage from '@/pages/seller/SellerOrdersPage'
import SellerOrderDetailPage from '@/pages/seller/SellerOrderDetailPage'
import SellerInventoryPage from '@/pages/seller/SellerInventoryPage'
import SellerAnalyticsPage from '@/pages/seller/SellerAnalyticsPage'
import SellerStorePage from '@/pages/seller/SellerStorePage'
import SellerPayoutsPage from '@/pages/seller/SellerPayoutsPage'
import SellerReviewsPage from '@/pages/seller/SellerReviewsPage'
import SellerSettingsPage from '@/pages/seller/SellerSettingsPage'

/* Admin */
import AdminOverviewPage from '@/pages/admin/AdminOverviewPage'
import AdminUsersPage from '@/pages/admin/AdminUsersPage'
import AdminSellersPage from '@/pages/admin/AdminSellersPage'
import AdminProductsPage from '@/pages/admin/AdminProductsPage'
import AdminCategoriesPage from '@/pages/admin/AdminCategoriesPage'
import AdminOrdersPage from '@/pages/admin/AdminOrdersPage'
import AdminOrderDetailPage from '@/pages/admin/AdminOrderDetailPage'
import AdminTransactionsPage from '@/pages/admin/AdminTransactionsPage'
import AdminPromotionsPage from '@/pages/admin/AdminPromotionsPage'
import AdminReviewsPage from '@/pages/admin/AdminReviewsPage'
import AdminAnalyticsPage from '@/pages/admin/AdminAnalyticsPage'
import AdminBannersPage from '@/pages/admin/AdminBannersPage'
import AdminSettingsPage from '@/pages/admin/AdminSettingsPage'
import AdminActivityPage from '@/pages/admin/AdminActivityPage'

/**
 * Application routes.
 *
 * The tree is deliberately split into four shells — public storefront, auth,
 * and the three role dashboards — so navigation never leaks between roles.
 * Route guards are a client-side convenience only; the backend must authorise
 * every request.
 */
export function AppRoutes() {
  return (
    <Routes>
      {/* ----------------------------- Storefront ---------------------------- */}
      <Route element={<StorefrontLayout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/shop" element={<ShopPage />} />
        <Route path="/categories" element={<CategoriesPage />} />
        <Route path="/categories/:slug" element={<CategoryDetailPage />} />
        <Route path="/product/:slug" element={<ProductDetailPage />} />
        <Route path="/search" element={<SearchPage />} />
        <Route path="/wishlist" element={<WishlistPage />} />
        <Route path="/cart" element={<CartPage />} />
        <Route
          path="/checkout"
          element={
            <RequireAuth>
              <CheckoutPage />
            </RequireAuth>
          }
        />
        <Route path="/order-confirmation/:orderId" element={<OrderConfirmationPage />} />
        <Route path="/about" element={<AboutPage />} />
        <Route path="/contact" element={<ContactPage />} />

        <Route path="/faq" element={<FaqPage />} />
        <Route path="/shipping-returns" element={<ShippingReturnsPage />} />
        <Route path="/privacy-policy" element={<PrivacyPolicyPage />} />
        <Route path="/terms" element={<TermsPage />} />

        {/* Seller onboarding is public */}
        <Route path="/sell" element={<SellLandingPage />} />
        <Route path="/seller/register" element={<SellerRegisterPage />} />

        {/* Fallback */}
        <Route path="*" element={<NotFoundPage />} />
      </Route>

      {/* -------------------------------- Auth ------------------------------- */}
      <Route element={<AuthLayout />}>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
      </Route>

      {/* ------------------------------ Customer ----------------------------- */}
      <Route path="/account" element={<CustomerLayout />}>
        <Route index element={<AccountOverviewPage />} />
        <Route path="orders" element={<AccountOrdersPage />} />
        <Route path="orders/:id" element={<AccountOrderDetailPage />} />
        <Route path="profile" element={<AccountProfilePage />} />
        <Route path="addresses" element={<AccountAddressesPage />} />
        <Route path="wishlist" element={<AccountWishlistPage />} />
        <Route path="reviews" element={<AccountReviewsPage />} />
        <Route path="notifications" element={<AccountNotificationsPage />} />
        <Route path="security" element={<AccountSecurityPage />} />
      </Route>

      {/* ------------------------------- Seller ------------------------------ */}
      <Route path="/seller" element={<SellerLayout />}>
        <Route index element={<SellerDashboardPage />} />
        <Route path="dashboard" element={<SellerDashboardPage />} />
        <Route path="products" element={<SellerProductsPage />} />
        <Route path="products/new" element={<SellerProductFormPage />} />
        <Route path="products/:id/edit" element={<SellerProductFormPage />} />
        <Route path="orders" element={<SellerOrdersPage />} />
        <Route path="orders/:id" element={<SellerOrderDetailPage />} />
        <Route path="inventory" element={<SellerInventoryPage />} />
        <Route path="analytics" element={<SellerAnalyticsPage />} />
        <Route path="store" element={<SellerStorePage />} />
        <Route path="payouts" element={<SellerPayoutsPage />} />
        <Route path="reviews" element={<SellerReviewsPage />} />
        <Route path="settings" element={<SellerSettingsPage />} />
      </Route>

      {/* -------------------------------- Admin ------------------------------ */}
      <Route path="/admin" element={<AdminLayout />}>
        <Route index element={<AdminOverviewPage />} />
        <Route path="users" element={<AdminUsersPage />} />
        <Route path="sellers" element={<AdminSellersPage />} />
        <Route path="products" element={<AdminProductsPage />} />
        <Route path="categories" element={<AdminCategoriesPage />} />
        <Route path="orders" element={<AdminOrdersPage />} />
        <Route path="orders/:id" element={<AdminOrderDetailPage />} />
        <Route path="transactions" element={<AdminTransactionsPage />} />
        <Route path="promotions" element={<AdminPromotionsPage />} />
        <Route path="reviews" element={<AdminReviewsPage />} />
        <Route path="analytics" element={<AdminAnalyticsPage />} />
        <Route path="banners" element={<AdminBannersPage />} />
        <Route path="settings" element={<AdminSettingsPage />} />
        <Route path="activity" element={<AdminActivityPage />} />
      </Route>
    </Routes>
  )
}
