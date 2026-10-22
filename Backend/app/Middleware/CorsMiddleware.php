<?php

declare(strict_types=1);

namespace Shopio\Middleware;

use Shopio\Config\Config;
use Shopio\Http\Request;
use Shopio\Http\Response;

/**
 * CORS with a strict origin allowlist.
 *
 * A wildcard is never honoured for credentialed requests. Because sessions use
 * cookies, the allowed origin is echoed back explicitly and `Vary: Origin` is
 * always set so caches never serve one origin's response to another.
 */
final class CorsMiddleware
{
    private const ALLOWED_METHODS = 'GET, POST, PUT, PATCH, DELETE, OPTIONS';
    private const ALLOWED_HEADERS = 'Authorization, Content-Type, X-CSRF-Token, X-XSRF-Token, X-Requested-With, Idempotency-Key, Accept, Origin';
    private const EXPOSED_HEADERS = 'X-Request-Id, Retry-After, X-RateLimit-Limit, X-RateLimit-Remaining';
    private const MAX_AGE = '600';

    public function apply(Request $request, Response $response): Response
    {
        $origin = $request->header('origin');
        if ($origin === null || $origin === '') {
            return $response;
        }

        $allowed = $this->isAllowed($origin);
        $response = $response->withHeader('Vary', 'Origin');

        if (!$allowed) {
            return $response;
        }

        $response->withHeader('Access-Control-Allow-Origin', $origin);

        if (Config::bool('CORS_ALLOW_CREDENTIALS', true)) {
            $response->withHeader('Access-Control-Allow-Credentials', 'true');
        }

        return $response->withHeader('Access-Control-Expose-Headers', self::EXPOSED_HEADERS);
    }

    public function preflight(Request $request): Response
    {
        $origin = $request->header('origin');
        $response = new Response(204);

        if ($origin === null || $origin === '') {
            return $response;
        }

        $response = $response->withHeader('Vary', 'Origin');
        if (!$this->isAllowed($origin)) {
            return $response;
        }

        $response->withHeader('Access-Control-Allow-Origin', $origin)
            ->withHeader('Access-Control-Allow-Methods', self::ALLOWED_METHODS)
            ->withHeader('Access-Control-Allow-Headers', self::ALLOWED_HEADERS)
            ->withHeader('Access-Control-Max-Age', self::MAX_AGE);

        if (Config::bool('CORS_ALLOW_CREDENTIALS', true)) {
            $response->withHeader('Access-Control-Allow-Credentials', 'true');
        }

        return $response;
    }

    private function isAllowed(string $origin): bool
    {
        $origin = rtrim(trim($origin), '/');

        foreach (Config::list('CORS_ALLOWED_ORIGINS') as $candidate) {
            if ($candidate === '*' || rtrim(trim($candidate), '/') === $origin) {
                return true;
            }
        }

        return false;
    }

    public function __invoke(Request $request, callable $next): Response
    {
        return $this->apply($request, $next($request));
    }
}
