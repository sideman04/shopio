<?php

declare(strict_types=1);

namespace Shopio\Services;

use Shopio\Auth\AuthenticatedUser;
use Shopio\Config\Config;
use Shopio\Database\Database;
use Shopio\Exceptions\ConflictException;
use Shopio\Exceptions\NotFoundException;
use Shopio\Exceptions\ValidationException;
use Shopio\Http\Request;
use Shopio\Repositories\AuditRepository;
use Shopio\Repositories\BannerRepository;
use Shopio\Repositories\CategoryRepository;
use Shopio\Repositories\CouponRepository;
use Shopio\Repositories\PaymentRepository;
use Shopio\Repositories\ProductRepository;
use Shopio\Repositories\RefundRepository;
use Shopio\Repositories\ReviewRepository;
use Shopio\Repositories\RoleRepository;
use Shopio\Repositories\SellerRepository;
use Shopio\Repositories\SettingsRepository;
use Shopio\Repositories\SupportRepository;
use Shopio\Repositories\UserRepository;
use Shopio\Repositories\OrderRepository;
use Shopio\Support\Money;
use Shopio\Support\Presenter;
use Shopio\Support\Str;

/**
 * Administrator operations: dashboard, users/roles, seller verification,
 * product moderation, categories, coupons, banners, settings and activity.
 */
final class AdminService
{
    public function __construct(
        private readonly Database $db,
        private readonly UserRepository $users,
        private readonly SellerRepository $sellers,
        private readonly ProductRepository $products,
        private readonly CategoryRepository $categories,
        private readonly CouponRepository $coupons,
        private readonly BannerRepository $banners,
        private readonly ReviewRepository $reviews,
        private readonly PaymentRepository $payments,
        private readonly RefundRepository $refunds,
        private readonly SupportRepository $support,
        private readonly SettingsRepository $settings,
        private readonly AuditRepository $audits,
        private readonly OrderRepository $orders,
        private readonly RoleRepository $roles,
        private readonly NotificationService $notifications,
        private readonly AuditService $audit,
    ) {
    }

    /**
     * @return array<string,mixed>
     */
    public function overview(): array
    {
        $since30 = gmdate('Y-m-d H:i:s', time() - 30 * 86400);
        $since60 = gmdate('Y-m-d H:i:s', time() - 60 * 86400);

        $revenue30 = $this->orders->revenueSince($since30);
        $revenue60 = $this->orders->revenueSince($since60);
        $revenuePrev = Money::sub($revenue60, $revenue30);

        $ordersTotal = $this->orders->countAll();
        $orders30 = $this->orders->countPlacedSince($since30);
        $orders60 = $this->orders->countPlacedSince($since60);
        $ordersPrev = max(1, $orders60 - $orders30);

        $customers = $this->users->countByRole('customer');
        $customers30 = $this->users->countCreatedSince($since30);

        $productsTotal = (int) $this->db->scalar('SELECT COUNT(*) FROM products WHERE deleted_at IS NULL');

        $averageOrder = $ordersTotal > 0
            ? Money::div($this->orders->revenueSince(), (string) $ordersTotal)
            : '0.00';

        $carts = (int) $this->db->scalar("SELECT COUNT(*) FROM carts WHERE status = 'converted'");
        $allCarts = (int) $this->db->scalar('SELECT COUNT(*) FROM carts');

        return [
            'totalRevenue' => $this->orders->revenueSince(),
            'revenueChange' => $this->percentChange($revenue30, $revenuePrev),
            'totalOrders' => $ordersTotal,
            'ordersChange' => $this->percentChange((string) $orders30, (string) $ordersPrev),
            'totalCustomers' => $customers,
            'customersChange' => $customers30,
            'activeSellers' => $this->sellers->countActive(),
            'sellersChange' => $this->sellers->countCreatedSince($since30),
            'totalProducts' => $productsTotal,
            'productsChange' => $this->products->countCreatedSince($since30),
            'pendingApplications' => $this->sellers->countPendingVerification(),
            'pendingProducts' => $this->products->countByStatus('pending_review'),
            'conversionRate' => $allCarts > 0 ? round($carts / $allCarts * 100, 2) : 0.0,
            'averageOrderValue' => $averageOrder,
        ];
    }

