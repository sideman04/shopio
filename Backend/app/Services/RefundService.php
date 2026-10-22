<?php

declare(strict_types=1);

namespace Shopio\Services;

use Shopio\Auth\AuthenticatedUser;
use Shopio\Database\Database;
use Shopio\Exceptions\ConflictException;
use Shopio\Exceptions\NotFoundException;
use Shopio\Exceptions\ValidationException;
use Shopio\Http\Request;
use Shopio\Payments\GatewayRegistry;
use Shopio\Repositories\OrderRepository;
use Shopio\Repositories\PaymentRepository;
use Shopio\Repositories\RefundRepository;
use Shopio\Support\Money;
use Shopio\Support\Presenter;

/**
 * Refunds.
 *
 * Refund limits are enforced against the amount actually captured and already
 * refunded, inside a transaction with the payment row locked, so concurrent
 * approvals can never over-refund an order.
 */
final class RefundService
{
    public function __construct(
        private readonly Database $db,
        private readonly RefundRepository $refunds,
        private readonly PaymentRepository $payments,
        private readonly OrderRepository $orders,
        private readonly GatewayRegistry $gateways,
        private readonly AuditService $audit,
    ) {
    }

    /**
     * @return array<string,mixed>
     */
    public function requestByCustomer(AuthenticatedUser $auth, int $orderId, array $data, Request $request): array
    {
        $order = $this->orders->findByIdForUser($orderId, $auth->id);
        if ($order === null) {
            throw new NotFoundException('The requested order does not exist.');
        }

        $payment = $this->payments->latestSucceededForOrder($orderId);
        if ($payment === null) {
            throw new ConflictException('This order has no captured payment to refund.');
        }

        $amount = isset($data['amount'])
            ? Money::format((string) $data['amount'])
            : $this->refundableAmount($orderId);

        if (Money::isZero($amount)) {
            throw new ConflictException('This order has no remaining refundable balance.');
        }

        $refundId = $this->createWithinLimit($orderId, (int) $payment['id'], $auth->id, $amount, (string) $data['reason']);
        $this->audit->record($auth, 'refund.requested', 'refund', $refundId, $request, ['order_id' => $orderId]);

        return Presenter::refund($this->refunds->findById($refundId) ?? []);
    }

    /**
     * @return array<string,mixed>
     */
    public function decide(AuthenticatedUser $auth, int $refundId, array $data, Request $request): array
    {
        $decision = (string) $data['status'];

        $refund = $this->db->transaction(function () use ($auth, $refundId, $decision, $data, $request): array {
            $refund = $this->refunds->lockById($refundId);
            if ($refund === null) {
                throw new NotFoundException('The requested refund does not exist.');
            }

            if (!in_array($refund['status'], ['requested', 'approved', 'processing'], true)) {
                throw new ConflictException('This refund has already been finalised.');
            }

            if ($decision === 'rejected') {
                $this->refunds->updateStatus($refundId, 'rejected', $auth->id);
                $this->audit->record($auth, 'refund.rejected', 'refund', $refundId, $request, ['note' => $data['note'] ?? null]);

                return $this->refunds->findById($refundId) ?? $refund;
            }

            $payment = $this->payments->findById((int) $refund['payment_id']);
            if ($payment === null || $payment['status'] !== 'succeeded') {
                throw new ConflictException('The associated payment is not in a refundable state.');
            }

            $reference = $payment['provider_reference'] !== null ? (string) $payment['provider_reference'] : '';
            $gateway = $this->gateways->resolve((string) $payment['provider']);
            $result = $gateway->refund($reference, (string) $refund['amount'], (string) $payment['currency'], $refund['reason'] !== null ? (string) $refund['reason'] : null);

            if (!$result->succeeded()) {
                $this->refunds->updateStatus($refundId, 'failed', $auth->id, $result->providerReference);
                throw new ConflictException('The provider rejected the refund.');
            }

            $this->refunds->updateStatus($refundId, 'succeeded', $auth->id, $result->providerReference);
            $this->reconcileOrderRefundState((int) $refund['order_id']);
            $this->audit->record($auth, 'refund.succeeded', 'refund', $refundId, $request, ['note' => $data['note'] ?? null]);

            return $this->refunds->findById($refundId) ?? $refund;
        });

        $this->audit->record($auth, 'refund.decided', 'refund', $refundId, $request, ['status' => $decision]);

        return Presenter::refund($refund);
    }

    /**
     * @return array{items:list<array<string,mixed>>,total:int}
     */
    public function listForAdmin(array $filters, int $page, int $perPage): array
    {
        $result = $this->refunds->paginateForAdmin($filters, $page, $perPage);

        return ['items' => array_map([Presenter::class, 'refund'], $result['rows']), 'total' => $result['total']];
    }

    /**
     * @return list<array<string,mixed>>
     */
    public function forOrder(AuthenticatedUser $auth, int $orderId): array
    {
        $order = $this->orders->findByIdForUser($orderId, $auth->id);
        if ($order === null) {
            throw new NotFoundException('The requested order does not exist.');
        }

        return array_map([Presenter::class, 'refund'], $this->refunds->forOrder($orderId));
    }

    public function refundableAmount(int $orderId): string
    {
        $captured = $this->payments->succeededTotal($orderId);
        $already = $this->orders->refundedTotal($orderId);
        $remaining = Money::sub($captured, $already);

        return Money::isNegative($remaining) ? '0.00' : $remaining;
    }

    private function createWithinLimit(int $orderId, int $paymentId, ?int $requestedBy, string $amount, string $reason): int
    {
        return $this->db->transaction(function () use ($orderId, $paymentId, $requestedBy, $amount, $reason): int {
            $payment = $this->payments->lockById($paymentId);
            if ($payment === null || $payment['status'] !== 'succeeded') {
                throw new ConflictException('The associated payment is not in a refundable state.');
            }

            $refundable = $this->refundableAmount($orderId);
            if (Money::compare($amount, $refundable) > 0) {
                throw new ValidationException([
                    'amount' => ['The refund amount exceeds the refundable balance of ' . $refundable . '.'],
                ]);
            }

            return $this->refunds->create($paymentId, $orderId, $requestedBy, $amount, $reason);
        });
    }

    private function reconcileOrderRefundState(int $orderId): void
    {
        $captured = $this->payments->succeededTotal($orderId);
        $refunded = $this->orders->refundedTotal($orderId);

        if (Money::compare($refunded, '0') <= 0) {
            return;
        }

        $fullyRefunded = Money::compare($refunded, $captured) >= 0;
        $this->orders->setPaymentStatus($orderId, $fullyRefunded ? 'refunded' : 'partially_refunded');

        if ($fullyRefunded) {
            $this->orders->setStatus($orderId, 'refunded');
        }
    }
}
