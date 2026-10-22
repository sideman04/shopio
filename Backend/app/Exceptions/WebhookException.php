<?php

declare(strict_types=1);

namespace Shopio\Exceptions;

/**
 * 400 — an inbound webhook failed signature or freshness verification.
 *
 * The body is deliberately opaque so a probing caller learns nothing about why
 * verification failed.
 */
final class WebhookException extends HttpException
{
    public function __construct(string $message = 'The webhook could not be verified.', array $logContext = [])
    {
        parent::__construct(400, $message, [], $logContext);
    }
}
