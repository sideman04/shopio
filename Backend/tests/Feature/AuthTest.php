<?php

declare(strict_types=1);

namespace Shopio\Tests\Feature;

use Shopio\Repositories\UserRepository;
use Shopio\Services\TokenService;
use Shopio\Tests\Support\Commerce;
use Shopio\Tests\Support\Factory;
use Shopio\Tests\Support\TestApplication;
use Shopio\Tests\TestCase;

/**
 * Authentication: registration, login, session lifecycle, password reset and the
 * anti-enumeration / mass-assignment guarantees around them.
 */
final class AuthTest extends TestCase
{
    use Commerce;

    public function test_registration_creates_a_customer_and_starts_a_session(): void
    {
        $email = Factory::uniqueEmail();

        $response = $this->postJson('/api/v1/auth/register', [
            'full_name' => 'Jane Buyer',
            'email' => $email,
            'password' => Factory::PASSWORD,
            'password_confirmation' => Factory::PASSWORD,
            'accept_terms' => 1,
        ]);

        $this->assertStatus(201, $response);
        $this->assertTrue($response->success());

        $data = $response->dataArray();
        $this->assertSame($email, $data['user']['email'] ?? null);
        $this->assertSame(['customer'], $data['user']['roles'] ?? null);
        $this->assertFalse((bool) ($data['verificationRequired'] ?? true));
        $this->assertNotSame('', (string) ($data['token'] ?? ''));

        // The session cookie must be HttpOnly and the CSRF cookie must be readable.
        $sessionCookie = $response->setCookies();
        $this->assertNotEmpty($sessionCookie);
        $joined = strtolower(implode("\n", $sessionCookie));
        $this->assertStringContainsString('httponly', $joined);
        $this->assertNotNull($response->cookie('shopio_csrf'));
    }

    public function test_registration_cannot_grant_admin_or_other_roles(): void
    {
        $response = $this->postJson('/api/v1/auth/register', [
            'full_name' => 'Sneaky User',
            'email' => Factory::uniqueEmail(),
            'password' => Factory::PASSWORD,
            'password_confirmation' => Factory::PASSWORD,
            'accept_terms' => 1,
            // Mass-assignment attempts — must be ignored entirely.
            'roles' => ['admin'],
            'role' => 'admin',
            'status' => 'active',
            'id' => 1,
            'email_verified_at' => '2000-01-01 00:00:00',
        ]);

        $this->assertStatus(201, $response);
        $this->assertSame(['customer'], $response->dataArray()['user']['roles'] ?? null);
    }

    public function test_registration_rejects_duplicate_email(): void
    {
        $existing = Factory::user();

        $response = $this->postJson('/api/v1/auth/register', [
            'full_name' => 'Copy Cat',
            'email' => $existing['email'],
            'password' => Factory::PASSWORD,
            'password_confirmation' => Factory::PASSWORD,
            'accept_terms' => 1,
        ]);

        $this->assertStatus(409, $response);
        $this->assertFalse($response->success());
    }

    public function test_registration_rejects_weak_password_and_missing_terms(): void
    {
        $response = $this->postJson('/api/v1/auth/register', [
            'full_name' => 'Weak Pass',
            'email' => Factory::uniqueEmail(),
            'password' => 'short',
            'password_confirmation' => 'short',
        ]);

        $this->assertStatus(422, $response);
        $this->assertNotNull($response->error('password'));
        $this->assertNotNull($response->error('accept_terms'));
    }

    public function test_login_succeeds_with_correct_credentials(): void
    {
        $user = Factory::user();

        $response = $this->postJson('/api/v1/auth/login', [
            'email' => $user['email'],
            'password' => Factory::PASSWORD,
        ]);

        $this->assertStatus(200, $response);
        $this->assertSame($user['email'], $response->dataArray()['user']['email'] ?? null);
        $this->assertNotSame('', (string) ($response->dataArray()['token'] ?? ''));
    }

    public function test_login_failures_are_generic_and_do_not_enumerate_accounts(): void
    {
        $user = Factory::user();

        $wrongPassword = $this->postJson('/api/v1/auth/login', [
            'email' => $user['email'],
            'password' => 'WrongPassword123',
        ]);

        $unknownAccount = $this->postJson('/api/v1/auth/login', [
            'email' => Factory::uniqueEmail(),
            'password' => 'WrongPassword123',
        ]);

        $this->assertStatus(401, $wrongPassword);
        $this->assertStatus(401, $unknownAccount);
        $this->assertSame($wrongPassword->message(), $unknownAccount->message());

        foreach ([$wrongPassword, $unknownAccount] as $response) {
            $body = strtolower($response->body());
            $this->assertStringNotContainsString('password_hash', $body);
            $this->assertStringNotContainsString('sql', $body);
        }
    }

    public function test_suspended_account_cannot_sign_in(): void
    {
        $user = Factory::user(['status' => 'suspended']);

        $response = $this->postJson('/api/v1/auth/login', [
            'email' => $user['email'],
            'password' => Factory::PASSWORD,
        ]);

        $this->assertStatus(403, $response);
    }

