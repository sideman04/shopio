<?php

declare(strict_types=1);

namespace Shopio\Services;

use Shopio\Auth\AuthenticatedUser;
use Shopio\Config\Config;
use Shopio\Database\Database;
use Shopio\Exceptions\AuthenticationException;
use Shopio\Exceptions\AuthorizationException;
use Shopio\Exceptions\ConflictException;
use Shopio\Exceptions\ValidationException;
use Shopio\Http\Cookie;
use Shopio\Http\Request;
use Shopio\Repositories\RoleRepository;
use Shopio\Repositories\SellerRepository;
use Shopio\Repositories\UserRepository;
use Shopio\Services\Mail\MailService;
use Shopio\Support\Money;
use Shopio\Support\Presenter;
use Shopio\Support\Str;

/**
 * Authentication: registration, login, logout, email/phone verification,
 * password reset and session resolution.
 *
 * Design decisions (see README "Authentication model"):
 *  - Server-managed opaque sessions. The raw token is only ever placed in an
 *    HttpOnly cookie and/or returned to API clients as a bearer token; only its
 *    SHA-256 hash is stored.
 *  - Login and password-reset responses are deliberately generic and constant
 *    time-ish so they cannot be used to enumerate accounts.
 *  - Public registration can only ever grant `customer` (optionally `seller`).
 *    `admin` is never assignable through registration — only a trusted seeder or
 *    an existing administrator can provision it.
 */
final class AuthService
{
    public function __construct(
        private readonly Database $db,
        private readonly UserRepository $users,
        private readonly RoleRepository $roles,
        private readonly SellerRepository $sellers,
        private readonly SessionService $sessions,
        private readonly TokenService $tokens,
        private readonly PasswordHasher $hasher,
        private readonly RateLimiter $limiter,
        private readonly MailService $mail,
        private readonly AuditService $audit,
        private readonly NotificationService $notifications,
    ) {
    }

    /**
     * @param array<string,mixed> $data
     * @return array{user:array<string,mixed>,session:array<string,mixed>|null,verification_required:bool}
     */
    public function register(array $data, Request $request): array
    {
        $email = Str::normaliseEmail((string) $data['email']);
        $phone = Str::normalisePhone($data['phone'] ?? null);

        $this->limiter->consume('auth:register:ip', $request->clientIp(), 10, 3600, 3600);

        if ($this->users->emailExists($email)) {
            // Registration unavoidably reveals that an email is taken; we keep the
            // message generic and do not confirm any other account detail.
            throw new ConflictException('An account with this email address already exists.');
        }

        if ($phone !== null && $this->users->phoneExists($phone)) {
            throw new ConflictException('An account with this phone number already exists.');
        }

        $wantsSeller = !empty($data['store_name']);
        $requireVerification = Config::bool('AUTH_REQUIRE_EMAIL_VERIFICATION', true);

        $user = $this->db->transaction(function () use ($data, $email, $phone, $wantsSeller, $requireVerification): array {
            $userId = $this->users->create([
                'full_name' => (string) $data['full_name'],
                'email' => $email,
                'phone' => $phone,
                'password_hash' => $this->hasher->hash((string) $data['password']),
                'status' => $requireVerification ? 'pending' : 'active',
                'email_verified_at' => $requireVerification ? null : gmdate('Y-m-d H:i:s'),
            ]);

            $roleIds = $this->roles->idsByCodes(['customer']);
            if ($wantsSeller) {
                $roleIds += $this->roles->idsByCodes(['seller']);
            }

            foreach ($roleIds as $roleId) {
                $this->users->assignRole($userId, $roleId);
            }

            if ($wantsSeller) {
                $slug = $this->uniqueStoreSlug((string) $data['store_name']);
                $this->sellers->create(
                    $userId,
                    (string) $data['store_name'],
                    $slug,
                    null,
                    isset($data['business_category']) ? (string) $data['business_category'] : null,
                    Money::format(Config::get('DEFAULT_COMMISSION_RATE', '10.00') ?? '10.00'),
                );
            }

            return $this->users->findById($userId) ?? [];
        });

        $userId = (int) $user['id'];

        if ($requireVerification) {
            $token = $this->tokens->issue($userId, 'email_verify', Config::int('EMAIL_VERIFY_TTL', 86400));
            $this->mail->sendEmailVerification($email, (string) $user['full_name'], $token);
        }

        $this->notifications->notify(
            $userId,
            'account',
            'Welcome to Shopio',
            'Your account has been created. Complete your profile to get started.',
            '/account/profile',
        );

        $this->audit->record(null, 'auth.register', 'user', $userId, $request, ['seller' => $wantsSeller]);

        $session = $requireVerification ? null : $this->startSession($userId, $request);

        return [
            'user' => $this->presentUser($userId),
            'session' => $session,
            'verification_required' => $requireVerification,
        ];
    }

