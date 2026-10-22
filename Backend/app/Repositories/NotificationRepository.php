<?php

declare(strict_types=1);

namespace Shopio\Repositories;

/**
 * In-app notifications.
 */
final class NotificationRepository extends Repository
{
    /**
     * @param array<string,mixed>|null $data
     */
    public function create(
        int $userId,
        string $type,
        string $title,
        string $message,
        ?string $targetUrl = null,
        ?array $data = null,
    ): int {
        $this->db->execute(
            'INSERT INTO notifications (user_id, type, title, message, target_url, data)
             VALUES (:user_id, :type, :title, :message, :target_url, :data)',
            [
                'user_id' => $userId,
                'type' => mb_substr($type, 0, 80),
                'title' => mb_substr($title, 0, 180),
                'message' => $message,
                'target_url' => $targetUrl,
                'data' => $data === null
                    ? null
                    : json_encode($data, JSON_UNESCAPED_SLASHES | JSON_INVALID_UTF8_SUBSTITUTE),
            ],
        );

        return $this->db->lastInsertId();
    }

    /**
     * @return array{rows:list<array<string,mixed>>,total:int,unread:int}
     */
    public function paginateForUser(int $userId, bool $onlyUnread, int $page, int $perPage): array
    {
        $where = ['user_id = :user_id'];
        if ($onlyUnread) {
            $where[] = 'read_at IS NULL';
        }

        $whereSql = implode(' AND ', $where);
        [$limit, $offset] = $this->window($page, $perPage);

        $total = (int) $this->db->scalar("SELECT COUNT(*) FROM notifications WHERE {$whereSql}", ['user_id' => $userId]);

        $rows = $this->db->select(
            "SELECT id, type, title, message, target_url, data, read_at, created_at
             FROM notifications
             WHERE {$whereSql}
             ORDER BY created_at DESC, id DESC
             LIMIT {$limit} OFFSET {$offset}",
            ['user_id' => $userId],
        );

        return ['rows' => $rows, 'total' => $total, 'unread' => $this->unreadCount($userId)];
    }

    public function unreadCount(int $userId): int
    {
        return (int) $this->db->scalar(
            'SELECT COUNT(*) FROM notifications WHERE user_id = :user_id AND read_at IS NULL',
            ['user_id' => $userId],
        );
    }

    public function markRead(int $id, int $userId): bool
    {
        $statement = $this->db->execute(
            'UPDATE notifications SET read_at = UTC_TIMESTAMP()
             WHERE id = :id AND user_id = :user_id AND read_at IS NULL',
            ['id' => $id, 'user_id' => $userId],
        );

        if ($this->db->affectedRows($statement) > 0) {
            return true;
        }

        // Already read is still a success for the caller; verify ownership.
        return $this->db->scalar(
            'SELECT 1 FROM notifications WHERE id = :id AND user_id = :user_id LIMIT 1',
            ['id' => $id, 'user_id' => $userId],
        ) !== null;
    }

    public function markAllRead(int $userId): int
    {
        return $this->db->affectedRows($this->db->execute(
            'UPDATE notifications SET read_at = UTC_TIMESTAMP() WHERE user_id = :user_id AND read_at IS NULL',
            ['user_id' => $userId],
        ));
    }
}
