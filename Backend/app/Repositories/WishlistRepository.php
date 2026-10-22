<?php

declare(strict_types=1);

namespace Shopio\Repositories;

/**
 * Wishlists (composite primary key user_id + product_id).
 */
final class WishlistRepository extends Repository
{
    public function add(int $userId, int $productId): void
    {
        $this->db->execute(
            'INSERT INTO wishlists (user_id, product_id) VALUES (:user_id, :product_id)
             ON DUPLICATE KEY UPDATE created_at = created_at',
            ['user_id' => $userId, 'product_id' => $productId],
        );
    }

    public function remove(int $userId, int $productId): bool
    {
        $statement = $this->db->execute(
            'DELETE FROM wishlists WHERE user_id = :user_id AND product_id = :product_id',
            ['user_id' => $userId, 'product_id' => $productId],
        );

        return $this->db->affectedRows($statement) > 0;
    }

    public function exists(int $userId, int $productId): bool
    {
        return $this->db->scalar(
            'SELECT 1 FROM wishlists WHERE user_id = :user_id AND product_id = :product_id LIMIT 1',
            ['user_id' => $userId, 'product_id' => $productId],
        ) !== null;
    }

    /**
     * @return array{rows:list<array<string,mixed>>,total:int}
     */
    public function paginateForUser(int $userId, int $page, int $perPage): array
    {
        [$limit, $offset] = $this->window($page, $perPage);

        $total = (int) $this->db->scalar('SELECT COUNT(*) FROM wishlists WHERE user_id = :user_id', ['user_id' => $userId]);

        $rows = $this->db->select(
            "SELECT w.product_id, w.created_at AS added_at,
                    p.name, p.slug, p.status AS product_status, p.deleted_at,
                    c.name AS category_name,
                    (SELECT MIN(v.price) FROM product_variants v WHERE v.product_id = p.id AND v.is_active = 1) AS min_price,
                    (SELECT MAX(v.price) FROM product_variants v WHERE v.product_id = p.id AND v.is_active = 1) AS max_price,
                    (SELECT COALESCE(SUM(GREATEST(i.quantity_on_hand - i.quantity_reserved, 0)), 0)
                       FROM product_variants v JOIN inventory i ON i.variant_id = v.id
                      WHERE v.product_id = p.id AND v.is_active = 1) AS available_stock,
                    (SELECT pi.image_url FROM product_images pi WHERE pi.product_id = p.id
                      ORDER BY pi.is_primary DESC, pi.sort_order ASC, pi.id ASC LIMIT 1) AS primary_image,
                    COALESCE(r.average_rating, 0.00) AS rating, COALESCE(r.review_count, 0) AS review_count
             FROM wishlists w
             JOIN products p ON p.id = w.product_id
             LEFT JOIN categories c ON c.id = p.category_id
             LEFT JOIN v_product_rating_summary r ON r.product_id = p.id
             WHERE w.user_id = :user_id
             ORDER BY w.created_at DESC
             LIMIT {$limit} OFFSET {$offset}",
            ['user_id' => $userId],
        );

        return ['rows' => $rows, 'total' => $total];
    }

    public function count(int $userId): int
    {
        return (int) $this->db->scalar('SELECT COUNT(*) FROM wishlists WHERE user_id = :user_id', ['user_id' => $userId]);
    }
}
