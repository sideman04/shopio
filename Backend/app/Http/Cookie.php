<?php

declare(strict_types=1);

namespace Shopio\Http;

use Shopio\Config\Config;

/**
 * Secure cookie factory. Session cookies are always HttpOnly; the CSRF cookie
 * must be readable by the SPA (double-submit pattern), so it is not HttpOnly but
 * is scoped tightly and never contains an authentication secret.
 */
final class Cookie
{
    public static function session(string $name, string $value, int $ttl): string
    {
        return self::build($name, $value, $ttl, httpOnly: true);
    }

    public static function csrf(string $name, string $value, int $ttl): string
    {
        return self::build($name, $value, $ttl, httpOnly: false);
    }

    public static function forget(string $name): string
    {
        return self::build($name, '', -31536000, httpOnly: true);
    }

    private static function build(string $name, string $value, int $ttl, bool $httpOnly): string
    {
        $secure = Config::bool('SESSION_SECURE_COOKIE', true);
        $sameSite = self::normaliseSameSite(Config::get('SESSION_SAMESITE', 'Lax'));
        $path = Config::get('SESSION_COOKIE_PATH', '/') ?? '/';
        $domain = Config::get('SESSION_COOKIE_DOMAIN', '') ?? '';

        $parts = [
            rawurlencode($name) . '=' . rawurlencode($value),
            'Path=' . ($path === '' ? '/' : $path),
            'Max-Age=' . $ttl,
            'SameSite=' . $sameSite,
        ];

        if ($domain !== '') {
            $parts[] = 'Domain=' . $domain;
        }

        if ($secure) {
            $parts[] = 'Secure';
        }

        if ($httpOnly) {
            $parts[] = 'HttpOnly';
        }

        return implode('; ', $parts);
    }

    private static function normaliseSameSite(string $value): string
    {
        $normalised = ucfirst(strtolower($value));

        return in_array($normalised, ['Strict', 'Lax', 'None'], true) ? $normalised : 'Lax';
    }
}
