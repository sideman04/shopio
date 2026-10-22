<?php

declare(strict_types=1);

namespace Shopio\Payments;

use Shopio\Config\Config;
use Shopio\Exceptions\WebhookException;
use Shopio\Support\Str;

/**
 * Offline, deterministic provider used for local development and tests.
 *
 * It is *not* a stand-in for a real PSP: it performs no network calls. What it
 * does implement faithfully is the security boundary — webhooks must carry a
 * valid HMAC-SHA256 signature over the raw body and a fresh timestamp, so the
 * end-to-end verification path is exercised in tests.
 */
final class SandboxGateway implements GatewayInterface
{
    private const SIGNATURE_HEADER = 'x-shopio-signature';
    private const TIMESTAMP_HEADER = 'x-shopio-timestamp';

    public function name(): string
    {
        return 'sandbox';
    }

    public function createIntent(PaymentIntent $intent): PaymentResult
    {
        $reference = 'sbx_' . Str::randomToken(18);

        return new PaymentResult(
            status: 'pending',
            providerReference: $reference,
            paymentMethod: $intent->paymentMethod ?? 'sbx_card',
            clientSecret: 'sbx_secret_' . Str::randomToken(18),
            raw: ['provider' => 'sandbox', 'reference' => $reference],
        );
    }

    public function capture(string $providerReference, string $amount, string $currency): PaymentResult
    {
        if ($providerReference === '') {
            return new PaymentResult(
                status: 'failed',
                providerReference: null,
                failureCode: 'invalid_reference',
                failureMessage: 'Missing provider reference.',
            );
        }

        return new PaymentResult(
            status: 'succeeded',
            providerReference: $providerReference,
            paymentMethod: 'sbx_card',
            raw: ['provider' => 'sandbox', 'amount' => $amount, 'currency' => $currency],
        );
    }

    public function refund(string $providerReference, string $amount, string $currency, ?string $reason = null): RefundResult
    {
        return new RefundResult(
            status: 'succeeded',
            providerReference: 'sbxre_' . Str::randomToken(18),
            raw: ['provider' => 'sandbox', 'refunded' => $amount, 'currency' => $currency, 'reason' => $reason],
        );
    }

    public function parseWebhook(string $rawBody, array $headers): WebhookEvent
    {
        $secret = Config::get('PAYMENT_SANDBOX_SECRET', '') ?? '';
        if ($secret === '') {
            throw new WebhookException('The webhook could not be verified.', ['reason' => 'sbx_secret_missing']);
        }

        $signature = $headers[self::SIGNATURE_HEADER] ?? null;
        $timestamp = $headers[self::TIMESTAMP_HEADER] ?? null;

        if ($signature === null || $timestamp === null || !ctype_digit((string) $timestamp)) {
            throw new WebhookException('The webhook could not be verified.', ['reason' => 'signature_missing']);
        }

        $tolerance = Config::int('PAYMENT_WEBHOOK_TOLERANCE', 300);
        if (abs(time() - (int) $timestamp) > $tolerance) {
            throw new WebhookException('The webhook could not be verified.', ['reason' => 'timestamp_out_of_tolerance']);
        }

        $expected = hash_hmac('sha256', $timestamp . '.' . $rawBody, $secret);
        if (!hash_equals($expected, (string) $signature)) {
            throw new WebhookException('The webhook could not be verified.', ['reason' => 'signature_mismatch']);
        }

        $payload = json_decode($rawBody, true);
        if (!is_array($payload)) {
            throw new WebhookException('The webhook could not be verified.', ['reason' => 'invalid_json']);
        }

        $eventId = isset($payload['id']) ? (string) $payload['id'] : '';
        $type = isset($payload['type']) ? (string) $payload['type'] : '';
        if ($eventId === '' || $type === '') {
            throw new WebhookException('The webhook could not be verified.', ['reason' => 'missing_event_fields']);
        }

        $data = is_array($payload['data'] ?? null) ? $payload['data'] : [];

        return new WebhookEvent(
            provider: 'sandbox',
            eventId: $eventId,
            type: $type,
            payload: $payload,
            providerReference: isset($data['provider_reference']) ? (string) $data['provider_reference'] : null,
            orderNumber: isset($data['order_number']) ? (string) $data['order_number'] : null,
            amount: isset($data['amount']) ? (string) $data['amount'] : null,
        );
    }

    /**
     * Helper for tests/tools that need to produce a valid signature.
     */
    public static function sign(string $rawBody, int $timestamp, string $secret): string
    {
        return hash_hmac('sha256', $timestamp . '.' . $rawBody, $secret);
    }
}
