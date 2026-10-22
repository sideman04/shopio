<?php

declare(strict_types=1);

namespace Shopio\Policies;

/**
 * Seller-scoped operations.
 */
final class SellerPolicy extends Policy
{
    public function isSeller(): bool
    {
        return $this->user->sellerId !== null;
    }

    public function assertSeller(): int
    {
        if ($this->user->sellerId === null) {
            $this->deny('No store is associated with this account.');
        }

        return $this->user->sellerId;
    }

    /**
     * @param int|string $sellerId
     */
    public function assertOwnsSeller(int|string $sellerId): void
    {
        if (!$this->ownsSeller($sellerId)) {
            $this->hide('The requested resource does not exist.');
        }
    }
}
