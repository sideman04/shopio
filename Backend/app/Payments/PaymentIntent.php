<?php

declare(strict_types=1);

namespace Shopio\Payments;

/**
 * A requested payment for an order.
 *
 * All money is carried as a decimal string (never a float) so it can be handed
 * straight to BCMath and never loses precision in transit.
 */
final class PaymentIntent
{
    public function __construct(
        public readonly int $orderId,
        public readonly string $orderNumber,
        public readonly string $amount,
        public readonly string $currency,
        public readonly ?string $idempotencyKey = null,
        public readonly ?string $paymentMethod = null,
        public readonly ?string $customerEmail = null,
        /** @var array<string,mixed> */
        public readonly array $metadata = [],
    ) {
    }
}