    /**
     * @return array<string,mixed>
     */
    public function analytics(int $days = 30): array
    {
        $days = max(7, min(90, $days));
        $since = gmdate('Y-m-d H:i:s', time() - $days * 86400);

        $rows = $this->db->select(
            "SELECT DATE(o.placed_at) AS day, COALESCE(SUM(t.grand_total),0) AS revenue, COUNT(*) AS orders
             FROM orders o JOIN v_order_totals t ON t.order_id = o.id
             WHERE o.placed_at >= :since AND o.status NOT IN ('cancelled','refunded')
             GROUP BY DATE(o.placed_at) ORDER BY day ASC",
            ['since' => $since],
        );

        $series = array_map(static fn (array $row): array => [
            'label' => (string) $row['day'],
            'revenue' => (float) $row['revenue'],
            'orders' => (int) $row['orders'],
        ], $rows);

        $statusBreakdown = $this->db->select('SELECT status, COUNT(*) AS count FROM orders GROUP BY status');

        $revenueByCategory = $this->db->select(
            "SELECT COALESCE(c.name, 'Other') AS name,
                    COALESCE(SUM(oi.quantity * oi.unit_price - oi.discount_amount), 0) AS revenue
             FROM order_items oi
             JOIN orders o ON o.id = oi.order_id
             LEFT JOIN product_variants v ON v.id = oi.variant_id
             LEFT JOIN products p ON p.id = v.product_id
             LEFT JOIN categories c ON c.id = p.category_id
             WHERE o.status NOT IN ('cancelled', 'refunded')
               AND o.placed_at >= :since
             GROUP BY c.id, c.name
             ORDER BY revenue DESC",
            ['since' => $since],
        );

        $topProducts = $this->db->select(
            "SELECT oi.product_name_snapshot AS name,
                    COALESCE(SUM(oi.quantity), 0) AS units,
                    COALESCE(SUM(oi.quantity * oi.unit_price - oi.discount_amount), 0) AS revenue
             FROM order_items oi
             JOIN orders o ON o.id = oi.order_id
             WHERE o.status NOT IN ('cancelled', 'refunded')
               AND o.placed_at >= :since
             GROUP BY oi.product_name_snapshot
             ORDER BY revenue DESC
             LIMIT 10",
            ['since' => $since],
        );

        $topSellers = $this->db->select(
            "SELECT s.store_name AS store,
                    COALESCE(SUM(oi.quantity * oi.unit_price - oi.discount_amount), 0) AS revenue,
                    COUNT(DISTINCT o.id) AS orders
             FROM order_items oi
             JOIN orders o ON o.id = oi.order_id
             JOIN seller_profiles s ON s.id = oi.seller_id
             WHERE o.status NOT IN ('cancelled', 'refunded')
               AND o.placed_at >= :since
             GROUP BY s.id, s.store_name
             ORDER BY revenue DESC
             LIMIT 10",
            ['since' => $since],
        );

        $customerGrowth = $this->customerGrowth(12);

        return [
            'series' => $series,
            'statusBreakdown' => array_map(static fn (array $row): array => [
                'status' => (string) $row['status'],
                'count' => (int) $row['count'],
            ], $statusBreakdown),
            'revenueByCategory' => array_map(static fn (array $row): array => [
                'name' => (string) $row['name'],
                'value' => (float) $row['revenue'],
            ], $revenueByCategory),
            'topProducts' => array_map(static fn (array $row): array => [
                'name' => (string) $row['name'],
                'units' => (int) $row['units'],
                'revenue' => (float) $row['revenue'],
            ], $topProducts),
            'topSellers' => array_map(static fn (array $row): array => [
                'store' => (string) $row['store'],
                'revenue' => (float) $row['revenue'],
                'orders' => (int) $row['orders'],
            ], $topSellers),
            'customerGrowth' => $customerGrowth,
            'refundsPending' => $this->refunds->pendingCount(),
            'payoutsPending' => $this->db->scalar("SELECT COUNT(*) FROM seller_payouts WHERE status IN ('requested','pending','processing')"),
        ];
    }

