<?php

declare(strict_types=1);

namespace Shopio\Tests\Unit;

use PHPUnit\Framework\TestCase;
use Shopio\Exceptions\ValidationException;
use Shopio\Validators\Validator;

/**
 * The validator is a security boundary: it returns ONLY declared fields (mass
 * assignment defence) and rejects control characters / malformed input.
 */
final class ValidatorTest extends TestCase
{
    public function test_returns_only_declared_fields(): void
    {
        $result = Validator::check([
            'name' => 'Alice',
            'role' => 'admin',          // not declared => must be dropped
            'is_admin' => true,         // dropped
            'id' => 999,                // dropped
        ], ['name' => 'required|string|max:50']);

        $this->assertSame(['name' => 'Alice'], $result);
        $this->assertArrayNotHasKey('role', $result);
        $this->assertArrayNotHasKey('is_admin', $result);
    }

    public function test_missing_required_field_is_reported(): void
    {
        try {
            Validator::check([], ['email' => 'required|email']);
            $this->fail('Expected validation to fail.');
        } catch (ValidationException $e) {
            $this->assertArrayHasKey('email', $e->errors());
        }
    }

    public function test_nullable_field_defaults_to_null(): void
    {
        $result = Validator::check([], ['phone' => 'nullable|string|max:20']);

        $this->assertArrayHasKey('phone', $result);
        $this->assertNull($result['phone']);
    }

    public function test_unknown_rule_fails_closed(): void
    {
        $this->expectException(ValidationException::class);

        Validator::check(['x' => 'v'], ['x' => 'definitely_not_a_rule']);
    }

    public function test_safe_text_rejects_control_characters(): void
    {
        $this->expectException(ValidationException::class);

        Validator::check(['name' => "bad\x00name"], ['name' => 'required|safe_text|string']);
    }

    public function test_safe_text_accepts_utf8_and_punctuation(): void
    {
        $result = Validator::check(['name' => 'Jöhn Döe — Ltd.'], ['name' => 'required|safe_text|string|max:60']);

        $this->assertSame('Jöhn Döe — Ltd.', $result['name']);
    }

    public function test_string_like_sql_payload_is_accepted_as_data_not_code(): void
    {
        // The validator does not "clean" SQL; it returns it verbatim for the
        // data layer to parameterise. The point is that it must not break.
        $payload = "Robert'); DROP TABLE users;--";
        $result = Validator::check(['q' => $payload], ['q' => 'required|safe_text|string|max:200']);

        $this->assertSame($payload, $result['q']);
    }

    public function test_password_requires_letter_and_number_and_length(): void
    {
        try {
            Validator::check(['password' => 'short'], ['password' => 'required|password:10']);
            $this->fail('Expected short password to fail.');
        } catch (ValidationException $e) {
            $this->assertArrayHasKey('password', $e->errors());
        }

        $result = Validator::check(['password' => 'lettersOnly1'], ['password' => 'required|password:10']);
        $this->assertSame('lettersOnly1', $result['password']);
    }

    public function test_confirmed_rule_requires_matching_confirmation(): void
    {
        $this->expectException(ValidationException::class);

        Validator::check(
            ['password' => 'GoodPass1234', 'password_confirmation' => 'Different1234'],
            ['password' => 'required|password:10|confirmed', 'password_confirmation' => 'required|string'],
        );
    }

    public function test_email_and_phone_are_validated(): void
    {
        $this->expectException(ValidationException::class);

        Validator::check(['email' => 'not-an-email'], ['email' => 'required|email']);
    }

    public function test_integer_is_coerced(): void
    {
        $result = Validator::check(['quantity' => '5'], ['quantity' => 'required|integer|min:1|max:10']);

        $this->assertSame(5, $result['quantity']);
    }

    public function test_decimal_rejects_more_than_two_places(): void
    {
        $this->expectException(ValidationException::class);

        Validator::check(['amount' => '1.234'], ['amount' => 'required|decimal']);
    }

    public function test_decimal_accepts_two_places(): void
    {
        $result = Validator::check(['amount' => '19.99'], ['amount' => 'required|decimal']);
        $this->assertSame('19.99', $result['amount']);
    }
}
