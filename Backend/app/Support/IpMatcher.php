<?php

declare(strict_types=1);

namespace Shopio\Support;

/**
 * IP / CIDR matching used for trusted-proxy handling.
 */
final class IpMatcher
{
    public static function matches(string $ip, string $rule): bool
    {
        $rule = trim($rule);
        if ($rule === '') {
            return false;
        }

        if (!str_contains($rule, '/')) {
            return self::normalise($ip) === self::normalise($rule);
        }

        [$subnet, $bits] = explode('/', $rule, 2);
        if (!is_numeric($bits)) {
            return false;
        }

        $ipBin = @inet_pton($ip);
        $subnetBin = @inet_pton($subnet);
        if ($ipBin === false || $subnetBin === false || strlen($ipBin) !== strlen($subnetBin)) {
            return false;
        }

        $bits = (int) $bits;
        $maxBits = strlen($ipBin) * 8;
        if ($bits < 0 || $bits > $maxBits) {
            return false;
        }

        $wholeBytes = intdiv($bits, 8);
        $remaining = $bits % 8;

        if ($wholeBytes > 0 && substr($ipBin, 0, $wholeBytes) !== substr($subnetBin, 0, $wholeBytes)) {
            return false;
        }

        if ($remaining === 0) {
            return true;
        }

        $mask = 0xFF << (8 - $remaining) & 0xFF;

        return (ord($ipBin[$wholeBytes]) & $mask) === (ord($subnetBin[$wholeBytes]) & $mask);
    }

    /**
     * @param list<string> $rules
     */
    public static function matchesAny(string $ip, array $rules): bool
    {
        foreach ($rules as $rule) {
            if (self::matches($ip, $rule)) {
                return true;
            }
        }

        return false;
    }

    public static function isPrivate(string $ip): bool
    {
        return filter_var(
            $ip,
            FILTER_VALIDATE_IP,
            FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE,
        ) === false;
    }

    private static function normalise(string $ip): string
    {
        $packed = @inet_pton($ip);
        if ($packed === false) {
            return strtolower($ip);
        }

        $canonical = @inet_ntop($packed);

        return $canonical === false ? strtolower($ip) : $canonical;
    }
}
