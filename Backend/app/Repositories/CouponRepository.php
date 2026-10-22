<?php

declare(strict_types=1);

namespace Shopio\Repositories;

/**
 * Coupons and coupon redemptions (`coupons`, `coupons_applied`).
 *
 * Usage counts are always derived from `coupons_applied` so there is no
 * denormalised counter to drift out of sync.
 */
final class CouponRepository extends Repository
{
    /**
     * @return array<string,mixed>|null
     */
    public function findByCode(string $code): ?array
    {
        return $this->db->selectOne(
            'SELECT id, code, description, discount_type, discount_value, minimum_order_amount,
                    maximum_discount_amount, usage_limit, per_user_limit, starts_at, expires_at, status
             FROM coupons WHERE code = :code LIMIT 1',
            ['code' => strtoupper(trim($code))],
        );
    }

    /**
     * Locks the coupon row so usage limits are validated transactionally.
     *
     * @return array<string,mixed>|null
     */
    public function lockById(int $id): ?array
    {
        return $this->db->selectOne(
            'SELECT id, code, discount_type, discount_value, minimum_order_amount, maximum_discount_amount,
                    usage_limit, per_user_limit, starts_at, expires_at, status
             FROM coupons WHERE id = :id LIMIT 1 FOR UPDATE',
            ['id' => $id],
        );
    }

    /**
     * @return array<string,mixed>|null
     */
    public function findById(int $id): ?array
    {
        return $this->db->selectOne(
            'SELECT id, code, description, discount_type, discount_value, minimum_order_amount,
                    maximum_discount_amount, usage_limit, per_user_limit, starts_at, expires_at, status,
                    created_by, created_at, updated_at,
                    (SELECT COUNT(*) FROM coupons_applied ca WHERE ca.coupon_id = coupons.id) AS used_count
             FROM coupons WHERE id = :id LIMIT 1',
            ['id' => $id],
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

        if (!empty($filters['q'])) {
            $where[] = 'code LIKE :q ESCAPE \'\\\\\'';
            $params['q'] = '%' . str_replace(['\\', '%', '_'], ['\\\\', '\\%', '\\_'], (string) $filters['q']) . '%';
        }

        if (!empty($filters['status'])) {
            $where[] = 'status = :status';
            $params['status'] = (string) $filters['status'];
        }

        $whereSql = implode(' AND ', $where);
        [$limit, $offset] = $this->window($page, $perPage);

        $total = (int) $this->db->scalar("SELECT COUNT(*) FROM coupons WHERE {$whereSql}", $params);

        $rows = $this->db->select(
            "SELECT c.id, c.code, c.description, c.discount_type, c.discount_value, c.minimum_order_amount,
                    c.maximum_discount_amount, c.usage_limit, c.per_user_limit, c.starts_at, c.expires_at, c.status,
                    c.created_at, c.updated_at,
                    (SELECT COUNT(*) FROM coupons_applied ca WHERE ca.coupon_id = c.id) AS used_count,
                    (SELECT COALESCE(SUM(ca.discount_amount), 0) FROM coupons_applied ca WHERE ca.coupon_id = c.id) AS total_discount
             FROM coupons c
             WHERE {$whereSql}
             ORDER BY c.created_at DESC, c.id DESC
             LIMIT {$limit} OFFSET {$offset}",
            $params,
        );

        return ['rows' => $rows, 'total' => $total];
    }

    /**
     * @param array<string,mixed> $data
     */
    public function create(array $data): int
    {
        $this->db->execute(
            'INSERT INTO coupons
                (code, description, discount_type, discount_value, minimum_order_amount, maximum_discount_amount,
                 usage_limit, per_user_limit, starts_at, expires_at, status, created_by)
             VALUES
                (:code, :description, :discount_type, :discount_value, :minimum_order_amount, :maximum_discount_amount,
                 :usage_limit, :per_user_limit, :starts_at, :expires_at, :status, :created_by)',
            [
                'code' => strtoupper(trim((string) $data['code'])),
                'description' => $data['description'] ?? null,
                'discount_type' => $data['discount_type'],
                'discount_value' => (string) $data['discount_value'],
                'minimum_order_amount' => (string) ($data['minimum_order_amount'] ?? '0'),
                'maximum_discount_amount' => isset($data['maximum_discount_amount'])
                    ? (string) $data['maximum_discount_amount']
                    : null,
                'usage_limit' => $data['usage_limit'] ?? null,
                'per_user_limit' => $data['per_user_limit'] ?? null,
                'starts_at' => $data['starts_at'] ?? null,
                'expires_at' => $data['expires_at'] ?? null,
                'status' => $data['status'] ?? 'active',
                'created_by' => $data['created_by'] ?? null,
            ],
        );

        return $this->db->lastInsertId();
    }

    /**
     * @param array<string,mixed> $data
     */
    public function update(int $id, array $data): void
    {
        $allowed = [
            'description', 'discount_type', 'discount_value', 'minimum_order_amount',
            'maximum_discount_amount', 'usage_limit', 'per_user_limit', 'starts_at', 'expires_at', 'status',
        ];

        $sets = [];
        $params = ['id' => $id];

        foreach ($allowed as $column) {
            if (!array_key_exists($column, $data)) {
                continue;
            }
            $sets[] = "{$column} = :{$column}";
            $params[$column] = $data[$column];
        }

        if ($sets === []) {
            return;
        }

        $this->db->execute('UPDATE coupons SET ' . implode(', ', $sets) . ' WHERE id = :id', $params);
    }

    public function delete(int $id): void
    {
        $this->db->execute('DELETE FROM coupons WHERE id = :id', ['id' => $id]);
    }

    public function usageCount(int $couponId): int
    {
        return (int) $this->db->scalar(
            'SELECT COUNT(*) FROM coupons_applied WHERE coupon_id = :id',
            ['id' => $couponId],
        );
    }

    public function userUsageCount(int $couponId, int $userId): int
    {
        return (int) $this->db->scalar(
            'SELECT COUNT(*) FROM coupons_applied WHERE coupon_id = :id AND user_id = :user_id',
            ['id' => $couponId, 'user_id' => $userId],
        );
    }

    public function recordApplied(int $couponId, int $orderId, ?int $userId, string $discountAmount): void
    {
        $this->db->execute(
            'INSERT INTO coupons_applied (coupon_id, order_id, user_id, discount_amount)
             VALUES (:coupon_id, :order_id, :user_id, :discount)
             ON DUPLICATE KEY UPDATE discount_amount = VALUES(discount_amount)',
            [
                'coupon_id' => $couponId,
                'order_id' => $orderId,
                'user_id' => $userId,
                'discount' => $discountAmount,
            ],
        );
    }
}
