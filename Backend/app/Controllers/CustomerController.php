<?php

declare(strict_types=1);

namespace Shopio\Controllers;

use Shopio\Http\Request;
use Shopio\Http\Response;
use Shopio\Services\CartService;
use Shopio\Services\CouponService;
use Shopio\Services\NotificationService;
use Shopio\Services\ProfileService;
use Shopio\Services\ReviewService;
use Shopio\Services\SecurityService;
use Shopio\Services\SupportService;
use Shopio\Services\WishlistService;
use Shopio\Validators\CommerceValidator;
use Shopio\Validators\ProfileValidator;
use Shopio\Validators\Validator;

/**
 * Customer-scoped account surfaces: profile, addresses, notifications, wishlist,
 * coupon validation, reviews and support intake.
 */
final class CustomerController extends Controller
{
    public function __construct(
        private readonly ProfileService $profiles,
        private readonly NotificationService $notifications,
        private readonly WishlistService $wishlist,
        private readonly ReviewService $reviews,
        private readonly CouponService $coupons,
        private readonly CartService $cart,
        private readonly SupportService $support,
        private readonly SecurityService $security,
    ) {
    }

    public function profile(Request $request): Response
    {
        return $this->success($this->profiles->profile($this->auth($request)), 'Profile retrieved successfully', 200, [], $request);
    }

    public function updateProfile(Request $request): Response
    {
        $data = ProfileValidator::update($request->body());
        $profile = $this->profiles->updateProfile($this->auth($request), $data, $request);

        return $this->success($profile, 'Profile updated successfully', 200, [], $request);
    }

    public function addresses(Request $request): Response
    {
        return $this->success($this->profiles->addresses($this->auth($request)), 'Addresses retrieved successfully', 200, [], $request);
    }

    public function createAddress(Request $request): Response
    {
        $data = ProfileValidator::addressCreate($request->body());
        $address = $this->profiles->createAddress($this->auth($request), $data, $request);

        return $this->created($address, 'Address created successfully', [], $request);
    }

    /**
     * @param array<string,string> $params
     */
    public function updateAddress(Request $request, array $params): Response
    {
        $data = ProfileValidator::addressUpdate($request->body());
        $address = $this->profiles->updateAddress($this->auth($request), $this->intParam($params, 'id'), $data, $request);

        return $this->success($address, 'Address updated successfully', 200, [], $request);
    }

    /**
     * @param array<string,string> $params
     */
    public function deleteAddress(Request $request, array $params): Response
    {
        $this->profiles->deleteAddress($this->auth($request), $this->intParam($params, 'id'), $request);

        return $this->success(null, 'Address deleted successfully', 200, [], $request);
    }

    public function notifications(Request $request): Response
    {
        $auth = $this->auth($request);
        $onlyUnread = $request->query('unread') === 'true' || $request->query('unread') === '1';

        $result = $this->notifications->paginate($auth->id, $onlyUnread, $this->page($request), $this->perPage($request));

        return $this->success(
            array_map([\Shopio\Support\Presenter::class, 'notification'], $result['rows']),
            'Notifications retrieved successfully',
            200,
            [
                'pagination' => [
                    'total' => $result['total'],
                    'page' => $this->page($request),
                    'per_page' => $this->perPage($request),
                    'total_pages' => $this->perPage($request) > 0 ? (int) ceil($result['total'] / $this->perPage($request)) : 0,
                    'has_more' => $this->page($request) * $this->perPage($request) < $result['total'],
                ],
                'unread' => $result['unread'],
            ],
            $request,
        );
    }

    /**
     * @param array<string,string> $params
     */
    public function readNotification(Request $request, array $params): Response
    {
        $ok = $this->notifications->markRead($this->intParam($params, 'id'), $this->auth($request)->id);

        return $this->success(['updated' => $ok], 'Notification marked as read', 200, [], $request);
    }

