<?php

declare(strict_types=1);

namespace Shopio\Controllers;

use Shopio\Http\Request;
use Shopio\Http\Response;
use Shopio\Policies\OrderPolicy;
use Shopio\Repositories\GeoRepository;
use Shopio\Services\CheckoutService;
use Shopio\Services\OrderService;
use Shopio\Services\PaymentService;
use Shopio\Services\RefundService;
use Shopio\Validators\CommerceValidator;

/**
 * Customer orders: checkout, listing, detail, cancellation, refunds and payment
 * initiation. Every order read/mutation is scoped to the authenticated user.
 */
final class OrderController extends Controller
{
    public function __construct(
        private readonly OrderService $orders,
        private readonly CheckoutService $checkout,
        private readonly PaymentService $payments,
        private readonly RefundService $refunds,
    ) {
    }

    public function index(Request $request): Response
    {
        $result = $this->orders->listForUser(
            $this->auth($request),
            $this->orderFilters($request),
            $this->page($request),
            $this->perPage($request),
        );

        return $this->paginated($result['items'], $result['total'], $this->page($request), $this->perPage($request), 'Orders retrieved successfully', $request);
    }

    public function store(Request $request): Response
    {
        $data = CommerceValidator::checkout($request->body());
        $result = $this->checkout->checkout($this->auth($request), $data, $request);

        return $this->created($result, 'Order placed successfully', [], $request);
    }

    /**
     * @param array<string,string> $params
     */
    public function show(Request $request, array $params): Response
    {
        $order = $this->orders->detailForUser($this->auth($request), $this->intParam($params, 'id'));

        return $this->success($order, 'Order retrieved successfully', 200, [], $request);
    }

    /**
     * @param array<string,string> $params
     */
    public function cancel(Request $request, array $params): Response
    {
        $data = CommerceValidator::orderCancel($request->body());
        $order = $this->orders->cancelByCustomer(
            $this->auth($request),
            $this->intParam($params, 'id'),
            $data['reason'] ?? null,
            $request,
        );

        return $this->success($order, 'Order cancelled successfully', 200, [], $request);
    }

    /**
     * Starts a payment for an order owned by the caller.
     *
     * @param array<string,string> $params
     */
    public function pay(Request $request, array $params): Response
    {
        $auth = $this->auth($request);
        $orderId = $this->intParam($params, 'id');

        // Ownership assertion: initiate() itself is order-scoped, not user-scoped.
        $order = $this->orders->detailForUser($auth, $orderId);
        (new OrderPolicy($auth))->assertCustomerOwns(['user_id' => $order['userId'] ?? null]);

        $body = $request->body();
        $provider = trim((string) ($body['provider'] ?? ''));
        if ($provider === '') {
            $provider = (string) (\Shopio\Config\Config::get('PAYMENT_DEFAULT_PROVIDER', 'sandbox') ?? 'sandbox');
        }

        $method = isset($body['payment_method']) && is_string($body['payment_method']) ? $body['payment_method'] : null;
        $idempotencyKey = CommerceValidator::idempotencyKey($request->header('idempotency-key'));

        $payment = $this->payments->initiate($orderId, $provider, $method, $request, $idempotencyKey);

        return $this->created($payment, 'Payment initiated successfully', [], $request);
    }

    /**
     * @param array<string,string> $params
     */
    public function refunds(Request $request, array $params): Response
    {
        $orderId = $this->intParam($params, 'id');

        return $this->success($this->refunds->forOrder($this->auth($request), $orderId), 'Refunds retrieved successfully', 200, [], $request);
    }

    /**
     * @param array<string,string> $params
     */
    public function requestRefund(Request $request, array $params): Response
    {
        $data = CommerceValidator::refundRequest($request->body());
        $refund = $this->refunds->requestByCustomer($this->auth($request), $this->intParam($params, 'id'), $data, $request);

        return $this->created($refund, 'Refund requested successfully', [], $request);
    }

    /**
     * @return array<string,mixed>
     */
    private function orderFilters(Request $request): array
    {
        $filters = [];
        foreach (['status', 'payment_status', 'q'] as $key) {
            $value = $request->query($key);
            if (is_string($value) && $value !== '') {
                $filters[$key] = $value;
            }
        }

        return $filters;
    }
}
