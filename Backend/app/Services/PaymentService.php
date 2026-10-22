<?php

declare(strict_types=1);

namespace Shopio\Services;

use Shopio\Config\Config;
use Shopio\Database\Database;
use Shopio\Exceptions\ConflictException;
use Shopio\Exceptions\NotFoundException;
use Shopio\Exceptions\PaymentException;
use Shopio\Http\Request;
use Shopio\Payments\GatewayRegistry;
use Shopio\Payments\PaymentIntent;
use Shopio\Payments\WebhookEvent;
use Shopio\Repositories\OrderRepository;
use Shopio\Repositories\PaymentRepository;
use Shopio\Repositories\WebhookEventRepository;
use Shopio\Support\Logger;
use Shopio\Support\Money;
use Shopio\Support\Presenter;

/**
 * Payment lifecycle and provider webhooks.
 *
 * The only trusted signal that money changed hands is a signature-verified
 * provider webhook (or an explicit capture against the provider). A client can
 * request a payment, but cannot declare one successful.
 */
final class PaymentService
{
    public function __construct(
        private readonly Database $db,
        private readonly PaymentRepository $payments,
        private readonly OrderRepository $orders,
        private readonly GatewayRegistry $gateways,
        private readonly WebhookEventRepository $webhooks,
        private readonly OrderService $orderService,
        private readonly NotificationService $notifications,
        private readonly AuditService $audit,
    ) {
    }

    /**
     * @return array<string,mixed>
     */
    public function initiate(int $orderId, string $provider, ?string $paymentMethod, Request $request, ?string $idempotencyKey = null): array
    {
        $order = $this->orders->findById($orderId);
        if ($order === null) {
            throw new NotFoundException('The requested order does not exist.');
        }

        if ($order['payment_status'] === 'paid') {
            throw new ConflictException('This order has already been paid.');
        }

        $totals = $this->orders->totals($orderId);
        $amount = (string) ($totals['grand_total'] ?? '0.00');
        if (Money::compare($amount, '0') <= 0) {
            throw new PaymentException('The order total is not payable.');
        }

        if ($idempotencyKey !== null) {
            $existing = $this->payments->findByIdempotencyKey($idempotencyKey);
            if ($existing !== null) {
                return Presenter::payment($existing);
            }
        }

        $gateway = $this->gateways->resolve($provider);

        $result = $gateway->createIntent(new PaymentIntent(
            orderId: $orderId,
            orderNumber: (string) $order['order_number'],
            amount: $amount,
            currency: (string) $order['currency'],
            idempotencyKey: $idempotencyKey,
            paymentMethod: $paymentMethod,
            customerEmail: (string) $order['customer_email'],
        ));

        $paymentId = $this->payments->create(
            $orderId,
            $gateway->name(),
            $amount,
            (string) $order['currency'],
            $result->pending() ? 'pending' : ($result->succeeded() ? 'succeeded' : 'failed'),
            $idempotencyKey,
            $result->providerReference,
            $result->paymentMethod,
            $result->raw,
        );

        $this->orders->setPaymentStatus($orderId, $result->succeeded() ? 'paid' : 'pending');
        $this->audit->record(null, 'payment.initiated', 'payment', $paymentId, $request, ['provider' => $gateway->name()]);

        $payment = $this->payments->findById($paymentId) ?? [];

        return Presenter::payment($payment + [
            'client_secret' => $result->clientSecret,
            'redirect_url' => $result->redirectUrl,
        ]);
    }

    /**
     * Verifies and records a provider webhook, then applies it.
     *
     * @param array<string,string> $headers
     * @return array<string,mixed>
     */
    public function handleWebhook(string $provider, string $rawBody, array $headers, Request $request): array
    {
        $gateway = $this->gateways->resolve($provider);

        // Throws (400) when the signature or timestamp is invalid.
        $event = $gateway->parseWebhook($rawBody, $headers);

        $record = $this->webhooks->record($gateway->name(), $event->eventId, $event->type, $rawBody, true);
        if ($record['duplicate']) {
            return ['status' => 'duplicate', 'event_id' => $event->eventId];
        }

        $recordId = (int) $record['id'];

        try {
            $status = $this->apply($event, $request);
            $this->webhooks->markProcessed($recordId, $status);
        } catch (\Throwable $e) {
            $this->webhooks->markProcessed($recordId, 'failed', $e->getMessage());
            Logger::instance()->error('webhook_processing_failed', [
                'provider' => $gateway->name(),
                'event_id' => $event->eventId,
                'type' => $event->type,
            ]);
            throw $e;
        }

        return ['status' => $status, 'event_id' => $event->eventId];
    }

