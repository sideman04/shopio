<?php

declare(strict_types=1);

namespace Shopio\Repositories;

use Shopio\Support\Money;

/**
 * Refund requests and their processing state.
 */
final class RefundRepository extends Repository
{
    public function create(
        int $paymentId,
        int $orderId,
        ?int $requestedBy,
        string $amount,
        ?string $reason,
        string $status = 'requested',
    ): int {
        $this->db->execute(
            'INSERT INTO refunds (payment_id, order_id, requested_by, amount, reason, status)
             VALUES (:payment_id, :order_id, :requested_by, :amount, :reason, :status)',
            [
                'payment_id' => $paymentId,
                'order_id' => $orderId,
                'requested_by' => $requestedBy,
                'amount' => $amount,
                'reason' => $reason,
                'status' => $status,
            ],
        );

        return $this->db->lastInsertId();
    }

    /**
     * @return array<string,mixed>|null
     */
    public function findById(int $id): ?array
    {
        return $this->db->selectOne('SELECT * FROM refunds WHERE id = :id LIMIT 1', ['id' => $id]);
    }

    /**
     * @return array<string,mixed>|null
     */
    public function lockById(int $id): ?array
    {
        return $this->db->selectOne('SELECT * FROM refunds WHERE id = :id LIMIT 1 FOR UPDATE', ['id' => $id]);
    }

    /**
     * @return list<array<string,mixed>>
     */
    public function forOrder(int $orderId): array
    {
        return $this->db->select(
            'SELECT id, order_id, payment_id, amount, reason, status, processed_at, created_at
             FROM refunds WHERE order_id = :order_id ORDER BY id DESC',
            ['order_id' => $orderId],
        );
    }

    public function sumInStatuses(int $orderId, array $statuses): string
    {
        if ($statuses === []) {
            return '0.00';
        }

        $placeholders = [];
        $params = ['order_id' => $orderId];
        foreach (array_values($statuses) as $index => $status) {
            $key = 's' . $index;
            $placeholders[] = ':' . $key;
            $params[$key] = $status;
        }

        return Money::format((string) $this->db->scalar(
            'SELECT COALESCE(SUM(amount), 0) FROM refunds
             WHERE order_id = :order_id AND status IN (' . implode(', ', $placeholders) . ')',
            $params,
        ));
    }

    public function updateStatus(
        int $id,
        string $status,
        ?int $processedBy = null,
        ?string $providerReference = null,
    ): void {
        $this->db->execute(
            'UPDATE refunds
             SET status = :status,
                 processed_by = COALESCE(:processed_by, processed_by),
                 provider_reference = COALESCE(:reference, provider_reference),
                 processed_at = CASE WHEN :status2 IN (\'succeeded\', \'rejected\', \'failed\')
                                     THEN UTC_TIMESTAMP() ELSE processed_at END
             WHERE id = :id',
            [
                'status' => $status,
                'status2' => $status,
                'processed_by' => $processedBy,
                'reference' => $providerReference,
                'id' => $id,
            ],
        );
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
            $where[] = 'r.status = :status';
            $params['status'] = (string) $filters['status'];
        }

        if (!empty($filters['q'])) {
            $where[] = '(o.order_number LIKE :q ESCAPE \'\\\\\' OR o.customer_email LIKE :q ESCAPE \'\\\\\')';
            $params['q'] = '%' . str_replace(['\\', '%', '_'], ['\\\\', '\\%', '\\_'], (string) $filters['q']) . '%';
        }

        $whereSql = implode(' AND ', $where);
        [$limit, $offset] = $this->window($page, $perPage);

        $total = (int) $this->db->scalar(
            "SELECT COUNT(*) FROM refunds r JOIN orders o ON o.id = r.order_id WHERE {$whereSql}",
            $params,
        );

        $rows = $this->db->select(
            "SELECT r.id, r.order_id, r.payment_id, r.amount, r.reason, r.status, r.provider_reference,
                    r.processed_at, r.created_at,
                    o.order_number, o.customer_name, o.customer_email, o.currency,
                    ru.full_name AS requested_by_name, pu.full_name AS processed_by_name
             FROM refunds r
             JOIN orders o ON o.id = r.order_id
             LEFT JOIN users ru ON ru.id = r.requested_by
             LEFT JOIN users pu ON pu.id = r.processed_by
             WHERE {$whereSql}
             ORDER BY r.created_at DESC, r.id DESC
             LIMIT {$limit} OFFSET {$offset}",
            $params,
        );

        return ['rows' => $rows, 'total' => $total];
    }

    public function countByStatus(string $status): int
    {
        return (int) $this->db->scalar('SELECT COUNT(*) FROM refunds WHERE status = :status', ['status' => $status]);
    }

    public function pendingCount(): int
    {
        return (int) $this->db->scalar("SELECT COUNT(*) FROM refunds WHERE status IN ('requested', 'processing')");
    }
}
