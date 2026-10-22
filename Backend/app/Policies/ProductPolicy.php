<?php

declare(strict_types=1);

namespace Shopio\Policies;

/**
 * Product management rules. A seller may only manage products they own.
 */
final class ProductPolicy extends Policy
{
    public function isAdmin(): bool
    {
        return $this->user->isAdmin();
    }

    /**
     * @param array<string,mixed> $product
     */
    public function assertManage(array $product): void
    {
        if ($this->user->isAdmin()) {
            return;
        }

        if (!$this->ownsSeller((int) ($product['seller_id'] ?? 0))) {
            // Hide existence rather than confirm it belongs to someone else.
            $this->hide('The requested product does not exist.');
        }
    }
}