    /**
     * @param array<string,mixed> $data
     * @return array{user:array<string,mixed>,session:array<string,mixed>}
     */
    public function login(array $data, Request $request): array
    {
        $email = Str::normaliseEmail((string) $data['email']);
        $password = (string) $data['password'];
        $ip = $request->clientIp();

        // Per-IP throttling plus account/IP failure lockout with progressive delay.
        $this->limiter->consume('auth:login:ip', $ip, 30, 300, 300, 'Too many sign-in attempts. Please try again later.');
        $this->limiter->assertLoginAllowed($email, $ip);

        $user = $this->users->findByEmail($email);

        if ($user === null || ($user['deleted_at'] ?? null) !== null) {
            // Equalise work vs. a real account and return the same generic error.
            $this->hasher->verifyDummy($password);
            $this->limiter->recordLoginFailure($email, $ip);

            throw new AuthenticationException('Invalid email address or password.');
        }

        if (!$this->hasher->verify($password, (string) $user['password_hash'])) {
            $this->limiter->recordLoginFailure($email, $ip);

            throw new AuthenticationException('Invalid email address or password.');
        }

        if ($user['status'] === 'suspended' || $user['status'] === 'disabled') {
            $this->limiter->recordLoginFailure($email, $ip);

            throw new AuthorizationException('This account is not active. Please contact support.');
        }

        if ($user['status'] === 'pending'
            && Config::bool('AUTH_REQUIRE_EMAIL_VERIFICATION', true)
            && ($user['email_verified_at'] ?? null) === null) {
            // Credentials were correct, so telling the owner to verify is safe.
            throw new AuthorizationException('Please verify your email address before signing in.');
        }

        // Opportunistically upgrade the stored hash to the configured algorithm.
        if ($this->hasher->needsRehash((string) $user['password_hash'])) {
            $this->users->updatePassword((int) $user['id'], $this->hasher->hash($password));
        }

        $this->users->touchLastLogin((int) $user['id']);
        $this->limiter->recordLoginSuccess($email, $ip);

        $session = $this->startSession((int) $user['id'], $request);

        $this->audit->record(
            new AuthenticatedUser(
                (int) $user['id'],
                $user,
                $this->users->roleCodes((int) $user['id']),
                null,
                $session['session_id'],
                $session['via'],
                null,
            ),
            'auth.login',
            'user',
            (int) $user['id'],
            $request,
        );

        return ['user' => $this->presentUser((int) $user['id']), 'session' => $session];
    }

    public function logout(AuthenticatedUser $auth, Request $request): void
    {
        $this->sessions->revoke($auth->sessionId, 'logout');
        $this->audit->record($auth, 'auth.logout', 'user', $auth->id, $request);
    }

