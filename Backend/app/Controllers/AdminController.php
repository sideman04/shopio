<?php

declare(strict_types=1);

namespace Shopio\Controllers;

use Shopio\Auth\AuthenticatedUser;
use Shopio\Http\Request;
use Shopio\Http\Response;
use Shopio\Policies\AdminPolicy;
use Shopio\Services\AdminService;
use Shopio\Services\OrderService;
use Shopio\Services\PayoutService;
use Shopio\Services\RefundService;
use Shopio\Services\SupportService;
use Shopio\Validators\AdminValidator;

/**
 * Administrator surfaces. The whole controller is gated behind the admin role at
 * the routing layer; individual operations additionally record an audit trail in
 * {@see AdminService}.
 */
final class AdminController extends Controller
{
    public function __construct(
        private readonly AdminService $admin,
        private readonly OrderService $orders,
        private readonly RefundService $refunds,
        private readonly PayoutService $payouts,
        private readonly SupportService $support,
    ) {
    }

    public function overview(Request $request): Response
    {
        return $this->success($this->admin->overview(), 'Overview retrieved successfully', 200, [], $request);
    }

    public function analytics(Request $request): Response
    {
        $days = (int) $request->query('days', 30);

        return $this->success($this->admin->analytics($days), 'Analytics retrieved successfully', 200, [], $request);
    }

    public function users(Request $request): Response
    {
        $result = $this->admin->users($this->filters($request, ['role', 'status', 'q']), $this->page($request), $this->perPage($request));

        return $this->paginated($result['items'], $result['total'], $this->page($request), $this->perPage($request), 'Users retrieved successfully', $request);
    }

    /**
     * @param array<string,string> $params
     */
    public function updateUserStatus(Request $request, array $params): Response
    {
        $data = AdminValidator::userStatus($request->body());
        $result = $this->admin->updateUserStatus($this->admin($request), $this->intParam($params, 'id'), $data, $request);

        return $this->success($result, 'User status updated successfully', 200, [], $request);
    }

    /**
     * @param array<string,string> $params
     */
    public function updateUserRoles(Request $request, array $params): Response
    {
        $data = AdminValidator::userRoles($request->body());
        $result = $this->admin->updateUserRoles($this->admin($request), $this->intParam($params, 'id'), $data, $request);

        return $this->success($result, 'User roles updated successfully', 200, [], $request);
    }

    public function sellers(Request $request): Response
    {
        $result = $this->admin->sellers($this->filters($request, ['verification_status', 'status', 'q']), $this->page($request), $this->perPage($request));

        return $this->paginated($result['items'], $result['total'], $this->page($request), $this->perPage($request), 'Sellers retrieved successfully', $request);
    }

    /**
     * @param array<string,string> $params
     */
    public function verifySeller(Request $request, array $params): Response
    {
        $data = AdminValidator::sellerVerification($request->body());
        $seller = $this->admin->verifySeller($this->admin($request), $this->intParam($params, 'id'), $data, $request);

        return $this->success($seller, 'Seller updated successfully', 200, [], $request);
    }

    public function products(Request $request): Response
    {
        $result = $this->admin->products($this->filters($request, ['status', 'seller_id', 'q']), $this->page($request), $this->perPage($request));

        return $this->paginated($result['items'], $result['total'], $this->page($request), $this->perPage($request), 'Products retrieved successfully', $request);
    }

    /**
     * @param array<string,string> $params
     */
    public function moderateProduct(Request $request, array $params): Response
    {
        $data = AdminValidator::productModeration($request->body());
        $result = $this->admin->moderateProduct($this->admin($request), $this->intParam($params, 'id'), $data, $request);

        return $this->success($result, 'Product moderated successfully', 200, [], $request);
    }

    public function categories(Request $request): Response
    {
        return $this->success($this->admin->categories(), 'Categories retrieved successfully', 200, [], $request);
    }

    public function createCategory(Request $request): Response
    {
        $data = AdminValidator::categoryCreate($request->body());
        $category = $this->admin->createCategory($this->admin($request), $data, $request);

        return $this->created($category, 'Category created successfully', [], $request);
    }

    /**
     * @param array<string,string> $params
     */
    public function updateCategory(Request $request, array $params): Response
    {
        $data = AdminValidator::categoryUpdate($request->body());
        $category = $this->admin->updateCategory($this->admin($request), $this->intParam($params, 'id'), $data, $request);

        return $this->success($category, 'Category updated successfully', 200, [], $request);
    }

