<?php

declare(strict_types=1);

namespace Shopio\Repositories;

/**
 * Seller store profiles. Public reads return only store-facing columns; owner
 * identity columns are exposed solely to administrators.
 */
final class SellerRepository extends Repository
{
    private const PUBLIC_COLUMNS = 's.id, s.user_id, s.store_name, s.store_slug, s.store_description,
                                    s.logo_url, s.banner_url, s.business_category, s.contact_phone,
                                    s.region_id, s.city_id, s.address, s.verification_status,
                                    s.commission_rate, s.status, s.created_at, s.updated_at';

    /**
     * @return array<string,mixed>|null
     */
    public function findById(int $id): ?array
    {
        return $this->db->selectOne(
            'SELECT ' . self::PUBLIC_COLUMNS . ' FROM seller_profiles s WHERE s.id = :id LIMIT 1',
            ['id' => $id],
        );
    }

    /**
     * Full row including private/verification columns — for the owning seller.
     *
     * @return array<string,mixed>|null
     */
    public function findByIdWithPrivate(int $id): ?array
    {
        return $this->db->selectOne(
            'SELECT ' . self::PUBLIC_COLUMNS . ', s.verification_notes, s.verified_by, s.verified_at
             FROM seller_profiles s WHERE s.id = :id LIMIT 1',
            ['id' => $id],
        );
    }

    /**
     * @return array<string,mixed>|null
     */
    public function findByUserId(int $userId): ?array
    {
        return $this->db->selectOne(
            'SELECT ' . self::PUBLIC_COLUMNS . ', s.verification_notes, s.verified_by, s.verified_at
             FROM seller_profiles s WHERE s.user_id = :user_id LIMIT 1',
            ['user_id' => $userId],
        );
    }

    /**
     * @return array<string,mixed>|null
     */
    public function findBySlug(string $slug): ?array
    {
        return $this->db->selectOne(
            'SELECT ' . self::PUBLIC_COLUMNS . ' FROM seller_profiles s WHERE s.store_slug = :slug LIMIT 1',
            ['slug' => $slug],
        );
    }

    public function slugExists(string $slug, ?int $exceptId = null): bool
    {
        $sql = 'SELECT 1 FROM seller_profiles WHERE store_slug = :slug';
        $params = ['slug' => $slug];

        if ($exceptId !== null) {
            $sql .= ' AND id <> :except';
            $params['except'] = $exceptId;
        }

        return $this->db->scalar($sql . ' LIMIT 1', $params) !== null;
    }

