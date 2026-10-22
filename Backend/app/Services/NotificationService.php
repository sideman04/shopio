<?php

declare(strict_types=1);

namespace Shopio\Services;

use Shopio\Repositories\NotificationRepository;

/**
 * In-app notifications.
 */
final class NotificationService
{
    public function __construct(private readonly NotificationRepository $notifications)
    {
    }

    /**
     * @param array<string,mixed>|null $data
     */
    public function notify(
        int $userId,
        string $type,
        string $title,
        string $message,
        ?string $targetUrl = null,
        ?array $data = null,
    ): int {
        return $this->notifications->create($userId, $type, $title, $message, $targetUrl, $data);
    }

    /**
     * @return array{rows:list<array<string,mixed>>,total:int,unread:int}
     */
    public function paginate(int $userId, bool $onlyUnread, int $page, int $perPage): array
    {
        return $this->notifications->paginateForUser($userId, $onlyUnread, $page, $perPage);
    }

    public function markRead(int $id, int $userId): bool
    {
        return $this->notifications->markRead($id, $userId);
    }

    public function markAllRead(int $userId): int
    {
        return $this->notifications->markAllRead($userId);
    }

    public function unreadCount(int $userId): int
    {
        return $this->notifications->unreadCount($userId);
    }
}