    /**
     * @param array<string,string> $params
     */
    public function deleteCategory(Request $request, array $params): Response
    {
        $this->admin->deleteCategory($this->admin($request), $this->intParam($params, 'id'), $request);

        return $this->success(null, 'Category deleted successfully', 200, [], $request);
    }

    public function orders(Request $request): Response
    {
        $result = $this->orders->listForAdmin($this->filters($request, ['status', 'payment_status', 'q']), $this->page($request), $this->perPage($request));

        return $this->paginated($result['items'], $result['total'], $this->page($request), $this->perPage($request), 'Orders retrieved successfully', $request);
    }

    /**
     * @param array<string,string> $params
     */
    public function order(Request $request, array $params): Response
    {
        return $this->success($this->orders->detailForAdmin($this->intParam($params, 'id')), 'Order retrieved successfully', 200, [], $request);
    }

    /**
     * @param array<string,string> $params
     */
    public function updateOrderStatus(Request $request, array $params): Response
    {
        $data = AdminValidator::orderStatus($request->body());
        $order = $this->orders->updateStatusByAdmin($this->admin($request), $this->intParam($params, 'id'), $data, $request);

        return $this->success($order, 'Order status updated successfully', 200, [], $request);
    }

    public function transactions(Request $request): Response
    {
        $result = $this->admin->payments($this->filters($request, ['status', 'provider', 'q']), $this->page($request), $this->perPage($request));

        return $this->paginated($result['items'], $result['total'], $this->page($request), $this->perPage($request), 'Transactions retrieved successfully', $request);
    }

    public function promotions(Request $request): Response
    {
        $result = $this->admin->coupons($this->filters($request, ['status', 'q']), $this->page($request), $this->perPage($request));

        return $this->paginated($result['items'], $result['total'], $this->page($request), $this->perPage($request), 'Coupons retrieved successfully', $request);
    }

    public function createPromotion(Request $request): Response
    {
        $data = AdminValidator::couponCreate($request->body());
        $coupon = $this->admin->createCoupon($this->admin($request), $data, $request);

        return $this->created($coupon, 'Coupon created successfully', [], $request);
    }

    /**
     * @param array<string,string> $params
     */
    public function updatePromotion(Request $request, array $params): Response
    {
        $data = AdminValidator::couponUpdate($request->body());
        $coupon = $this->admin->updateCoupon($this->admin($request), $this->intParam($params, 'id'), $data, $request);

        return $this->success($coupon, 'Coupon updated successfully', 200, [], $request);
    }

    /**
     * @param array<string,string> $params
     */
    public function deletePromotion(Request $request, array $params): Response
    {
        $this->admin->deleteCoupon($this->admin($request), $this->intParam($params, 'id'), $request);

        return $this->success(null, 'Coupon deleted successfully', 200, [], $request);
    }

    public function reviews(Request $request): Response
    {
        $result = $this->admin->reviews($this->filters($request, ['status', 'q']), $this->page($request), $this->perPage($request));

        return $this->paginated($result['items'], $result['total'], $this->page($request), $this->perPage($request), 'Reviews retrieved successfully', $request);
    }

    /**
     * @param array<string,string> $params
     */
    public function moderateReview(Request $request, array $params): Response
    {
        $data = AdminValidator::reviewModeration($request->body());
        $review = $this->admin->moderateReview($this->admin($request), $this->intParam($params, 'id'), $data, $request);

        return $this->success($review, 'Review moderated successfully', 200, [], $request);
    }

    public function reviewReports(Request $request): Response
    {
        $result = $this->admin->reviewReports($this->filters($request, ['status']), $this->page($request), $this->perPage($request));

        return $this->paginated($result['items'], $result['total'], $this->page($request), $this->perPage($request), 'Reports retrieved successfully', $request);
    }

    /**
     * @param array<string,string> $params
     */
    public function resolveReport(Request $request, array $params): Response
    {
        $data = AdminValidator::reportResolve($request->body());
        $result = $this->admin->resolveReport($this->admin($request), $this->intParam($params, 'id'), $data, $request);

        return $this->success($result, 'Report resolved successfully', 200, [], $request);
    }

    public function banners(Request $request): Response
    {
        $result = $this->admin->banners($this->filters($request, ['placement', 'status']), $this->page($request), $this->perPage($request));

        return $this->paginated($result['items'], $result['total'], $this->page($request), $this->perPage($request), 'Banners retrieved successfully', $request);
    }

