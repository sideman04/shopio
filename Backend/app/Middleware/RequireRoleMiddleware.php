<?php

declare(strict_types=1);

namespace Shopio\Middleware;

use Shopio\Auth\AuthenticatedUser;
use Shopio\Exceptions\AuthenticationException;
use Shopio\Exceptions\AuthorizationException;
use Shopio\Http\Request;
use Shopio\Http\Response;
use Shopio\Services\AuthService;

/**
 * Role gate. At least one of the configured roles must be held.
 *
 * The role list is a constructor argument (registered as distinct named services
 * in the kernel), which keeps authorisation declarative at the routing layer
 * rather than scattered through controller bodies.
 */
final class RequireRoleMiddleware
{
    /** @var list<string> */
    private readonly array $roles;

    /**
     * @param list<string> $roles
     */
    public function __construct(private readonly AuthService $auth, array $roles)
    {
        $this->roles = array_values(array_unique($roles));
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

        foreach ($this->roles as $role) {
            if ($principal->hasRole($role)) {
                return $next($request);
            }
        }

        throw new AuthorizationException();
    }
}
