<?php

declare(strict_types=1);

namespace Shopio\Payments;

/**
 * Outcome of creating/capturing a payment at a provider.
 */
final class PaymentResult
{
    /**
     * @param array<string,mixed> $raw
     */
    public function __construct(
        public readonly string $status,
        public readonly ?string $providerReference,
        public readonly ?string $paymentMethod = null,
        public readonly ?string $failureCode = null,
        public readonly ?string $failureMessage = null,
        public readonly ?string $redirectUrl = null,
        public readonly ?string $clientSecret = null,
        public readonly array $raw = [],
    ) {
    }

    public function succeeded(): bool
    {
        return $this->status === 'succeeded';
    }

    public function pending(): bool
    {
        return in_array($this->status, ['initiated', 'pending'], true);
    }
}