    public function create(int $userId, string $storeName, string $slug, ?string $description, ?string $businessCategory, string $commissionRate): int
    {
        $this->db->execute(
            'INSERT INTO seller_profiles
                (user_id, store_name, store_slug, store_description, business_category, commission_rate, verification_status, status)
             VALUES
                (:user_id, :store_name, :slug, :description, :business_category, :commission_rate, \'not_submitted\', \'active\')',
            [
                'user_id' => $userId,
                'store_name' => $storeName,
                'slug' => $slug,
                'description' => $description,
                'business_category' => $businessCategory,
                'commission_rate' => $commissionRate,
            ],
        );

        return $this->db->lastInsertId();
    }

    /**
     * Explicit allowlist; `verification_status`, `status` and `commission_rate`
     * are deliberately excluded (they require an administrative pathway).
     *
     * @param array<string,mixed> $fields
     */
    public function updateProfile(int $sellerId, array $fields): void
    {
        $allowed = [
            'store_name',
            'store_description',
            'logo_url',
            'banner_url',
            'business_category',
            'contact_phone',
            'region_id',
            'city_id',
            'address',
            'status',
        ];
        $sets = [];
        $params = ['id' => $sellerId];

        foreach ($allowed as $column) {
            if (!array_key_exists($column, $fields)) {
                continue;
            }
            $sets[] = "{$column} = :{$column}";
            $params[$column] = $fields[$column];
        }

        if ($sets === []) {
            return;
        }

        $this->db->execute('UPDATE seller_profiles SET ' . implode(', ', $sets) . ' WHERE id = :id', $params);
    }

    public function updateVerification(int $sellerId, string $status, ?string $notes, int $verifiedBy): void
    {
        $this->db->execute(
            'UPDATE seller_profiles
             SET verification_status = :status, verification_notes = :notes,
                 verified_by = :verified_by, verified_at = UTC_TIMESTAMP()
             WHERE id = :id',
            ['status' => $status, 'notes' => $notes, 'verified_by' => $verifiedBy, 'id' => $sellerId],
        );
    }

    public function setStatus(int $sellerId, string $status): void
    {
        $this->db->execute(
            'UPDATE seller_profiles SET status = :status WHERE id = :id',
            ['status' => $status, 'id' => $sellerId],
        );
    }

    public function setCommissionRate(int $sellerId, string $rate): void
    {
        $this->db->execute(
            'UPDATE seller_profiles SET commission_rate = :rate WHERE id = :id',
            ['rate' => $rate, 'id' => $sellerId],
        );
    }

    /**
     * @return array<string,mixed>|null
     */
    public function lockForUpdate(int $sellerId): ?array
    {
        return $this->db->selectOne(
            'SELECT id, user_id, commission_rate, status, verification_status
             FROM seller_profiles WHERE id = :id LIMIT 1 FOR UPDATE',
            ['id' => $sellerId],
        );
    }

    /**
     * @param array<string,mixed> $filters
     * @return array{rows:list<array<string,mixed>>,total:int}
     */
    public function paginateAdmin(array $filters, int $page, int $perPage): array
    {
        $where = ['1=1'];
        $params = [];

        if (!empty($filters['q'])) {
            $where[] = '(s.store_name LIKE :q OR s.store_slug LIKE :q OR u.email LIKE :q OR u.full_name LIKE :q)';
            $params['q'] = '%' . str_replace(['%', '_'], ['\\%', '\\_'], (string) $filters['q']) . '%';
        }

        if (!empty($filters['verification_status'])) {
            $where[] = 's.verification_status = :vs';
            $params['vs'] = (string) $filters['verification_status'];
        }

        if (!empty($filters['status'])) {
            $where[] = 's.status = :st';
            $params['st'] = (string) $filters['status'];
        }

        $whereSql = implode(' AND ', $where);
        [$limit, $offset] = $this->window($page, $perPage);

        $total = (int) $this->db->scalar(
            "SELECT COUNT(*) FROM seller_profiles s JOIN users u ON u.id = s.user_id WHERE {$whereSql}",
            $params,
        );

        $rows = $this->db->select(
            "SELECT s.id, s.user_id, s.store_name, s.store_slug, s.store_description, s.logo_url, s.banner_url,
                    s.business_category, s.verification_status, s.verification_notes, s.verified_at,
                    s.commission_rate, s.status, s.created_at,
                    u.full_name AS owner_name, u.email AS owner_email, u.phone AS owner_phone, u.status AS owner_status,
                    (SELECT COUNT(*) FROM products p WHERE p.seller_id = s.id AND p.deleted_at IS NULL) AS product_count
             FROM seller_profiles s
             JOIN users u ON u.id = s.user_id
             WHERE {$whereSql}
             ORDER BY s.created_at DESC, s.id DESC
             LIMIT {$limit} OFFSET {$offset}",
            $params,
        );

        return ['rows' => $rows, 'total' => $total];
    }

    public function countActive(): int
    {
        return (int) $this->db->scalar("SELECT COUNT(*) FROM seller_profiles WHERE status = 'active'");
    }

    public function countPendingVerification(): int
    {
        return (int) $this->db->scalar(
            "SELECT COUNT(*) FROM seller_profiles WHERE verification_status = 'pending'",
        );
    }

    public function countCreatedSince(string $sinceUtc): int
    {
        return (int) $this->db->scalar(
            'SELECT COUNT(*) FROM seller_profiles WHERE created_at >= :since',
            ['since' => $sinceUtc],
        );
    }
}
