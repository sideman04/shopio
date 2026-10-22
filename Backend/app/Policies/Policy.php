<?php

declare(strict_types=1);

namespace Shopio\Policies;

use Shopio\Auth\AuthenticatedUser;
use Shopio\Exceptions\AuthorizationException;
use Shopio\Exceptions\NotFoundException;

/**
 * Base authorisation policy.
 *
 * Policies encode "who may do what to which resource". They are deliberately
 * independent of the transport (HTTP) so the same decision can be reused by
 * controllers, services and tests. Services repeat the ownership check at the
 * data layer; a policy in front of them is defence in depth, and returns a
 * deliberate 403 vs. a not-found 404 depending on whether existence itself is
 * sensitive.
 */
abstract class Policy
{
    public function __construct(protected readonly AuthenticatedUser $user)
    {
    }

    /**
     * @param int|string $sellerId
     */
    protected function ownsSeller(int|string $sellerId): bool
    {
        return $this->user->sellerId !== null && $this->user->sellerId === (int) $sellerId;
    }

    protected function deny(string $message = 'This action is unauthorized.'): never
    {
        throw new AuthorizationException($message);
    }

    /**
     * Hides the existence of a resource the caller may not even know about.
     */
    protected function hide(string $message = 'The requested resource does not exist.'): never
    {
        throw new NotFoundException($message);
    }
}
