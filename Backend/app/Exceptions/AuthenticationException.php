<?php

declare(strict_types=1);

namespace Shopio\Exceptions;

/**
 * 401 — the request lacks valid authentication credentials.
 */
final class AuthenticationException extends HttpException
{
    public function __construct(string $message = 'Unauthenticated.', array $logContext = [])
    {
        parent::__construct(401, $message, [], $logContext);
    }
}
