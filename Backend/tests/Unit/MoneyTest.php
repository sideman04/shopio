<?php

declare(strict_types=1);

namespace Shopio\Tests\Unit;

use PHPUnit\Framework\TestCase;
use Shopio\Support\Money;

/**
 * Money is the backbone of every total, commission and refund. These tests pin
 * the arithmetic and the "never use floats" contract.
 */
final class MoneyTest extends TestCase
{
    public function test_add_and_sub_are_exact(): void
    {
        $this->assertSame('0.30', Money::add('0.10', '0.20'));
        $this->assertSame('0.10', Money::sub('0.30', '0.20'));
        $this->assertSame('10.00', Money::add('9.99', '0.01'));
    }

    public function test_multiply_scales_correctly(): void
    {
        $this->assertSame('30.00', Money::mul('10.00', 3));
        $this->assertSame('0.03', Money::mul('0.01', 3));
        $this->assertSame('19.99', Money::mul('9.995', 2));
    }

    public function test_percent_is_rounded_half_up(): void
    {
        $this->assertSame('10.00', Money::percent('100.00', '10.00'));
        $this->assertSame('1.50', Money::percent('15.00', '10.00'));
        // 333.33 * 7.5% = 24.99975 => 25.00
        $this->assertSame('25.00', Money::percent('333.33', '7.5'));
    }

    public function test_division_rounds_to_two_places(): void
    {
        $this->assertSame('3.33', Money::div('10.00', '3'));
        $this->assertSame('0.33', Money::div('1.00', '3'));
    }

    public function test_division_by_zero_is_rejected(): void
    {
        $this->expectException(\InvalidArgumentException::class);

        Money::div('10.00', '0');
    }

    public function test_compare_is_scale_aware(): void
    {
        $this->assertSame(0, Money::compare('1.0', '1.00'));
        $this->assertSame(1, Money::compare('1.01', '1.00'));
        $this->assertSame(-1, Money::compare('0.99', '1.00'));
    }

    public function test_float_input_is_normalised_without_artefacts(): void
    {
        // 0.1 + 0.2 === 0.30000000000000004 in IEEE-754; Money must not leak it.
        $this->assertSame('0.30', Money::add(0.1, 0.2));
    }

    public function test_minor_units_conversion(): void
    {
        $this->assertSame(1999, Money::toMinorUnits('19.99'));
        $this->assertSame(0, Money::toMinorUnits('0.00'));
    }

    public function test_zero_and_negative_detection(): void
    {
        $this->assertTrue(Money::isZero('0.00'));
        $this->assertFalse(Money::isZero('0.01'));
        $this->assertTrue(Money::isNegative('-1.00'));
        $this->assertFalse(Money::isNegative('1.00'));
    }

    public function test_sum_of_many_values_is_exact(): void
    {
        $this->assertSame('1.00', Money::sum(['0.10', '0.20', '0.30', '0.40']));
    }
}
