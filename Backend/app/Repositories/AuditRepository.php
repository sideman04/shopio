<?php

declare(strict_types=1);

namespace Shopio\Repositories;

/**
 * Audit trail for administrative and financial operations.
 *
 * `details` is JSON; sensitive values must never be written here (see Logger /
 * Redactor for the same rule).
 */
final class AuditRepository extends Repository
{
    /**
     * @param array<string,mixed>|null $details
     */
    public function record(
        ?int $actorUserId,
        string $action,
        string $entityType,
        ?int $entityId = null,
        ?string $ipAddress = null,
        ?string $userAgent = null,
        ?array $details = null,
    ): int {
        $this->db->execute(
            'INSERT INTO audit_logs (actor_user_id, action, entity_type, entity_id, ip_address, user_agent, details)
             VALUES (:actor, :action, :entity_type, :entity_id, INET6_ATON(:ip), :user_agent, :details)',
            [
                'actor' => $actorUserId,
                'action' => mb_substr($action, 0, 120),
                'entity_type' => mb_substr($entityType, 0, 80),
                'entity_id' => $entityId,
                'ip' => $ipAddress,
                'user_agent' => $userAgent === null ? null : mb_substr($userAgent, 0, 500),
                'details' => $details === null
                    ? null
                    : json_encode($details, JSON_UNESCAPED_SLASHES | JSON_INVALID_UTF8_SUBSTITUTE),
            ],
        );

        return $this->db->lastInsertId();
    }

    /**
     * @param array<string,mixed> $filters
     * @return array{rows:list<array<string,mixed>>,total:int}
     */
    public function paginate(array $filters, int $page, int $perPage): array
    {
        $where = ['1=1'];
        $params = [];

        if (!empty($filters['action'])) {
            $where[] = 'a.action LIKE :action ESCAPE \'\\\\\'';
            $params['action'] = '%' . str_replace(['\\', '%', '_'], ['\\\\', '\\%', '\\_'], (string) $filters['action']) . '%';
        }

        if (!empty($filters['entity_type'])) {
            $where[] = 'a.entity_type = :entity_type';
            $params['entity_type'] = (string) $filters['entity_type'];
        }

        if (!empty($filters['actor_user_id'])) {
            $where[] = 'a.actor_user_id = :actor';
            $params['actor'] = (int) $filters['actor_user_id'];
        }

        if (!empty($filters['date_from'])) {
            $where[] = 'a.created_at >= :date_from';
            $params['date_from'] = (string) $filters['date_from'];
        }

        if (!empty($filters['date_to'])) {
            $where[] = 'a.created_at <= :date_to';
            $params['date_to'] = (string) $filters['date_to'];
        }

        $whereSql = implode(' AND ', $where);
        [$limit, $offset] = $this->window($page, $perPage);

        $total = (int) $this->db->scalar("SELECT COUNT(*) FROM audit_logs a WHERE {$whereSql}", $params);

        $rows = $this->db->select(
            "SELECT a.id, a.actor_user_id, a.action, a.entity_type, a.entity_id,
                    INET6_NTOA(a.ip_address) AS ip_address, a.user_agent, a.details, a.created_at,
                    u.full_name AS actor_name, u.email AS actor_email
             FROM audit_logs a
             LEFT JOIN users u ON u.id = a.actor_user_id
             WHERE {$whereSql}
             ORDER BY a.created_at DESC, a.id DESC
             LIMIT {$limit} OFFSET {$offset}",
            $params,
        );

        return ['rows' => $rows, 'total' => $total];
    }

    /**
     * @return list<array<string,mixed>>
     */
    public function recent(int $limit = 20): array
    {
        return $this->db->select(
            'SELECT a.id, a.action, a.entity_type, a.entity_id, a.created_at, u.full_name AS actor_name
             FROM audit_logs a
             LEFT JOIN users u ON u.id = a.actor_user_id
             ORDER BY a.id DESC
             LIMIT ' . max(1, min(200, $limit)),
        );
    }
}