    /**
     * Always returns a generic result so the endpoint cannot enumerate accounts.
     *
     * @param array<string,mixed> $data
     */
    public function requestPasswordReset(array $data, Request $request): void
    {
        $email = Str::normaliseEmail((string) $data['email']);
        $ip = $request->clientIp();

        $this->limiter->consume('auth:password-reset:ip', $ip, 5, 3600, 1800,
            'Too many password reset requests. Please try again later.');
        $this->limiter->consume('auth:password-reset:email', $email, 3, 3600, 1800,
            'Too many password reset requests. Please try again later.');

        $user = $this->users->findByEmail($email);
        if ($user === null || ($user['deleted_at'] ?? null) !== null) {
            // Perform equivalent work and return success without revealing anything.
            usleep(random_int(120_000, 260_000));

            return;
        }

        $token = $this->tokens->issue((int) $user['id'], 'password_reset', Config::int('PASSWORD_RESET_TTL', 3600));
        $this->mail->sendPasswordReset($email, (string) $user['full_name'], $token);

        $this->audit->record(null, 'auth.password_reset_requested', 'user', (int) $user['id'], $request);
    }

    /**
     * Consumes a single-use reset token, rotates the password and revokes all
     * existing sessions for the account.
     *
     * @param array<string,mixed> $data
     */
    public function resetPassword(array $data, Request $request): void
    {
        $this->limiter->consume('auth:password-reset-confirm:ip', $request->clientIp(), 10, 3600, 1800,
            'Too many attempts. Please try again later.');

        $userId = $this->tokens->consume('password_reset', (string) $data['token']);
        if ($userId === null) {
            throw new ValidationException([
                'token' => ['This password reset link is invalid or has expired.'],
            ]);
        }

        $user = $this->users->findById($userId);
        if ($user === null || ($user['deleted_at'] ?? null) !== null) {
            throw new ValidationException(['token' => ['This password reset link is invalid or has expired.']]);
        }

        $this->db->transaction(function () use ($userId, $data): void {
            $this->users->updatePassword($userId, $this->hasher->hash((string) $data['password']));
            // Prevent reuse of any other outstanding reset token.
            $this->tokens->invalidatePurpose($userId, 'password_reset');
            // Force re-authentication everywhere; a reset invalidates sessions.
            $this->sessions->revokeAll($userId, 'password_reset');
        });

        $this->notifications->notify(
            $userId,
            'security',
            'Your password was changed',
            'Your Shopio password was reset. If this was not you, contact support immediately.',
            '/account/security',
        );

        $this->audit->record(null, 'auth.password_reset_completed', 'user', $userId, $request);
    }

    /**
     * @param array<string,mixed> $data
     * @return array<string,mixed>
     */
    public function verifyEmail(array $data, Request $request): array
    {
        $userId = $this->tokens->consume('email_verify', (string) $data['token']);
        if ($userId === null) {
            throw new ValidationException([
                'token' => ['This verification link is invalid or has expired.'],
            ]);
        }

        $this->users->markEmailVerified($userId);
        $this->audit->record(null, 'auth.email_verified', 'user', $userId, $request);

        return $this->presentUser($userId);
    }

    /**
     * @param array<string,mixed> $data
     */
    public function resendVerification(array $data, Request $request): void
    {
        $email = Str::normaliseEmail((string) $data['email']);
        $this->limiter->consume('auth:resend-verification:ip', $request->clientIp(), 5, 3600, 1800,
            'Too many requests. Please try again later.');

        $user = $this->users->findByEmail($email);
        if ($user === null || ($user['email_verified_at'] ?? null) !== null || ($user['deleted_at'] ?? null) !== null) {
            usleep(random_int(80_000, 160_000));

            return;
        }

        $token = $this->tokens->issue((int) $user['id'], 'email_verify', Config::int('EMAIL_VERIFY_TTL', 86400));
        $this->mail->sendEmailVerification($email, (string) $user['full_name'], $token);
    }

