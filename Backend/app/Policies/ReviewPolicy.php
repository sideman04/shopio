<?php

declare(strict_types=1);

namespace Shopio\Policies;

/**
 * Review moderation and seller replies.
 */
final class ReviewPolicy extends Policy
{
    public function assertModerate(): void
    {
        if (!$this->user->isAdmin()) {
            $this->deny();
        }
    }

    /**
     * @param array<string,mixed> $review
     */
    public function assertSellerOwns(array $review): void
    {
        if (!$this->ownsSeller((int) ($review['seller_id'] ?? 0))) {
            $this->hide('The requested review does not exist.');
        }
    }
}
