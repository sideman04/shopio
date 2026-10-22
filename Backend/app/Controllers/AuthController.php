<?php

declare(strict_types=1);

namespace Shopio\Controllers;

use Shopio\Http\Request;
use Shopio\Http\Response;
use Shopio\Services\AuthService;
use Shopio\Validators\AuthValidator;
use Shopio\Validators\Validator;

/**
 * Authentication endpoints.
 *
 * A successful login/registration establishes a server-managed session. The raw
 * session token is returned in the JSON body (for bearer clients) and, when the
 * caller is a browser, also set as an HttpOnly cookie. A CSRF token accompanies
 * cookie sessions for the double-submit check on later writes.
 */
final class AuthController extends Controller
{
    public function __construct(private readonly AuthService $auth)
    {
    }

    public function register(Request $request): Response
    {
        $data = AuthValidator::register($request->body());
        $result = $this->auth->register($data, $request);

        $payload = [
            'user' => $result['user'],
            'verificationRequired' => (bool) $result['verification_required'],
        ];

        $cookies = [];
        if (is_array($result['session'])) {
            $payload += $this->sessionPayload($result['session']);
            $cookies = $this->auth->sessionCookies($result['session']);
        }

        return $this->withCookies(
            $this->created($payload, 'Account created successfully', [], $request),
            $cookies,
        );
    }

    public function login(Request $request): Response
    {
        $data = AuthValidator::login($request->body());
        $result = $this->auth->login($data, $request);

        $payload = ['user' => $result['user']] + $this->sessionPayload($result['session']);

        return $this->withCookies(
            $this->success($payload, 'Signed in successfully', 200, [], $request),
            $this->auth->sessionCookies($result['session']),
        );
    }

    public function logout(Request $request): Response
    {
        $this->auth->logout($this->auth($request), $request);

        return $this->withCookies(
            $this->success(null, 'Signed out successfully', 200, [], $request),
            $this->auth->forgetCookies(),
        );
    }

    public function me(Request $request): Response
    {
        return $this->success($this->auth->me($this->auth($request)), 'Profile retrieved successfully', 200, [], $request);
    }

    public function forgotPassword(Request $request): Response
    {
        $data = AuthValidator::forgotPassword($request->body());
        $this->auth->requestPasswordReset($data, $request);

        // Always generic so the endpoint cannot be used to enumerate accounts.
        return $this->success(null, 'If an account exists for that email, a reset link has been sent.', 200, [], $request);
    }

    public function resetPassword(Request $request): Response
    {
        $data = AuthValidator::resetPassword($request->body());
        $this->auth->resetPassword($data, $request);

        return $this->withCookies(
            $this->success(null, 'Your password has been reset. Please sign in again.', 200, [], $request),
            $this->auth->forgetCookies(),
        );
    }

    public function verifyEmail(Request $request): Response
    {
        $data = AuthValidator::verifyEmail($request->body());

        return $this->success($this->auth->verifyEmail($data, $request), 'Email verified successfully', 200, [], $request);
    }

    public function resendVerification(Request $request): Response
    {
        $data = AuthValidator::emailOnly($request->body());
        $this->auth->resendVerification($data, $request);

        return $this->success(null, 'If verification is required, a new link has been sent.', 200, [], $request);
    }

    public function changePassword(Request $request): Response
    {
        $data = AuthValidator::changePassword($request->body());
        $this->auth->changePassword($this->auth($request), $data, $request);

        return $this->success(null, 'Password changed successfully.', 200, [], $request);
    }

    public function requestPhoneVerification(Request $request): Response
    {
        $data = Validator::check($request->body(), [
            'phone' => 'required|phone|max:32',
        ]);

        $this->auth->requestPhoneVerification($this->auth($request), $data, $request);

        return $this->success(null, 'A verification code has been sent.', 200, [], $request);
    }

    public function verifyPhone(Request $request): Response
    {
        $data = AuthValidator::verifyPhone($request->body());
        $this->auth->verifyPhone($this->auth($request), $data, $request);

        return $this->success(null, 'Phone number verified successfully.', 200, [], $request);
    }

    /**
     * @param array<string,mixed> $session
     * @return array<string,mixed>
     */
    private function sessionPayload(array $session): array
    {
        return [
            'token' => $session['token'] ?? null,
            'csrfToken' => $session['csrf_token'] ?? null,
            'expiresAt' => $session['expires_at'] ?? null,
        ];
    }
}
