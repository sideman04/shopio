<?php

declare(strict_types=1);

namespace Shopio\Policies;

/**
 * Order access rules shared by the customer, seller and admin surfaces.
 */
final class OrderPolicy extends Policy
{
    /**
     * @param array<string,mixed> $order
     */
    public function assertCustomerOwns(array $order): void
    {
        if (!$this->user->isAdmin() && (int) ($order['user_id'] ?? 0) !== $this->user->id) {
            // Do not reveal that the order exists for another account.
            $this->hide('The requested order does not exist.');
        }
    }

    /**
     * @param array<string,mixed> $order
     */
    public function assertSellerInvolved(array $order): void
    {
        if ($this->user->isAdmin()) {
            return;
        }

        $sellerId = $this->user->sellerId;
        if ($sellerId === null || (int) ($order['seller_id'] ?? 0) !== $sellerId) {
            $this->hide('The requested order does not exist.');
        }
    }
}