    public function createBanner(Request $request): Response
    {
        $data = AdminValidator::bannerCreate($request->body());
        $banner = $this->admin->createBanner($this->admin($request), $data, $request);

        return $this->created($banner, 'Banner created successfully', [], $request);
    }

    /**
     * @param array<string,string> $params
     */
    public function updateBanner(Request $request, array $params): Response
    {
        $data = AdminValidator::bannerUpdate($request->body());
        $banner = $this->admin->updateBanner($this->admin($request), $this->intParam($params, 'id'), $data, $request);

        return $this->success($banner, 'Banner updated successfully', 200, [], $request);
    }

    /**
     * @param array<string,string> $params
     */
    public function deleteBanner(Request $request, array $params): Response
    {
        $this->admin->deleteBanner($this->admin($request), $this->intParam($params, 'id'), $request);

        return $this->success(null, 'Banner deleted successfully', 200, [], $request);
    }

    public function settings(Request $request): Response
    {
        return $this->success($this->admin->settings(), 'Settings retrieved successfully', 200, [], $request);
    }

    public function updateSettings(Request $request): Response
    {
        $data = AdminValidator::settings($request->body());
        $settings = $this->admin->updateSettings($this->admin($request), $data, $request);

        return $this->success($settings, 'Settings updated successfully', 200, [], $request);
    }

    public function activity(Request $request): Response
    {
        $result = $this->admin->activity($this->filters($request, ['action', 'entity_type', 'actor_user_id', 'q']), $this->page($request), $this->perPage($request));

        return $this->paginated($result['items'], $result['total'], $this->page($request), $this->perPage($request), 'Activity retrieved successfully', $request);
    }

    public function refunds(Request $request): Response
    {
        $result = $this->refunds->listForAdmin($this->filters($request, ['status', 'q']), $this->page($request), $this->perPage($request));

        return $this->paginated($result['items'], $result['total'], $this->page($request), $this->perPage($request), 'Refunds retrieved successfully', $request);
    }

    /**
     * @param array<string,string> $params
     */
    public function decideRefund(Request $request, array $params): Response
    {
        $data = AdminValidator::refundDecision($request->body());
        $refund = $this->refunds->decide($this->admin($request), $this->intParam($params, 'id'), $data, $request);

        return $this->success($refund, 'Refund updated successfully', 200, [], $request);
    }

    public function payouts(Request $request): Response
    {
        $result = $this->payouts->listForAdmin($this->filters($request, ['status', 'seller_id', 'q']), $this->page($request), $this->perPage($request));

        return $this->paginated($result['items'], $result['total'], $this->page($request), $this->perPage($request), 'Payouts retrieved successfully', $request);
    }

    /**
     * @param array<string,string> $params
     */
    public function decidePayout(Request $request, array $params): Response
    {
        $data = AdminValidator::payoutDecision($request->body());
        $payout = $this->payouts->decide($this->admin($request), $this->intParam($params, 'id'), $data, $request);

        return $this->success($payout, 'Payout updated successfully', 200, [], $request);
    }

    public function supportMessages(Request $request): Response
    {
        $result = $this->admin->supportMessages($this->filters($request, ['status', 'q']), $this->page($request), $this->perPage($request));

        return $this->paginated($result['items'], $result['total'], $this->page($request), $this->perPage($request), 'Support messages retrieved successfully', $request);
    }

    /**
     * @param array<string,string> $params
     */
    public function updateSupportMessage(Request $request, array $params): Response
    {
        $data = AdminValidator::supportStatus($request->body());
        $ticket = $this->support->updateStatus($this->admin($request), $this->intParam($params, 'id'), $data, $request);

        return $this->success($ticket, 'Support message updated successfully', 200, [], $request);
    }

    /**
     * Policy gate: every endpoint here is administration-only.
     */
    private function admin(Request $request): AuthenticatedUser
    {
        $auth = $this->auth($request);
        (new AdminPolicy($auth))->assertAdmin();

        return $auth;
    }

    /**
     * @param list<string> $allowed
     * @return array<string,mixed>
     */
    private function filters(Request $request, array $allowed): array
    {
        $filters = [];
        foreach ($allowed as $key) {
            $value = $request->query($key);
            if ($value !== null && $value !== '') {
                $filters[$key] = $value;
            }
        }

        return $filters;
    }
}
