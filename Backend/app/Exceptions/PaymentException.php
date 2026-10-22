<?php

declare(strict_types=1);

namespace Shopio\Exceptions;

/**
 * 422 — a payment could not be initiated/captured/refunded as requested
 * (declined, unsupported provider, amount mismatch).
 */
final class PaymentException extends HttpException
{
    public function __construct(string $message = 'The payment could not be processed.', array $errors = [], array $logContext = [])
    {
        parent::__construct(422, $message, $errors, $logContext);
    }
}
