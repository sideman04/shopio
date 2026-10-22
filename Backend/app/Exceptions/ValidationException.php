<?php

declare(strict_types=1);

namespace Shopio\Exceptions;

/**
 * 422 — request payload failed validation. `errors()` holds field => messages.
 */
final class ValidationException extends HttpException
{
    /**
     * @param array<string,list<string>> $errors
     */
    public function __construct(array $errors, string $message = 'The given data was invalid.')
    {
        parent::__construct(422, $message, $errors);
    }
}
