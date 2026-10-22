<?php

declare(strict_types=1);

namespace Shopio\Exceptions;

/**
 * 409 — the request conflicts with current resource state (e.g. idempotency
 * replay with different payload, illegal business state transition).
 */
final class ConflictException extends HttpException
{
    public function __construct(string $message = 'The request conflicts with the current state.', array $errors = [], array $logContext = [])
    {
        parent::__construct(409, $message, $errors, $logContext);
    }
}
