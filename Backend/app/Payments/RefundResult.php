<?php

declare(strict_types=1);

namespace Shopio\Payments;

/**
 * Outcome of a refund request at a provider.
 */
final class RefundResult
{
    /**
     * @param array<string,mixed> $raw
     */
    public function __construct(
        public readonly string $status,
        public readonly string $providerReference,
        public readonly ?string $failureCode = null,
        public readonly ?string $failureMessage = null,
        public readonly array $raw = [],
    ) {
    }

    public function succeeded(): bool
    {
        return $this->status === 'succeeded';
    }
}
