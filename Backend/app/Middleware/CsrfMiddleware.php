<?php

declare(strict_types=1);

namespace Shopio\Middleware;

use Shopio\Auth\AuthenticatedUser;
use Shopio\Config\Config;
use Shopio\Exceptions\AuthenticationException;
use Shopio\Http\Request;
use Shopio\Http\Response;
use Shopio\Support\Str;

/**
 * Double-submit CSRF protection for cookie-authenticated, state-changing
 * requests.
 *
 * Only cookie-authenticated requests are subject to enforcement: a bearer token
 * is not sent automatically by the browser, so it is not a CSRF vector. The
 * comparison is against the CSRF token stored (hashed) with the session, so a
 * stolen cookie alone is not enough to forge a request.
 */
final class CsrfMiddleware
{
    private const SAFE_METHODS = ['GET', 'HEAD', 'OPTIONS'];

    public function __invoke(Request $request, callable $next): Response
    {
        if (in_array($request->method(), self::SAFE_METHODS, true)) {
            return $next($request);
        }

        $principal = $request->attribute('auth');
        if (!$principal instanceof AuthenticatedUser) {
            // A route that is both auth and csrf would have failed earlier;
            // without a principal there is nothing to double-submit against.
            throw new AuthenticationException();
        }

        // Bearer-authenticated calls are not cookie-driven and cannot be forged
        // by a cross-site form post.
        if ($principal->via !== 'cookie') {
            return $next($request);
        }

        $provided = $request->header(Config::get('CSRF_HEADER_NAME', 'x-csrf-token') ?? 'x-csrf-token');
        if ($provided === null || $provided === '') {
            // Conventional header used by axios / many SPAs.
            $provided = $request->header('x-xsrf-token');
        }

        if ($provided === null || $provided === '' || $principal->csrfHash === null) {
            throw new AuthenticationException('Your session has expired or the request could not be verified.');
        }

        if (!Str::constantTimeEquals(Str::hashToken(trim($provided)), $principal->csrfHash)) {
            throw new AuthenticationException('Your session has expired or the request could not be verified.');
        }

        return $next($request);
    }
}
