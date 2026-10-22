<?php

declare(strict_types=1);

namespace Shopio\Repositories;

/**
 * Promotional banners.
 */
final class BannerRepository extends Repository
{
    /**
     * Banners eligible for public display: active and inside their date window.
     *
     * @return list<array<string,mixed>>
     */
    public function publicList(?string $placement = null): array
    {
        $sql = "SELECT id, title, subtitle, image_url, button_text, target_url, placement, starts_at, ends_at, sort_order, status
                FROM promotional_banners
                WHERE status = 'active'
                  AND (starts_at IS NULL OR starts_at <= UTC_TIMESTAMP())
                  AND (ends_at IS NULL OR ends_at >= UTC_TIMESTAMP())";
        $params = [];

        if ($placement !== null && in_array($placement, ['home_hero', 'home_promo', 'category', 'other'], true)) {
            $sql .= ' AND placement = :placement';
            $params['placement'] = $placement;
        }

        $sql .= ' ORDER BY sort_order ASC, id ASC LIMIT 50';

        return $this->db->select($sql, $params);
    }

    /**
     * @return array<string,mixed>|null
     */
    public function findById(int $id): ?array
    {
        return $this->db->selectOne('SELECT * FROM promotional_banners WHERE id = :id LIMIT 1', ['id' => $id]);
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
            $where[] = 'status = :status';
            $params['status'] = (string) $filters['status'];
        }

        if (!empty($filters['placement'])) {
            $where[] = 'placement = :placement';
            $params['placement'] = (string) $filters['placement'];
        }

        $whereSql = implode(' AND ', $where);
        [$limit, $offset] = $this->window($page, $perPage);

        $total = (int) $this->db->scalar("SELECT COUNT(*) FROM promotional_banners WHERE {$whereSql}", $params);

        $rows = $this->db->select(
            "SELECT id, title, subtitle, image_url, button_text, target_url, placement, starts_at, ends_at,
                    sort_order, status, created_at, updated_at
             FROM promotional_banners
             WHERE {$whereSql}
             ORDER BY sort_order ASC, id DESC
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
            'INSERT INTO promotional_banners
                (title, subtitle, image_url, button_text, target_url, placement, starts_at, ends_at, sort_order, status, created_by)
             VALUES
                (:title, :subtitle, :image_url, :button_text, :target_url, :placement, :starts_at, :ends_at, :sort_order, :status, :created_by)',
            [
                'title' => $data['title'],
                'subtitle' => $data['subtitle'] ?? null,
                'image_url' => $data['image_url'] ?? null,
                'button_text' => $data['button_text'] ?? null,
                'target_url' => $data['target_url'] ?? null,
                'placement' => $data['placement'] ?? 'home_promo',
                'starts_at' => $data['starts_at'] ?? null,
                'ends_at' => $data['ends_at'] ?? null,
                'sort_order' => (int) ($data['sort_order'] ?? 0),
                'status' => $data['status'] ?? 'draft',
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
            'title', 'subtitle', 'image_url', 'button_text', 'target_url', 'placement',
            'starts_at', 'ends_at', 'sort_order', 'status',
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

        $this->db->execute('UPDATE promotional_banners SET ' . implode(', ', $sets) . ' WHERE id = :id', $params);
    }

    public function delete(int $id): bool
    {
        return $this->db->affectedRows($this->db->execute(
            'DELETE FROM promotional_banners WHERE id = :id',
            ['id' => $id],
        )) > 0;
    }
}
