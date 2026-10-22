<?php

declare(strict_types=1);

namespace Shopio\Policies;

/**
 * Administrator-only operations.
 */
final class AdminPolicy extends Policy
{
    public function isAdmin(): bool
    {
        return $this->user->isAdmin();
    }

    public function assertAdmin(): void
    {
        if (!$this->user->isAdmin()) {
            $this->deny();
        }
    }
}
