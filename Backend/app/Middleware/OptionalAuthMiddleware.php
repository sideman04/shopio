<?php

declare(strict_types=1);

namespace Shopio\Middleware;

use Shopio\Http\Request;
use Shopio\Http\Response;
use Shopio\Services\AuthService;

/**
 * Resolves the principal when present but never rejects the request. Used by
 * public endpoints that personalise their response (e.g. cart, wishlist state).
 */
final class OptionalAuthMiddleware
{
    public function __construct(private readonly AuthService $auth)
    {
    }

    public function __invoke(Request $request, callable $next): Response
    {
        $principal = $this->auth->resolve($request);
        if ($principal !== null) {
            $request->setAttribute('auth', $principal);
        }

        return $next($request);
    }
}
