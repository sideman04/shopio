<?php

declare(strict_types=1);

namespace Shopio\Controllers;

use Shopio\Auth\AuthenticatedUser;
use Shopio\Config\Config;
use Shopio\Exceptions\AuthorizationException;
use Shopio\Exceptions\ValidationException;
use Shopio\Http\Cookie;
use Shopio\Http\Request;
use Shopio\Http\Response;
use Shopio\Repositories\CookieConsentRepository;
use Shopio\Support\Str;

final class CookieConsentController extends Controller
{
    private const POLICY_VERSION = '2026-11-07';
    private const ANONYMOUS_COOKIE = 'shopio_consent_id';

    public function __construct(private readonly CookieConsentRepository $consents)
    {
    }

    public function save(Request $request): Response
    {
        $this->assertSameSiteRequest($request);
        $data = $this->validate($request->body());
        $principal = $request->attribute('auth');
        $userId = $principal instanceof AuthenticatedUser ? $principal->id : null;
        $anonymousToken = null;
        $response = $this->success(
            ['consent_timestamp' => gmdate('Y-m-d\TH:i:s\Z')],
            'Cookie preferences saved.',
            200,
            [],
            $request,
        );

        if ($userId === null) {
            $anonymousToken = $request->cookie(self::ANONYMOUS_COOKIE);
            if ($anonymousToken === null || preg_match('/^[A-Za-z0-9_-]{43}$/', $anonymousToken) !== 1) {
                $anonymousToken = Str::randomToken();
                $response->withCookie(Cookie::session(self::ANONYMOUS_COOKIE, $anonymousToken, 31_536_000));
            }
        }

        $this->consents->save($userId, $anonymousToken, $data);

        return $response;
    }

    /**
     * @param array<string,mixed> $input
     * @return array{necessary:bool,functional:bool,analytics:bool,marketing:bool,status:string,policy_version:string}
     */
    private function validate(array $input): array
    {
        $errors = [];
        $expected = [
            'necessary',
            'functional',
            'analytics',
            'marketing',
            'consent_status',
            'policy_version',
        ];

        if (array_diff(array_keys($input), $expected) !== [] || array_diff($expected, array_keys($input)) !== []) {
            $errors['body'][] = 'Only the documented cookie preference fields are accepted.';
        }

        foreach (['necessary', 'functional', 'analytics', 'marketing'] as $category) {
            if (!array_key_exists($category, $input) || !is_bool($input[$category])) {
                $errors[$category][] = 'Must be a boolean value.';
            }
        }

        if (($input['necessary'] ?? null) !== true) {
            $errors['necessary'][] = 'Strictly necessary cookies must remain enabled.';
        }

        $status = $input['consent_status'] ?? null;
        if (!is_string($status) || !in_array($status, ['accepted', 'rejected', 'customized'], true)) {
            $errors['consent_status'][] = 'Must be accepted, rejected or customized.';
        } elseif ($status === 'accepted'
            && (($input['functional'] ?? false) !== true
                || ($input['analytics'] ?? false) !== true
                || ($input['marketing'] ?? false) !== true)) {
            $errors['consent_status'][] = 'Accepting all cookies requires every optional category to be enabled.';
        } elseif ($status === 'rejected'
            && (($input['functional'] ?? true) !== false
                || ($input['analytics'] ?? true) !== false
                || ($input['marketing'] ?? true) !== false)) {
            $errors['consent_status'][] = 'Rejecting optional cookies requires every optional category to be disabled.';
        }

        if (($input['policy_version'] ?? null) !== self::POLICY_VERSION) {
            $errors['policy_version'][] = 'The cookie policy version is not supported.';
        }

        if ($errors !== []) {
            throw new ValidationException($errors);
        }

        return [
            'necessary' => true,
            'functional' => $input['functional'],
            'analytics' => $input['analytics'],
            'marketing' => $input['marketing'],
            'status' => $status,
            'policy_version' => self::POLICY_VERSION,
        ];
    }

    private function assertSameSiteRequest(Request $request): void
    {
        if ($request->header('sec-fetch-site') === 'cross-site') {
            throw new AuthorizationException('Cookie preferences cannot be submitted from another site.');
        }

        $origin = $request->header('origin');
        if ($origin === null || $origin === '') {
            return;
        }

        $origin = rtrim($origin, '/');
        foreach (Config::list('CORS_ALLOWED_ORIGINS') as $allowedOrigin) {
            if ($allowedOrigin !== '*' && rtrim($allowedOrigin, '/') === $origin) {
                return;
            }
        }

        $server = $request->server();
        $host = $request->header('host') ?? ($server['HTTP_HOST'] ?? null);
        $https = ($server['HTTPS'] ?? '') !== '' && strtolower((string) $server['HTTPS']) !== 'off';
        $scheme = strtolower((string) parse_url($origin, PHP_URL_SCHEME));
        if (
            is_string($host)
            && $host !== ''
            && $scheme === ($https ? 'https' : 'http')
            && strtolower((string) parse_url($origin, PHP_URL_HOST)) === strtolower(preg_replace('/:\d+$/', '', $host) ?? $host)
            && (parse_url($origin, PHP_URL_PORT) ?? ($https ? 443 : 80))
                === (preg_match('/:(\d+)$/', $host, $portMatch) === 1 ? (int) $portMatch[1] : ($https ? 443 : 80))
        ) {
            return;
        }

        throw new AuthorizationException('Cookie preferences cannot be submitted from this origin.');
    }
}
