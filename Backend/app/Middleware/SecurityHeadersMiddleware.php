<?php

declare(strict_types=1);

namespace Shopio\Middleware;

use Shopio\Config\Config;
use Shopio\Http\Request;
use Shopio\Http\Response;

/**
 * Baseline security headers for a JSON API.
 *
 * The API never serves HTML, so the Content-Security-Policy is deliberately
 * locked to `default-src 'none'`, which also neutralises any accidental
 * rendering of user-supplied content. HSTS is only sent over a secure channel.
 */
final class SecurityHeadersMiddleware
{
    /** @var array<string,string> */
    private const STATIC_HEADERS = [
        'X-Content-Type-Options' => 'nosniff',
        'X-Frame-Options' => 'DENY',
        'Referrer-Policy' => 'no-referrer',
        'Permissions-Policy' => 'accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()',
        'Cross-Origin-Opener-Policy' => 'same-origin',
        'Cross-Origin-Resource-Policy' => 'same-site',
        'Content-Security-Policy' => "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'",
        'X-Permitted-Cross-Domain-Policies' => 'none',
    ];

    public function apply(Request $request, Response $response): Response
    {
        $headers = self::STATIC_HEADERS;

        // Never advertise the runtime.
        $headers['X-Powered-By'] = 'Shopio';

        if ($request->isSecure() && Config::bool('HSTS_ENABLED', true)) {
            $headers['Strict-Transport-Security'] = 'max-age=' . Config::int('HSTS_MAX_AGE', 31_536_000) . '; includeSubDomains';
        }

        return $response->withHeaders($headers);
    }

    public function __invoke(Request $request, callable $next): Response
    {
        return $this->apply($request, $next($request));
    }
}
