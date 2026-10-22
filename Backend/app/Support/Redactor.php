<?php

declare(strict_types=1);

namespace Shopio\Support;

/**
 * Recursively removes sensitive values from log context.
 *
 * Defence in depth: application code should also avoid putting secrets in log
 * context, but this guarantees passwords, tokens and card data cannot leak into
 * log files through an accidental `$logger->info(..., $request->all())`.
 */
final class Redactor
{
    /**
     * Keys are matched case-insensitively as substrings.
     *
     * @var list<string>
     */
    private const SENSITIVE_KEYS = [
        'password',
        'password_hash',
        'password_confirmation',
        'current_password',
        'new_password',
        'token',
        'token_hash',
        'access_token',
        'refresh_token',
        'reset_token',
        'csrf',
        'secret',
        'authorization',
        'cookie',
        'session',
        'session_id',
        'api_key',
        'card',
        'card_number',
        'cvv',
        'cvc',
        'pan',
        'signature',
        'webhook_secret',
        'private_key',
    ];

    private const MASK = '[REDACTED]';

    /**
     * @param array<string,mixed> $context
     * @return array<string,mixed>
     */
    public static function clean(array $context): array
    {
        $clean = [];
        foreach ($context as $key => $value) {
            $clean[$key] = self::cleanValue((string) $key, $value);
        }

        return $clean;
    }

    private static function cleanValue(string $key, mixed $value): mixed
    {
        if (self::isSensitive($key)) {
            return self::MASK;
        }

        if (is_array($value)) {
            $clean = [];
            foreach ($value as $innerKey => $innerValue) {
                $clean[$innerKey] = self::cleanValue((string) $innerKey, $innerValue);
            }

            return $clean;
        }

        return $value;
    }

    private static function isSensitive(string $key): bool
    {
        $needle = strtolower($key);
        foreach (self::SENSITIVE_KEYS as $sensitive) {
            if (str_contains($needle, $sensitive)) {
                return true;
            }
        }

        return false;
    }
}
