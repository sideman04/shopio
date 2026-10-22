<?php

declare(strict_types=1);

namespace Shopio\Support;

use Shopio\Exceptions\ValidationException;

/**
 * String helpers: slugs, identifiers, token generation, phone normalisation.
 */
final class Str
{
    /**
     * URL-safe slug. Deterministic for a given input and locale.
     */
    public static function slug(string $value): string
    {
        $value = trim($value);
        if (function_exists('iconv')) {
            $converted = @iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $value);
            if ($converted !== false) {
                $value = $converted;
            }
        }

        $value = strtolower($value);
        $value = preg_replace('/[^a-z0-9]+/', '-', $value) ?? '';

        return trim($value, '-');
    }

    /**
     * Cryptographically strong opaque token (URL-safe, 43 chars / 256 bits).
     */
    public static function randomToken(int $bytes = 32): string
    {
        return rtrim(strtr(base64_encode(random_bytes($bytes)), '+/', '-_'), '=');
    }

    /**
     * SHA-256 hash used for at-rest storage of opaque tokens.
     */
    public static function hashToken(string $token): string
    {
        return hash('sha256', $token);
    }

    public static function constantTimeEquals(string $a, string $b): bool
    {
        return hash_equals($a, $b);
    }

    public static function uuidV4(): string
    {
        $bytes = random_bytes(16);
        $bytes[6] = chr((ord($bytes[6]) & 0x0f) | 0x40);
        $bytes[8] = chr((ord($bytes[8]) & 0x3f) | 0x80);

        return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($bytes), 4));
    }

    public static function maskEmail(string $email): string
    {
        $at = strpos($email, '@');
        if ($at === false || $at === 0) {
            return '***';
        }

        $local = substr($email, 0, $at);
        $domain = substr($email, $at);
        $visible = substr($local, 0, 1);

        return $visible . str_repeat('*', max(1, strlen($local) - 1)) . $domain;
    }

    /**
     * Normalises a Tanzanian/regional phone number to E.164-ish `+` form.
     *
     * Preserves a leading `+` or `00` international prefix and rejects other
     * characters so that the value stored is always canonical.
     */
    public static function normalisePhone(?string $phone): ?string
    {
        if ($phone === null) {
            return null;
        }

        $phone = trim($phone);
        if ($phone === '') {
            return null;
        }

        $hasPlus = str_starts_with($phone, '+');
        $digits = preg_replace('/\D+/', '', $phone) ?? '';
        if ($digits === '') {
            return null;
        }

        // 00 international prefix becomes +.
        if (!$hasPlus && str_starts_with($digits, '00')) {
            $digits = substr($digits, 2);
            $hasPlus = true;
        }

        // Local Tanzanian 0XXXXXXXXX form.
        if (!$hasPlus && strlen($digits) === 10 && str_starts_with($digits, '0')) {
            return '+255' . substr($digits, 1);
        }

        if (!$hasPlus && strlen($digits) === 9) {
            return '+255' . $digits;
        }

        return '+' . $digits;
    }

    /**
     * Case-insensitive envelope key normalisation for emails.
     */
    public static function normaliseEmail(string $email): string
    {
        return strtolower(trim($email));
    }

    /**
     * Truncates for safe inclusion in logs/notes.
     */
    public static function limit(string $value, int $max): string
    {
        if (mb_strlen($value) <= $max) {
            return $value;
        }

        return mb_substr($value, 0, $max - 3) . '...';
    }

    /**
     * Numeric-only string check used by validators.
     */
    public static function isNumericString(mixed $value): bool
    {
        return is_string($value) && $value !== '' && preg_match('/^-?\d+(\.\d+)?$/', $value) === 1;
    }

    /**
     * Rejects control characters and null bytes — used for free-text inputs and
     * for anything destined for a filesystem path or header value.
     */
    public static function assertSafeText(string $value, string $field): string
    {
        if (preg_match('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/', $value) === 1) {
            throw new ValidationException([$field => ['Contains invalid control characters.']]);
        }

        return $value;
    }
}