    /**
     * Total/new customers per month for the last N months.
     *
     * @return list<array{label:string,customers:int,newCustomers:int}>
     */
    private function customerGrowth(int $months): array
    {
        $months = max(1, min(24, $months));
        $start = new \DateTimeImmutable('first day of this month 00:00:00', new \DateTimeZone('UTC'));
        $start = $start->modify('-' . ($months - 1) . ' months');

        $newByMonth = [];
        $rows = $this->db->select(
            "SELECT DATE_FORMAT(created_at, '%Y-%m') AS ym, COUNT(*) AS total
             FROM users WHERE created_at >= :since GROUP BY ym",
            ['since' => $start->format('Y-m-d H:i:s')],
        );
        foreach ($rows as $row) {
            $newByMonth[(string) $row['ym']] = (int) $row['total'];
        }

        $total = (int) $this->db->scalar(
            'SELECT COUNT(*) FROM users WHERE created_at < :since',
            ['since' => $start->format('Y-m-d H:i:s')],
        );

        $series = [];
        for ($i = 0; $i < $months; $i++) {
            $month = $start->modify('+' . $i . ' months');
            $key = $month->format('Y-m');
            $new = $newByMonth[$key] ?? 0;
            $total += $new;
            $series[] = [
                'label' => $month->format('M Y'),
                'customers' => $total,
                'newCustomers' => $new,
            ];
        }

        return $series;
    }

    /**
     * @return array{items:list<array<string,mixed>>,total:int}
     */
    public function users(array $filters, int $page, int $perPage): array
    {
        $result = $this->users->paginate($filters, $page, $perPage);

        $items = array_map(static function (array $row): array {
            return [
                'id' => (int) $row['id'],
                'fullName' => (string) $row['full_name'],
                'email' => (string) $row['email'],
                'phone' => $row['phone'] ?? null,
                'status' => (string) $row['status'],
                'emailVerifiedAt' => $row['email_verified_at'] ?? null,
                'lastLoginAt' => $row['last_login_at'] ?? null,
                'createdAt' => $row['created_at'] ?? null,
                'roles' => $row['roles'] === null ? [] : explode(',', (string) $row['roles']),
            ];
        }, $result['rows']);

        return ['items' => $items, 'total' => $result['total']];
    }

    public function updateUserStatus(AuthenticatedUser $auth, int $userId, array $data, Request $request): array
    {
        $user = $this->requireUser($userId);

        if ((int) $user['id'] === $auth->id && $data['status'] !== 'active') {
            throw new ConflictException('You cannot change your own account status.');
        }

        $this->users->setStatus($userId, (string) $data['status']);
        $this->audit->record($auth, 'admin.user_status', 'user', $userId, $request, ['status' => $data['status']]);

        return ['id' => $userId, 'status' => (string) $data['status']];
    }

    public function updateUserRoles(AuthenticatedUser $auth, int $userId, array $data, Request $request): array
    {
        $this->requireUser($userId);

        $requested = array_values(array_unique(array_map('strval', $data['roles'])));
        $allowed = ['customer', 'seller', 'admin'];
        foreach ($requested as $role) {
            if (!in_array($role, $allowed, true)) {
                throw new ValidationException(['roles' => ['Unknown role: ' . $role . '.']]);
            }
        }

        // An administrator can never revoke their own admin role (lock-out guard).
        if ($userId === $auth->id && !in_array('admin', $requested, true)) {
            throw new ConflictException('You cannot remove your own administrator role.');
        }

        $this->db->transaction(function () use ($userId, $requested, $auth): void {
            foreach ($this->roles->all() as $role) {
                $code = (string) $role['code'];
                $roleId = (int) $role['id'];

                if (in_array($code, $requested, true)) {
                    $this->users->assignRole($userId, $roleId, $auth->id);
                } else {
                    $this->users->removeRole($userId, $roleId);
                }
            }
        });

        $this->audit->record($auth, 'admin.user_roles', 'user', $userId, $request, ['roles' => $requested]);

        return ['id' => $userId, 'roles' => $requested];
    }

