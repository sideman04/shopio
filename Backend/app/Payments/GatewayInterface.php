<?php

declare(strict_types=1);

namespace Shopio\Payments;

/**
 * Contract every payment provider adapter must satisfy.
 *
 * Implementations are responsible for their own signature verification; the
 * application layer never trusts an unverified webhook.
 */
interface GatewayInterface
{
    public function name(): string;

    public function createIntent(PaymentIntent $intent): PaymentResult;

    public function capture(string $providerReference, string $amount, string $currency): PaymentResult;

    public function refund(string $providerReference, string $amount, string $currency, ?string $reason = null): RefundResult;

    /**
     * Verifies the signature/freshness and returns the normalised event, or
     * throws when verification fails.
     *
     * @param array<string,string> $headers
     */
    public function parseWebhook(string $rawBody, array $headers): WebhookEvent;
}
