<?php

declare(strict_types=1);

namespace Shopio\Middleware;

use Shopio\Auth\AuthenticatedUser;
use Shopio\Exceptions\AuthenticationException;
use Shopio\Http\Request;
use Shopio\Http\Response;
use Shopio\Services\AuthService;

/**
 * Requires a valid session. On success the resolved principal is attached to the
 * request as the `auth` attribute; controllers read identity from there and
 * never from the request body or query string.
 */
final class AuthMiddleware
{
    public function __construct(private readonly AuthService $auth)
    {
    }

    public function __invoke(Request $request, callable $next): Response
    {
        $principal = $this->auth->resolve($request);

        if (!$principal instanceof AuthenticatedUser) {
            throw new AuthenticationException();
        }

        $request->setAttribute('auth', $principal);

        return $next($request);
    }
}
