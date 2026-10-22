<?php

declare(strict_types=1);

namespace Shopio\Controllers;

use Shopio\Auth\AuthenticatedUser;
use Shopio\Http\Request;
use Shopio\Http\Response;
use Shopio\Policies\SellerPolicy;
use Shopio\Services\OrderService;
use Shopio\Services\PayoutService;
use Shopio\Services\ReviewService;
use Shopio\Services\SellerService;
use Shopio\Validators\CommerceValidator;
use Shopio\Validators\SellerValidator;

/**
 * Seller workspace: store profile, onboarding, dashboard, analytics, order
 * fulfilment, payouts and review replies.
 */
final class SellerController extends Controller
{
    public function __construct(
        private readonly SellerService $sellers,
        private readonly OrderService $orders,
        private readonly PayoutService $payouts,
        private readonly ReviewService $reviews,
    ) {
    }

    public function register(Request $request): Response
    {
        $data = SellerValidator::register($request->body());
        $store = $this->sellers->register($this->auth($request), $data, $request);

        return $this->created($store, 'Store application submitted successfully', [], $request);
    }

    public function store(Request $request): Response
    {
        return $this->success($this->sellers->store($this->seller($request)), 'Store retrieved successfully', 200, [], $request);
    }

    public function updateStore(Request $request): Response
    {
        $data = SellerValidator::profileUpdate($request->body());
        $store = $this->sellers->updateStore($this->seller($request), $data, $request);

        return $this->success($store, 'Store updated successfully', 200, [], $request);
    }

    public function dashboard(Request $request): Response
    {
        return $this->success($this->sellers->dashboard($this->seller($request)), 'Dashboard retrieved successfully', 200, [], $request);
    }

    public function analytics(Request $request): Response
    {
        $days = (int) $request->query('days', 30);

        return $this->success($this->sellers->analytics($this->seller($request), $days), 'Analytics retrieved successfully', 200, [], $request);
    }

    public function orders(Request $request): Response
    {
        $result = $this->orders->listForSeller(
            $this->seller($request),
            $this->filters($request, ['status', 'fulfillment_status', 'q']),
            $this->page($request),
            $this->perPage($request),
        );

        return $this->paginated($result['items'], $result['total'], $this->page($request), $this->perPage($request), 'Orders retrieved successfully', $request);
    }

    /**
     * @param array<string,string> $params
     */
    public function order(Request $request, array $params): Response
    {
        return $this->success($this->orders->detailForSeller($this->seller($request), $this->intParam($params, 'id')), 'Order retrieved successfully', 200, [], $request);
    }

    /**
     * @param array<string,string> $params
     */
    public function fulfillItem(Request $request, array $params): Response
    {
        $data = SellerValidator::fulfillmentUpdate($request->body() + ['item_id' => $this->intParam($params, 'itemId')]);
        $order = $this->orders->updateItemFulfillment(
            $this->seller($request),
            $this->intParam($params, 'id'),
            (int) $data['item_id'],
            $data,
            $request,
        );

        return $this->success($order, 'Fulfilment updated successfully', 200, [], $request);
    }

    public function payoutSummary(Request $request): Response
    {
        return $this->success($this->payouts->summary($this->seller($request)), 'Payout summary retrieved successfully', 200, [], $request);
    }

    public function payouts(Request $request): Response
    {
        $result = $this->payouts->listForSeller($this->seller($request), $this->page($request), $this->perPage($request));

        return $this->paginated($result['items'], $result['total'], $this->page($request), $this->perPage($request), 'Payouts retrieved successfully', $request);
    }

    public function requestPayout(Request $request): Response
    {
        $data = SellerValidator::payoutRequest($request->body());
        $payout = $this->payouts->request($this->seller($request), $data, $request);

        return $this->created($payout, 'Payout requested successfully', [], $request);
    }

    public function reviews(Request $request): Response
    {
        $result = $this->reviews->listForSeller(
            $this->seller($request),
            $this->filters($request, ['status', 'rating', 'q']),
            $this->page($request),
            $this->perPage($request),
        );

        return $this->paginated($result['items'], $result['total'], $this->page($request), $this->perPage($request), 'Reviews retrieved successfully', $request);
    }

    /**
     * @param array<string,string> $params
     */
    public function replyToReview(Request $request, array $params): Response
    {
        $data = CommerceValidator::reviewReply($request->body());
        $review = $this->reviews->replyAsSeller($this->seller($request), $this->intParam($params, 'id'), $data, $request);

        return $this->success($review, 'Reply posted successfully', 200, [], $request);
    }

    /**
     * Policy gate: these endpoints are seller-only.
     */
    private function seller(Request $request): AuthenticatedUser
    {
        $auth = $this->auth($request);
        (new SellerPolicy($auth))->assertSeller();

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
