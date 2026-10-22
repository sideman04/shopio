<?php

declare(strict_types=1);

namespace Shopio\Exceptions;

/**
 * 404 — resource does not exist, or the caller must not know that it exists.
 */
final class NotFoundException extends HttpException
{
    public function __construct(string $message = 'Resource not found.', array $logContext = [])
    {
        parent::__construct(404, $message, [], $logContext);
    }
}