    /**
     * @return array{items:list<array<string,mixed>>,total:int}
     */
    public function sellers(array $filters, int $page, int $perPage): array
    {
        $result = $this->sellers->paginateAdmin($filters, $page, $perPage);

        return [
            'items' => array_map(static fn (array $row): array => Presenter::seller($row, true), $result['rows']),
            'total' => $result['total'],
        ];
    }

    public function verifySeller(AuthenticatedUser $auth, int $sellerId, array $data, Request $request): array
    {
        $seller = $this->sellers->findById($sellerId);
        if ($seller === null) {
            throw new NotFoundException('The requested store does not exist.');
        }

        if (isset($data['verification_status'])) {
            $this->sellers->updateVerification(
                $sellerId,
                (string) $data['verification_status'],
                $data['notes'] ?? null,
                $auth->id,
            );
        }

        if (isset($data['status'])) {
            $this->sellers->setStatus($sellerId, (string) $data['status']);
        }

        if (isset($data['commission_rate'])) {
            $this->sellers->setCommissionRate($sellerId, Money::format((string) $data['commission_rate']));
        }

        $this->audit->record($auth, 'admin.seller_verification', 'seller', $sellerId, $request, [
            'verification_status' => $data['verification_status'] ?? null,
        ]);

        $ownerId = $this->db->scalar('SELECT user_id FROM seller_profiles WHERE id = :id', ['id' => $sellerId]);
        if ($ownerId !== null && isset($data['verification_status'])) {
            $this->notifications->notify(
                (int) $ownerId,
                'seller',
                'Store verification ' . (string) $data['verification_status'],
                'Your store verification status is now ' . (string) $data['verification_status'] . '.',
                '/seller',
            );
        }

        return Presenter::seller($this->sellers->findByIdWithPrivate($sellerId) ?? [], true);
    }

    /**
     * @return array{items:list<array<string,mixed>>,total:int}
     */
    public function products(array $filters, int $page, int $perPage): array
    {
        $result = $this->products->paginateForAdmin($filters, $page, $perPage);

        $items = array_map(function (array $row): array {
            $productId = (int) $row['id'];
            $variants = [];
            foreach ($this->products->variants($productId) as $variant) {
                $variants[] = Presenter::sellerVariant($variant) + [
                    'options' => $this->products->variantOptions((int) $variant['id']),
                ];
            }

            $product = Presenter::product(
                $row,
                $this->products->images($productId),
                [],
                $this->products->optionTypes($productId),
            );
            $product['variants'] = $variants;
            $product['rejectionReason'] = $row['rejection_reason'] ?? null;
            $product['variantCount'] = count($variants);
            $product['availableStock'] = array_sum(array_map(
                static fn (array $variant): int => (int) ($variant['availableStock'] ?? 0),
                $variants,
            ));
            $product['primaryImage'] = $product['images'][0]['imageUrl'] ?? null;

            return $product;
        }, $result['rows']);

        return ['items' => $items, 'total' => $result['total']];
    }