    /**
     * @param array<string,mixed> $data
     */
    public function changePassword(AuthenticatedUser $auth, array $data, Request $request): void
    {
        $user = $this->users->findById($auth->id);
        if ($user === null) {
            throw new AuthenticationException();
        }

        if (!$this->hasher->verify((string) $data['current_password'], (string) $user['password_hash'])) {
            $this->limiter->consume('auth:change-password:user', (string) $auth->id, 5, 3600, 900,
                'Too many attempts. Please try again later.');

            throw new ValidationException([
                'current_password' => ['Your current password is incorrect.'],
            ]);
        }

        $this->db->transaction(function () use ($auth, $data, $request): void {
            $this->users->updatePassword($auth->id, $this->hasher->hash((string) $data['password']));
            $this->tokens->invalidatePurpose($auth->id, 'password_reset');
            // Keep the current session (the user is actively using it) but drop the rest.
            $this->sessions->revokeAll($auth->id, 'password_changed', $auth->sessionId);
            $this->audit->record($auth, 'auth.password_changed', 'user', $auth->id, $request);
        });

        $this->notifications->notify(
            $auth->id,
            'security',
            'Password changed',
            'Your password was updated. Other devices have been signed out.',
            '/account/security',
        );
    }

    /**
     * @param array<string,mixed> $data
     */
    public function requestPhoneVerification(AuthenticatedUser $auth, array $data, Request $request): void
    {
        $phone = Str::normalisePhone((string) $data['phone']);
        if ($phone === null) {
            throw new ValidationException(['phone' => ['A valid phone number is required.']]);
        }

        $this->limiter->consume('auth:phone-verify:user', (string) $auth->id, 5, 3600, 900,
            'Too many verification requests. Please try again later.');

        $pending = $this->users->findById($auth->id);
        if ($pending === null) {
            throw new AuthenticationException();
        }

        $code = (string) random_int(100000, 999999);

        // Store the pending phone (so verification applies to a server-held
        // value, not a client-supplied one) and issue exactly one code token.
        $this->db->transaction(function () use ($auth, $phone, $code): void {
            $this->tokens->invalidatePurpose($auth->id, 'phone_verify');
            $this->users->updateProfile($auth->id, ['phone' => $phone]);
            $this->issuePhoneCode($auth->id, $code);
        });

        $this->mail->sendPhoneVerificationCode($phone, $code);
        $this->audit->record($auth, 'auth.phone_verification_requested', 'user', $auth->id, $request);
    }

    /**
     * @param array<string,mixed> $data
     */
    public function verifyPhone(AuthenticatedUser $auth, array $data, Request $request): void
    {
        $this->limiter->consume('auth:phone-verify-confirm:user', (string) $auth->id, 10, 3600, 900,
            'Too many attempts. Please try again later.');

        $userId = $this->tokens->consume('phone_verify', (string) $data['code']);
        if ($userId === null || $userId !== $auth->id) {
            throw new ValidationException(['code' => ['This verification code is invalid or has expired.']]);
        }

        $user = $this->users->findById($auth->id);
        if ($user === null || $user['phone'] === null) {
            throw new ValidationException(['code' => ['No phone number is pending verification.']]);
        }

        $this->users->markPhoneVerified($auth->id, (string) $user['phone']);
        $this->audit->record($auth, 'auth.phone_verified', 'user', $auth->id, $request);
    }

    public function me(AuthenticatedUser $auth): array
    {
        return $this->presentUser($auth->id);
    }

    /**
     * Resolves the authenticated principal for the current request.
     */
    public function resolve(Request $request): ?AuthenticatedUser
    {
        $token = $request->bearerToken();
        $via = 'bearer';

        if ($token === null) {
            $token = $request->cookie(Config::get('SESSION_COOKIE_NAME', 'shopio_session') ?? 'shopio_session');
            $via = 'cookie';
        }

        if ($token === null || $token === '') {
            return null;
        }

        $session = $this->sessions->resolve($token);
        if ($session === null) {
            return null;
        }

        $user = $this->users->findById((int) $session['user_id']);
        if ($user === null || ($user['deleted_at'] ?? null) !== null) {
            $this->sessions->revoke((int) $session['id'], 'user_missing');

            return null;
        }

        if ($user['status'] === 'suspended' || $user['status'] === 'disabled') {
            $this->sessions->revoke((int) $session['id'], 'account_inactive');

            throw new AuthorizationException('This account is not active. Please contact support.');
        }

        $roles = $this->users->roleCodes((int) $user['id']);
        $sellerId = null;
        if (in_array('seller', $roles, true)) {
            $seller = $this->sellers->findByUserId((int) $user['id']);
            $sellerId = $seller === null ? null : (int) $seller['id'];
        }

        $this->sessions->touch((int) $session['id']);

        return new AuthenticatedUser(
            (int) $user['id'],
            $user,
            $roles,
            $sellerId,
            (int) $session['id'],
            $via,
            $session['csrf_hash'] === null ? null : (string) $session['csrf_hash'],
        );
    }