    /**
     * @return string The terminal processing status.
     */
    private function apply(WebhookEvent $event, Request $request): string
    {
        return match ($event->type) {
            'payment.succeeded' => $this->onPaymentSucceeded($event, $request),
            'payment.failed' => $this->onPaymentFailed($event),
            'refund.succeeded' => $this->onRefundSucceeded($event),
            'refund.failed' => $this->onRefundFailed($event),
            default => 'ignored',
        };
    }

    private function onPaymentSucceeded(WebhookEvent $event, Request $request): string
    {
        return $this->db->transaction(function () use ($event, $request): string {
            $payment = $this->resolvePayment($event);
            if ($payment === null) {
                throw new NotFoundException('Unknown payment reference.');
            }

            if ($payment['status'] === 'succeeded') {
                return 'already_processed';
            }

            $orderId = (int) $payment['order_id'];
            $order = $this->orders->lockById($orderId);
            if ($order === null) {
                throw new NotFoundException('Unknown order for payment.');
            }

            $this->payments->markSucceeded(
                (int) $payment['id'],
                $event->providerReference ?? ($payment['provider_reference'] !== null ? (string) $payment['provider_reference'] : null),
                (string) ($payment['payment_method'] ?? 'unknown'),
                $event->payload,
            );

            $this->orders->setPaymentStatus($orderId, 'paid');
            if ($order['status'] === 'pending') {
                $this->orders->markConfirmed($orderId);
                $this->orders->addHistory($orderId, null, 'pending', 'confirmed', 'Payment received');
            }

            // Convert the stock hold into a real sale.
            $this->orderService->settleHolds($orderId);

            $this->notifications->notify(
                (int) $order['user_id'],
                'order',
                'Payment received',
                'We have received your payment for order ' . $order['order_number'] . '.',
                '/account/orders/' . $orderId,
            );

            $this->audit->record(null, 'payment.succeeded', 'payment', (int) $payment['id'], $request, ['order_id' => $orderId]);

            return 'processed';
        });
    }

    private function onPaymentFailed(WebhookEvent $event): string
    {
        $payment = $this->resolvePayment($event);
        if ($payment === null) {
            throw new NotFoundException('Unknown payment reference.');
        }

        $this->payments->markFailed(
            (int) $payment['id'],
            isset($event->payload['data']['failure_code']) ? (string) $event->payload['data']['failure_code'] : 'provider_failed',
            isset($event->payload['data']['failure_message']) ? (string) $event->payload['data']['failure_message'] : 'Payment failed.',
            $event->payload,
        );
        $this->orders->setPaymentStatus((int) $payment['order_id'], 'failed');

        return 'processed';
    }

    private function onRefundSucceeded(WebhookEvent $event): string
    {
        $refund = $this->db->selectOne(
            'SELECT id, order_id, amount FROM refunds WHERE provider_reference = :ref LIMIT 1',
            ['ref' => $event->providerReference],
        );

        if ($refund === null) {
            throw new NotFoundException('Unknown refund reference.');
        }

        $this->db->execute(
            "UPDATE refunds SET status = 'succeeded', processed_at = UTC_TIMESTAMP() WHERE id = :id",
            ['id' => (int) $refund['id']],
        );

        return 'processed';
    }

    private function onRefundFailed(WebhookEvent $event): string
    {
        $refund = $this->db->selectOne(
            'SELECT id FROM refunds WHERE provider_reference = :ref LIMIT 1',
            ['ref' => $event->providerReference],
        );

        if ($refund === null) {
            throw new NotFoundException('Unknown refund reference.');
        }

        $this->db->execute("UPDATE refunds SET status = 'failed', processed_at = UTC_TIMESTAMP() WHERE id = :id", ['id' => (int) $refund['id']]);

        return 'processed';
    }

    /**
     * @return array<string,mixed>|null
     */
    private function resolvePayment(WebhookEvent $event): ?array
    {
        if ($event->providerReference !== null) {
            return $this->payments->findByProviderReference($event->provider, $event->providerReference);
        }

        if ($event->orderNumber !== null) {
            $order = $this->orders->findByNumber($event->orderNumber);

            return $order === null ? null : $this->payments->latestForOrder((int) $order['id']);
        }

        return null;
    }
}
