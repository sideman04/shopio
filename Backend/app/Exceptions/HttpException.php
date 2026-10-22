<?php

declare(strict_types=1);

namespace Shopio\Exceptions;

/**
 * Base class for all exceptions that map to an HTTP response.
 *
 * `$message` is safe to show to clients; internal detail belongs in `$logContext`.
 */
class HttpException extends \RuntimeException
{
    /**
     * @param array<string,mixed> $errors
     * @param array<string,mixed> $logContext
     */
    public function __construct(
        private readonly int $statusCode,
        string $message,
        private readonly array $errors = [],
        private readonly array $logContext = [],
        ?\Throwable $previous = null,
    ) {
        parent::__construct($message, 0, $previous);
    }

    public function statusCode(): int
    {
        return $this->statusCode;
    }

    /**
     * @return array<string,mixed>
     */
    public function errors(): array
    {
        return $this->errors;
    }

    /**
     * @return array<string,mixed>
     */
    public function logContext(): array
    {
        return $this->logContext;
    }
}