    public function test_repeated_failed_logins_trigger_lockout(): void
    {
        $user = Factory::user();

        for ($i = 0; $i < 8; $i++) {
            $this->postJson('/api/v1/auth/login', [
                'email' => $user['email'],
                'password' => 'DefinitelyWrong123',
            ]);
        }

        $response = $this->postJson('/api/v1/auth/login', [
            'email' => $user['email'],
            'password' => 'DefinitelyWrong123',
        ]);

        $this->assertStatus(429, $response);
        $this->assertNotNull($response->header('Retry-After'));
    }

    public function test_me_requires_authentication(): void
    {
        $this->assertStatus(401, $this->get('/api/v1/auth/me'));
        $this->assertStatus(401, $this->get('/api/v1/auth/me', [], ['authorization' => 'Bearer not-a-real-token']));
    }

    public function test_me_returns_the_authenticated_principal(): void
    {
        $user = Factory::user();

        $response = $this->get('/api/v1/auth/me', [], $this->bearer($user));

        $this->assertStatus(200, $response);
        $this->assertSame($user['email'], $response->dataArray()['email'] ?? null);
    }

    public function test_logout_revokes_the_session(): void
    {
        $user = Factory::user();
        $headers = $this->bearer($user);

        $this->assertStatus(200, $this->postJson('/api/v1/auth/logout', [], $headers));
        $this->assertStatus(401, $this->get('/api/v1/auth/me', [], $headers));
    }

    public function test_cookie_session_requires_csrf_for_writes(): void
    {
        $user = Factory::user();
        $session = TestApplication::make(\Shopio\Services\SessionService::class)->start((int) $user['id'], '127.0.0.1', 'phpunit');

        $cookies = [
            'shopio_session' => (string) $session['token'],
            'shopio_csrf' => (string) $session['csrf_token'],
        ];

        // Cookie-authenticated write WITHOUT the CSRF header must be rejected.
        $withoutCsrf = $this->request('POST', '/api/v1/cart/items', [
            'json' => ['variant_id' => 1],
            'cookies' => $cookies,
        ]);
        $this->assertStatus(401, $withoutCsrf);

        // With the double-submit header it progresses past CSRF (fails later on
        // the missing variant, proving the request itself is accepted).
        $withCsrf = $this->request('POST', '/api/v1/cart/items', [
            'json' => ['variant_id' => 999999],
            'cookies' => $cookies,
            'headers' => ['x-csrf-token' => (string) $session['csrf_token']],
        ]);
        $this->assertStatus(404, $withCsrf);
    }

    public function test_password_reset_token_is_single_use_and_rotates_password(): void
    {
        $user = Factory::user();
        $tokens = TestApplication::make(TokenService::class);

        $raw = $tokens->issue((int) $user['id'], 'password_reset', 3600);

        $first = $this->postJson('/api/v1/auth/reset-password', [
            'token' => $raw,
            'password' => 'BrandNewPass123',
            'password_confirmation' => 'BrandNewPass123',
        ]);
        $this->assertStatus(200, $first);

        // Replaying the same token must fail: consume() is single-use.
        $second = $this->postJson('/api/v1/auth/reset-password', [
            'token' => $raw,
            'password' => 'AnotherPass123',
            'password_confirmation' => 'AnotherPass123',
        ]);
        $this->assertStatus(422, $second);

        // The new password works and the old one no longer does.
        $this->assertStatus(200, $this->postJson('/api/v1/auth/login', [
            'email' => $user['email'],
            'password' => 'BrandNewPass123',
        ]));
        $this->assertStatus(401, $this->postJson('/api/v1/auth/login', [
            'email' => $user['email'],
            'password' => Factory::PASSWORD,
        ]));
    }

    public function test_forgot_password_response_is_generic(): void
    {
        $known = Factory::user();

        $forKnown = $this->postJson('/api/v1/auth/forgot-password', ['email' => $known['email']]);
        $forUnknown = $this->postJson('/api/v1/auth/forgot-password', ['email' => Factory::uniqueEmail()]);

        $this->assertStatus(200, $forKnown);
        $this->assertStatus(200, $forUnknown);
        $this->assertSame($forKnown->message(), $forUnknown->message());
    }

    public function test_change_password_requires_the_current_password(): void
    {
        $user = Factory::user();
        $headers = $this->bearer($user);

        $wrong = $this->postJson('/api/v1/auth/change-password', [
            'current_password' => 'NotThePassword123',
            'password' => 'BrandNewPass123',
            'password_confirmation' => 'BrandNewPass123',
        ], $headers);
        $this->assertStatus(422, $wrong);

        $correct = $this->postJson('/api/v1/auth/change-password', [
            'current_password' => Factory::PASSWORD,
            'password' => 'BrandNewPass123',
            'password_confirmation' => 'BrandNewPass123',
        ], $headers);
        $this->assertStatus(200, $correct);
    }

    public function test_email_verification_consumes_the_token_once(): void
    {
        $user = Factory::user(['email_verified_at' => null]);
        $tokens = TestApplication::make(TokenService::class);
        $raw = $tokens->issue((int) $user['id'], 'email_verify', 3600);

        $this->assertStatus(200, $this->postJson('/api/v1/auth/verify-email', ['token' => $raw]));

        $replay = $this->postJson('/api/v1/auth/verify-email', ['token' => $raw]);
        $this->assertStatus(422, $replay);

        $this->assertNotNull(TestApplication::make(UserRepository::class)->findById((int) $user['id'])['email_verified_at'] ?? null);
    }
}
