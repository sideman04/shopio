<?php

declare(strict_types=1);

namespace Shopio\Payments;

/**
 * A verified, normalised provider webhook.
 *
 * `eventId` is the provider's unique event identifier and is the deduplication
 * key for replay protection. `type` is normalised across providers.
 */
final class WebhookEvent
{
    /**
     * @param array<string,mixed> $payload
     */
    public function __construct(
        public readonly string $provider,
        public readonly string $eventId,
        public readonly string $type,
        public readonly array $payload,
        public readonly ?string $providerReference = null,
        public readonly ?string $orderNumber = null,
        public readonly ?string $amount = null,
    ) {
    }
}
