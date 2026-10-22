<?php

declare(strict_types=1);

namespace Shopio\Exceptions;

/**
 * 429 — too many requests. `retryAfter` is exposed via the Retry-After header.
 */
final class RateLimitException extends HttpException
{
    public function __construct(
        private readonly int $retryAfter = 60,
        string $message = 'Too many requests. Please try again later.',
        array $logContext = [],
    ) {
        parent::__construct(429, $message, [], $logContext);
    }

    public function retryAfter(): int
    {
        return $this->retryAfter;
    }
}