    /**
     * @return array{token:string,csrf_token:string,session_id:int,expires_at:string,via:string}
     */
    private function startSession(int $userId, Request $request): array
    {
        $session = $this->sessions->start($userId, $request->clientIp(), $request->userAgent());

        return $session + ['via' => $request->bearerToken() !== null ? 'bearer' : 'cookie'];
    }

    private function issuePhoneCode(int $userId, string $code): void
    {
        // Reuse TokenService's storage semantics with the numeric code as the token.
        $this->db->execute(
            'INSERT INTO auth_tokens (user_id, token_hash, purpose, expires_at)
             VALUES (:user_id, :hash, \'phone_verify\', :expires_at)',
            [
                'user_id' => $userId,
                'hash' => Str::hashToken($code),
                'expires_at' => gmdate('Y-m-d H:i:s', time() + Config::int('PHONE_VERIFY_TTL', 600)),
            ],
        );
    }

    /**
     * @return array<string,mixed>
     */
    private function presentUser(int $userId): array
    {
        $user = $this->users->findById($userId);
        if ($user === null) {
            throw new AuthenticationException();
        }

        $roles = $this->users->roleCodes($userId);
        $sellerId = null;
        if (in_array('seller', $roles, true)) {
            $seller = $this->sellers->findByUserId($userId);
            $sellerId = $seller === null ? null : (int) $seller['id'];
        }

        return Presenter::user($user, $roles, $sellerId);
    }

    private function uniqueStoreSlug(string $storeName): string
    {
        $base = Str::slug($storeName) ?: 'store';
        $slug = $base;
        $attempt = 0;

        while ($this->sellers->slugExists($slug)) {
            $attempt++;
            $slug = $base . '-' . strtolower(bin2hex(random_bytes(3)));
            if ($attempt > 10) {
                $slug = $base . '-' . time();
                break;
            }
        }

        return $slug;
    }

    /**
     * Builds the `Set-Cookie` values for a freshly created session. The raw
     * token goes in an HttpOnly cookie; the CSRF token is readable by the SPA so
     * it can echo it back in the `X-CSRF-Token` header (double-submit).
     *
     * @param array<string,mixed> $session
     * @return list<string>
     */
    public function sessionCookies(array $session): array
    {
        if ($session === [] || !isset($session['token'])) {
            return [];
        }

        $ttl = max(300, Config::int('SESSION_TTL', 7200));

        return [
            Cookie::session(
                Config::get('SESSION_COOKIE_NAME', 'shopio_session') ?? 'shopio_session',
                (string) $session['token'],
                $ttl,
            ),
            Cookie::csrf(
                Config::get('CSRF_COOKIE_NAME', 'shopio_csrf') ?? 'shopio_csrf',
                (string) $session['csrf_token'],
                $ttl,
            ),
        ];
    }

    /**
     * @return list<string>
     */
    public function forgetCookies(): array
    {
        return [
            Cookie::forget(Config::get('SESSION_COOKIE_NAME', 'shopio_session') ?? 'shopio_session'),
            Cookie::forget(Config::get('CSRF_COOKIE_NAME', 'shopio_csrf') ?? 'shopio_csrf'),
        ];
    }
}
