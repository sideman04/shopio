<?php

declare(strict_types=1);

namespace Shopio\Middleware;

use Shopio\Auth\AuthenticatedUser;
use Shopio\Exceptions\AuthenticationException;
use Shopio\Exceptions\AuthorizationException;
use Shopio\Http\Request;
use Shopio\Http\Response;
use Shopio\Repositories\SellerRepository;
use Shopio\Services\AuthService;

/** Blocks seller workspace operations until the store is approved. */
final class ApprovedSellerMiddleware
{
    public function __construct(
        private readonly AuthService $auth,
        private readonly SellerRepository $sellers,
    ) {
    }

    public function __invoke(Request $request, callable $next): Response
    {
        $principal = $request->attribute('auth');
        if (!$principal instanceof AuthenticatedUser) {
            $principal = $this->auth->resolve($request);
            if (!$principal instanceof AuthenticatedUser) {
                throw new AuthenticationException();
            }
            $request->setAttribute('auth', $principal);
        }

        if ($principal->sellerId === null) {
            throw new AuthorizationException('No seller application is associated with this account.');
        }

        $seller = $this->sellers->findById((int) $principal->sellerId);
        if ($seller === null || ($seller['verification_status'] ?? null) !== 'approved') {
            throw new AuthorizationException('Your seller application is awaiting approval.');
        }

        return $next($request);
    }
}