    public function moderateProduct(AuthenticatedUser $auth, int $productId, array $data, Request $request): array
    {
        $product = $this->products->findForAdmin($productId);
        if ($product === null) {
            throw new NotFoundException('The requested product does not exist.');
        }

        $status = (string) $data['status'];

        if ($status === 'active') {
            $this->products->markApproved($productId, $auth->id);
        } else {
            $this->products->setStatus($productId, $status, $data['rejection_reason'] ?? null);
        }

        $this->audit->record($auth, 'admin.product_moderated', 'product', $productId, $request, ['status' => $status]);

        $seller = $this->sellers->findById((int) $product['seller_id']);
        if ($seller !== null && isset($seller['user_id'])) {
            $this->notifications->notify(
                (int) $seller['user_id'],
                'product',
                'Product ' . $status,
                'Your product "' . (string) $product['name'] . '" has been marked as ' . $status . '.',
                '/seller/products/' . $productId,
            );
        }

        return ['id' => $productId, 'status' => $status];
    }

    /**
     * @return list<array<string,mixed>>
     */
    public function categories(): array
    {
        return array_map([Presenter::class, 'category'], $this->categories->allForAdmin());
    }

    public function createCategory(AuthenticatedUser $auth, array $data, Request $request): array
    {
        $slug = $this->uniqueCategorySlug((string) ($data['slug'] ?? $data['name']));

        if (!empty($data['parent_id']) && !$this->categories->exists((int) $data['parent_id'])) {
            throw new ValidationException(['parent_id' => ['The selected parent category does not exist.']]);
        }

        $id = $this->categories->create($data + ['slug' => $slug]);
        $this->audit->record($auth, 'admin.category_created', 'category', $id, $request);

        return Presenter::category($this->categories->findById($id) ?? []);
    }

    public function updateCategory(AuthenticatedUser $auth, int $categoryId, array $data, Request $request): array
    {
        if ($this->categories->findById($categoryId) === null) {
            throw new NotFoundException('The requested category does not exist.');
        }

        if (isset($data['slug']) && $this->categories->slugExists((string) $data['slug'], $categoryId)) {
            throw new ConflictException('That slug is already in use.');
        }

        if (!empty($data['parent_id']) && (int) $data['parent_id'] === $categoryId) {
            throw new ValidationException(['parent_id' => ['A category cannot be its own parent.']]);
        }

        $this->categories->update($categoryId, $data);
        $this->audit->record($auth, 'admin.category_updated', 'category', $categoryId, $request);

        return Presenter::category($this->categories->findById($categoryId) ?? []);
    }

    public function deleteCategory(AuthenticatedUser $auth, int $categoryId, Request $request): void
    {
        if ($this->categories->findById($categoryId) === null) {
            throw new NotFoundException('The requested category does not exist.');
        }

        if ($this->categories->hasChildren($categoryId)) {
            throw new ConflictException('This category has sub-categories and cannot be deleted.');
        }

        $inUse = (int) $this->db->scalar('SELECT COUNT(*) FROM products WHERE category_id = :id AND deleted_at IS NULL', ['id' => $categoryId]);
        if ($inUse > 0) {
            throw new ConflictException('This category is in use by products and cannot be deleted.');
        }

        $this->categories->delete($categoryId);
        $this->audit->record($auth, 'admin.category_deleted', 'category', $categoryId, $request);
    }

    /**
     * @return array{items:list<array<string,mixed>>,total:int}
     */
    public function coupons(array $filters, int $page, int $perPage): array
    {
        $result = $this->coupons->paginateForAdmin($filters, $page, $perPage);

        $items = array_map(static function (array $row): array {
            $coupon = Presenter::coupon($row);
            $coupon['totalDiscount'] = (string) ($row['total_discount'] ?? '0.00');
            $coupon['createdAt'] = $row['created_at'] ?? null;

            return $coupon;
        }, $result['rows']);

        return ['items' => $items, 'total' => $result['total']];
    }

    public function createCoupon(AuthenticatedUser $auth, array $data, Request $request): array
    {
        $exists = $this->coupons->findByCode((string) $data['code']);
        if ($exists !== null) {
            throw new ConflictException('A coupon with this code already exists.');
        }

        $id = $this->coupons->create($data + ['created_by' => $auth->id]);
        $this->audit->record($auth, 'admin.coupon_created', 'coupon', $id, $request);

        return Presenter::coupon($this->coupons->findById($id) ?? []);
    }

