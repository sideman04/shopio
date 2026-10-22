<?php

declare(strict_types=1);

namespace Shopio\Exceptions;

/**
 * 403 — the caller is authenticated but not permitted to perform the action.
 */
final class AuthorizationException extends HttpException
{
    public function __construct(string $message = 'This action is unauthorized.', array $logContext = [])
    {
        parent::__construct(403, $message, [], $logContext);
    }
}
