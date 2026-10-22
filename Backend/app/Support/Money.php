<?php

declare(strict_types=1);

namespace Shopio\Support;

/**
 * Decimal money arithmetic.
 *
 * All monetary values in the schema are `DECIMAL(13,2)`. Floating point is
 * never used for money: values are handled as strings through BCMath so that
 * rounding is explicit and reproducible.
 */
final class Money
{
    public const SCALE = 2;

    /**
     * Adds two amounts and rounds half-up away from zero to {@see SCALE}
     * decimal places.
     */
    public static function add(string|int|float $a, string|int|float $b): string
    {
        return self::scale(bcadd(self::norm($a), self::norm($b), self::SCALE + 2));
    }

    public static function sub(string|int|float $a, string|int|float $b): string
    {
        return self::scale(bcsub(self::norm($a), self::norm($b), self::SCALE + 2));
    }

    public static function mul(string|int|float $a, string|int|float $b): string
    {
        return self::scale(bcmul(self::norm($a), self::norm($b), self::SCALE + 2));
    }

    /**
     * Divides and rounds half-up to {@see SCALE} decimal places.
     */
    public static function div(string|int|float $a, string|int|float $b): string
    {
        if (bccomp(self::norm($b), '0', self::SCALE + 4) === 0) {
            throw new \InvalidArgumentException('Division by zero in money calculation.');
        }

        return self::scale(bcdiv(self::norm($a), self::norm($b), self::SCALE + 4));
    }

    /**
     * Percentage of an amount, rounded half-up. `10.00` + `100.00` => `10.00`.
     */
    public static function percent(string|int|float $amount, string|int|float $rate): string
    {
        return self::div(self::mul($amount, $rate), '100');
    }

    public static function compare(string|int|float $a, string|int|float $b): int
    {
        return bccomp(self::norm($a), self::norm($b), self::SCALE);
    }

    public static function isZero(string|int|float $a): bool
    {
        return bccomp(self::norm($a), '0', self::SCALE) === 0;
    }

    public static function isNegative(string|int|float $a): bool
    {
        return bccomp(self::norm($a), '0', self::SCALE) < 0;
    }

    public static function min(string|int|float $a, string|int|float $b): string
    {
        return self::compare($a, $b) <= 0 ? self::scale(self::norm($a)) : self::scale(self::norm($b));
    }

    public static function max(string|int|float $a, string|int|float $b): string
    {
        return self::compare($a, $b) >= 0 ? self::scale(self::norm($a)) : self::scale(self::norm($b));
    }

    /**
     * @param list<string|int|float> $values
     */
    public static function sum(array $values): string
    {
        $total = '0';
        foreach ($values as $value) {
            $total = bcadd($total, self::norm($value), self::SCALE + 2);
        }

        return self::scale($total);
    }

    public static function format(string|int|float $value): string
    {
        return self::scale(self::norm($value));
    }

    /** Integer minor units (2 dp) — useful for comparisons in tests. */
    public static function toMinorUnits(string|int|float $value): int
    {
        return (int) bcadd(bcmul(self::norm($value), '100', 0), '0', 0);
    }

    /**
     * Rounds to {@see SCALE} decimals, half-up and away from zero.
     *
     * BCMath functions truncate; adding half of the last decimal unit (e.g.
     * `0.005` for 2 dp) before truncating implements half-up rounding. Negative
     * values are rounded on their magnitude so they round away from zero.
     */
    private static function scale(string $value): string
    {
        $negative = str_starts_with($value, '-');
        if ($negative) {
            $value = substr($value, 1);
        }

        $half = '0.' . str_repeat('0', self::SCALE) . '5';
        $rounded = bcadd($value, $half, self::SCALE);

        if ($negative && bccomp($rounded, '0', self::SCALE) !== 0) {
            return '-' . $rounded;
        }

        return $rounded;
    }

    private static function norm(string|int|float $value): string
    {
        if (is_float($value)) {
            // Guard against float artefacts such as 0.30000000000000004 reaching BCMath.
            $value = rtrim(rtrim(sprintf('%.8F', $value), '0'), '.');
            if ($value === '' || $value === '-') {
                $value = '0';
            }
        }

        return (string) $value;
    }
}