    public function updateCoupon(AuthenticatedUser $auth, int $couponId, array $data, Request $request): array
    {
        if ($this->coupons->findById($couponId) === null) {
            throw new NotFoundException('The requested coupon does not exist.');
        }

        $this->coupons->update($couponId, $data);
        $this->audit->record($auth, 'admin.coupon_updated', 'coupon', $couponId, $request);

        return Presenter::coupon($this->coupons->findById($couponId) ?? []);
    }

    public function deleteCoupon(AuthenticatedUser $auth, int $couponId, Request $request): void
    {
        if ($this->coupons->findById($couponId) === null) {
            throw new NotFoundException('The requested coupon does not exist.');
        }

        $this->coupons->delete($couponId);
        $this->audit->record($auth, 'admin.coupon_deleted', 'coupon', $couponId, $request);
    }

    /**
     * @return array{items:list<array<string,mixed>>,total:int}
     */
    public function banners(array $filters, int $page, int $perPage): array
    {
        $result = $this->banners->paginateForAdmin($filters, $page, $perPage);

        return ['items' => array_map([Presenter::class, 'banner'], $result['rows']), 'total' => $result['total']];
    }

    public function createBanner(AuthenticatedUser $auth, array $data, Request $request): array
    {
        $id = $this->banners->create($data + ['created_by' => $auth->id]);
        $this->audit->record($auth, 'admin.banner_created', 'banner', $id, $request);

        return Presenter::banner($this->banners->findById($id) ?? []);
    }

    public function updateBanner(AuthenticatedUser $auth, int $bannerId, array $data, Request $request): array
    {
        if ($this->banners->findById($bannerId) === null) {
            throw new NotFoundException('The requested banner does not exist.');
        }

        $this->banners->update($bannerId, $data);
        $this->audit->record($auth, 'admin.banner_updated', 'banner', $bannerId, $request);

        return Presenter::banner($this->banners->findById($bannerId) ?? []);
    }

    public function deleteBanner(AuthenticatedUser $auth, int $bannerId, Request $request): void
    {
        if (!$this->banners->delete($bannerId)) {
            throw new NotFoundException('The requested banner does not exist.');
        }

        $this->audit->record($auth, 'admin.banner_deleted', 'banner', $bannerId, $request);
    }

    /**
     * @return array{items:list<array<string,mixed>>,total:int}
     */
    public function reviews(array $filters, int $page, int $perPage): array
    {
        $result = $this->reviews->paginateForAdmin($filters, $page, $perPage);

        return ['items' => array_map(static fn (array $row): array => Presenter::review($row, true), $result['rows']), 'total' => $result['total']];
    }

    public function moderateReview(AuthenticatedUser $auth, int $reviewId, array $data, Request $request): array
    {
        $review = $this->reviews->findById($reviewId);
        if ($review === null) {
            throw new NotFoundException('The requested review does not exist.');
        }

        $this->reviews->moderate($reviewId, (string) $data['status'], $auth->id);
        $this->audit->record($auth, 'admin.review_moderated', 'review', $reviewId, $request, ['status' => $data['status']]);

        // Re-read to reflect the moderation change; fall back to the pre-update
        // snapshot if the row is somehow unreadable (it is not deleted here).
        $updated = $this->reviews->findById($reviewId);
        if ($updated === null) {
            $updated = $review;
        }

        return Presenter::review($updated, true);
    }

    /**
     * @return array{items:list<array<string,mixed>>,total:int}
     */
    public function reviewReports(array $filters, int $page, int $perPage): array
    {
        $result = $this->reviews->paginateReports($filters, $page, $perPage);

        $items = array_map(static fn (array $row): array => [
            'id' => (int) $row['id'],
            'reviewId' => (int) $row['review_id'],
            'reason' => (string) $row['reason'],
            'status' => (string) $row['status'],
            'rating' => (int) $row['rating'],
            'reviewText' => $row['review_text'] ?? null,
            'productId' => (int) $row['product_id'],
            'reporterName' => $row['reporter_name'] ?? null,
            'createdAt' => $row['created_at'] ?? null,
            'resolvedAt' => $row['resolved_at'] ?? null,
        ], $result['rows']);

        return ['items' => $items, 'total' => $result['total']];
    }

