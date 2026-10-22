<?php

declare(strict_types=1);

namespace Shopio\Policies;

/**
 * Payout request/decision rules.
 */
final class PayoutPolicy extends Policy
{
    public function assertSeller(): int
    {
        if ($this->user->sellerId === null) {
            $this->deny('No store is associated with this account.');
        }

        return $this->user->sellerId;
    }

    public function assertAdmin(): void
    {
        if (!$this->user->isAdmin()) {
            $this->deny();
        }
    }
}
