<?php

declare(strict_types=1);

namespace Shopio\Repositories;

/**
 * Customer support messages and administrative handling.
 */
final class SupportRepository extends Repository
{
    public function create(?int $userId, string $name, string $email, string $subject, string $message): int
    {
        $this->db->execute(
            'INSERT INTO support_messages (user_id, name, email, subject, message)
             VALUES (:user_id, :name, :email, :subject, :message)',
            [
                'user_id' => $userId,
                'name' => $name,
                'email' => $email,
                'subject' => $subject,
                'message' => $message,
            ],
        );

        return $this->db->lastInsertId();
    }

    /**
     * @return array<string,mixed>|null
     */
    public function findById(int $id): ?array
    {
        return $this->db->selectOne('SELECT * FROM support_messages WHERE id = :id LIMIT 1', ['id' => $id]);
    }

    /**
     * @param array<string,mixed> $filters
     * @return array{rows:list<array<string,mixed>>,total:int}
     */
    public function paginateForAdmin(array $filters, int $page, int $perPage): array
    {
        $where = ['1=1'];
        $params = [];

        if (!empty($filters['status'])) {
            $where[] = 's.status = :status';
            $params['status'] = (string) $filters['status'];
        }

        if (!empty($filters['q'])) {
            $where[] = '(s.subject LIKE :q ESCAPE \'\\\\\' OR s.email LIKE :q ESCAPE \'\\\\\' OR s.name LIKE :q ESCAPE \'\\\\\')';
            $params['q'] = '%' . str_replace(['\\', '%', '_'], ['\\\\', '\\%', '\\_'], (string) $filters['q']) . '%';
        }

        $whereSql = implode(' AND ', $where);
        [$limit, $offset] = $this->window($page, $perPage);

        $total = (int) $this->db->scalar("SELECT COUNT(*) FROM support_messages s WHERE {$whereSql}", $params);

        $rows = $this->db->select(
            "SELECT s.id, s.user_id, s.name, s.email, s.subject, s.message, s.status, s.assigned_to,
                    s.resolved_at, s.created_at, u.full_name AS assigned_to_name
             FROM support_messages s
             LEFT JOIN users u ON u.id = s.assigned_to
             WHERE {$whereSql}
             ORDER BY s.created_at DESC, s.id DESC
             LIMIT {$limit} OFFSET {$offset}",
            $params,
        );

        return ['rows' => $rows, 'total' => $total];
    }

    public function updateStatus(int $id, string $status, ?int $assignedTo = null): bool
    {
        $statement = $this->db->execute(
            "UPDATE support_messages
             SET status = :status,
                 assigned_to = COALESCE(:assigned_to, assigned_to),
                 resolved_at = CASE WHEN :status2 IN ('resolved', 'closed') THEN UTC_TIMESTAMP() ELSE resolved_at END
             WHERE id = :id",
            ['status' => $status, 'status2' => $status, 'assigned_to' => $assignedTo, 'id' => $id],
        );

        return $this->db->affectedRows($statement) > 0;
    }

    public function countByStatus(string $status): int
    {
        return (int) $this->db->scalar('SELECT COUNT(*) FROM support_messages WHERE status = :status', ['status' => $status]);
    }
}