    public function resolveReport(AuthenticatedUser $auth, int $reportId, array $data, Request $request): array
    {
        if (!$this->reviews->resolveReport($reportId, (string) $data['status'], $auth->id)) {
            throw new NotFoundException('The requested report does not exist.');
        }

        $this->audit->record($auth, 'admin.review_report_resolved', 'review_report', $reportId, $request);

        return ['id' => $reportId, 'status' => (string) $data['status']];
    }

    /**
     * @return array{items:list<array<string,mixed>>,total:int}
     */
    public function payments(array $filters, int $page, int $perPage): array
    {
        $result = $this->payments->paginateForAdmin($filters, $page, $perPage);

        $items = array_map(static function (array $row): array {
            $payment = Presenter::payment($row);
            $payment['customerName'] = $row['customer_name'] ?? null;

            return $payment;
        }, $result['rows']);

        return ['items' => $items, 'total' => $result['total']];
    }

    /**
     * @return array<string,mixed>
     */
    public function settings(): array
    {
        return $this->settings->all();
    }

    /**
     * @param array<string,mixed> $data
     * @return array<string,mixed>
     */
    public function updateSettings(AuthenticatedUser $auth, array $data, Request $request): array
    {
        foreach ($data['settings'] as $key => $value) {
            $this->settings->set((string) $key, $value, $auth->id);
        }

        $this->audit->record($auth, 'admin.settings_updated', 'settings', null, $request, ['keys' => array_keys($data['settings'])]);

        return $this->settings->all();
    }

    /**
     * @return array{items:list<array<string,mixed>>,total:int}
     */
    public function activity(array $filters, int $page, int $perPage): array
    {
        $result = $this->audits->paginate($filters, $page, $perPage);

        return ['items' => array_map([Presenter::class, 'auditLog'], $result['rows']), 'total' => $result['total']];
    }

    /**
     * @return array{items:list<array<string,mixed>>,total:int}
     */
    public function supportMessages(array $filters, int $page, int $perPage): array
    {
        $result = $this->support->paginateForAdmin($filters, $page, $perPage);

        return [
            'items' => array_map(static fn (array $row): array => [
                'id' => (int) $row['id'],
                'name' => (string) $row['name'],
                'email' => (string) $row['email'],
                'subject' => (string) $row['subject'],
                'message' => (string) $row['message'],
                'status' => (string) $row['status'],
                'assignedToName' => $row['assigned_to_name'] ?? null,
                'createdAt' => $row['created_at'] ?? null,
            ], $result['rows']),
            'total' => $result['total'],
        ];
    }

    /**
     * @return array<string,mixed>
     */
    private function requireUser(int $userId): array
    {
        $user = $this->users->findById($userId);
        if ($user === null || ($user['deleted_at'] ?? null) !== null) {
            throw new NotFoundException('The requested user does not exist.');
        }

        return $user;
    }

    private function percentChange(string $current, string $previous): float
    {
        if (Money::compare($previous, '0') === 0) {
            return Money::compare($current, '0') > 0 ? 100.0 : 0.0;
        }

        $ratio = Money::div(Money::sub($current, $previous), $previous);

        return round((float) $ratio * 100, 2);
    }

    private function uniqueCategorySlug(string $source): string
    {
        $base = Str::slug($source) ?: 'category';
        $slug = $base;
        $attempt = 0;

        while ($this->categories->slugExists($slug)) {
            $attempt++;
            $slug = $base . '-' . strtolower(bin2hex(random_bytes(3)));
            if ($attempt > 10) {
                $slug = $base . '-' . time();
                break;
            }
        }

        return $slug;
    }
}