    public function readAllNotifications(Request $request): Response
    {
        $count = $this->notifications->markAllRead($this->auth($request)->id);

        return $this->success(['updated' => $count], 'All notifications marked as read', 200, [], $request);
    }

    public function sessions(Request $request): Response
    {
        return $this->success(
            $this->security->sessions($this->auth($request)),
            'Sessions retrieved successfully',
            200,
            [],
            $request,
        );
    }

    /**
     * @param array<string,string> $params
     */
    public function revokeSession(Request $request, array $params): Response
    {
        $this->security->revokeSession($this->auth($request), $this->intParam($params, 'id'));

        return $this->success(null, 'Session revoked successfully', 200, [], $request);
    }

    public function revokeOtherSessions(Request $request): Response
    {
        $count = $this->security->revokeOtherSessions($this->auth($request));

        return $this->success(['revoked' => $count], 'Other sessions revoked successfully', 200, [], $request);
    }

    public function loginActivity(Request $request): Response
    {
        $result = $this->security->loginActivity($this->auth($request), $this->perPage($request, 25, 100));

        return $this->success($result, 'Login activity retrieved successfully', 200, [], $request);
    }

    public function wishlist(Request $request): Response
    {
        $result = $this->wishlist->list($this->auth($request), $this->page($request), $this->perPage($request));

        return $this->paginated($result['items'], $result['total'], $this->page($request), $this->perPage($request), 'Wishlist retrieved successfully', $request);
    }

    public function addToWishlist(Request $request): Response
    {
        $data = CommerceValidator::wishlistAdd($request->body());
        $this->wishlist->add($this->auth($request), (int) $data['product_id']);

        return $this->created(['productId' => (int) $data['product_id']], 'Added to wishlist', [], $request);
    }

    /**
     * @param array<string,string> $params
     */
    public function removeFromWishlist(Request $request, array $params): Response
    {
        $this->wishlist->remove($this->auth($request), $this->intParam($params, 'productId'));

        return $this->success(null, 'Removed from wishlist', 200, [], $request);
    }

    public function validateCoupon(Request $request): Response
    {
        $data = Validator::check($request->body(), [
            'code' => 'required|safe_text|string|min:2|max:60',
            'subtotal' => 'sometimes|decimal|min:0',
        ]);

        $auth = $this->auth($request);
        $subtotal = (string) ($data['subtotal'] ?? $this->cart->get($auth)['subtotal']);
        $preview = $this->coupons->preview((string) $data['code'], $subtotal, $auth->id);

        return $this->success([
            'code' => $preview['code'],
            'discount' => $preview['discount'],
            'freeShipping' => $preview['free_shipping'],
        ], 'Coupon applied successfully', 200, [], $request);
    }

    /**
     * @param array<string,string> $params
     */
    public function createReview(Request $request, array $params): Response
    {
        $data = CommerceValidator::reviewCreate($request->body());
        $review = $this->reviews->create($this->auth($request), $this->intParam($params, 'id'), $data, $request);

        return $this->created($review, 'Review submitted successfully', [], $request);
    }

    /**
     * @param array<string,string> $params
     */
    public function reportReview(Request $request, array $params): Response
    {
        $data = CommerceValidator::reviewReport($request->body());
        $this->reviews->report($this->auth($request), $this->intParam($params, 'id'), $data, $request);

        return $this->success(null, 'Review reported. Thank you for the feedback.', 200, [], $request);
    }

    /**
     * Alias-path for the frontend: review eligibility for the current user.
     *
     * @param array<string,string> $params
     */
    public function reviewEligibility(Request $request, array $params): Response
    {
        return $this->success(
            $this->reviews->eligibility($this->auth($request), $this->intParam($params, 'id')),
            'Review eligibility retrieved successfully',
            200,
            [],
            $request,
        );
    }

    public function submitSupport(Request $request): Response
    {
        $data = CommerceValidator::supportMessage($request->body());
        $ticket = $this->support->submit($this->optionalAuth($request), $data, $request);

        return $this->created($ticket, 'Support request received', [], $request);
    }
}
