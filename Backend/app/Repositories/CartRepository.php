<?php

declare(strict_types=1);

namespace Shopio\Repositories;

/**
 * Persistent carts (schema table `carts` + `cart_items`).
 *
 * A cart is always resolved from the authenticated user; a cart id supplied by a
 * client is never trusted. `session_token_hash` supports guest carts, but guest
 * carts are only usable with the matching session token hash.
 */
final class CartRepository extends Repository
{
    /**
     * @return array<string,mixed>|null
     */
    public function activeForUser(int $userId): ?array
    {
        return $this->db->selectOne(
            "SELECT id, user_id, status, expires_at, created_at, updated_at
             FROM carts WHERE user_id = :user_id AND status = 'active'
             ORDER BY id DESC LIMIT 1",
            ['user_id' => $userId],
        );
    }

    /**
     * @return array<string,mixed>|null
     */
    public function activeForSession(string $sessionTokenHash): ?array
    {
        return $this->db->selectOne(
            "SELECT id, user_id, status, expires_at, created_at, updated_at
             FROM carts WHERE session_token_hash = :hash AND status = 'active'
             ORDER BY id DESC LIMIT 1",
            ['hash' => $sessionTokenHash],
        );
    }

    public function createForUser(int $userId, string $expiresAtUtc): int
    {
        $this->db->execute(
            "INSERT INTO carts (user_id, status, expires_at) VALUES (:user_id, 'active', :expires_at)",
            ['user_id' => $userId, 'expires_at' => $expiresAtUtc],
        );

        return $this->db->lastInsertId();
    }

    public function createForSession(string $sessionTokenHash, string $expiresAtUtc): int
    {
        $this->db->execute(
            "INSERT INTO carts (session_token_hash, status, expires_at)
             VALUES (:hash, 'active', :expires_at)",
            ['hash' => $sessionTokenHash, 'expires_at' => $expiresAtUtc],
        );

        return $this->db->lastInsertId();
    }

    /**
     * Resolves a cart for a user, creating it on demand.
     */
    public function resolveForUser(int $userId, string $expiresAtUtc): int
    {
        $existing = $this->activeForUser($userId);
        if ($existing !== null) {
            return (int) $existing['id'];
        }

        return $this->createForUser($userId, $expiresAtUtc);
    }

    /**
     * @return array<string,mixed>|null
     */
    public function find(int $cartId): ?array
    {
        return $this->db->selectOne(
            'SELECT id, user_id, session_token_hash, status, expires_at FROM carts WHERE id = :id LIMIT 1',
            ['id' => $cartId],
        );
    }

    /**
     * Cart items with the live catalogue data needed to price them. Includes
     * products the seller has since unlisted so the cart can explain why.
     *
     * @return list<array<string,mixed>>
     */
    public function items(int $cartId): array
    {
        return $this->db->select(
            'SELECT ci.id, ci.cart_id, ci.variant_id, ci.quantity, ci.created_at, ci.updated_at,
                    v.sku, v.variant_name, v.price, v.compare_at_price, v.is_active AS variant_is_active,
                    COALESCE(i.quantity_on_hand - i.quantity_reserved, 0) AS available_stock,
                    p.id AS product_id, p.name AS product_name, p.slug AS product_slug,
                    p.status AS product_status, p.deleted_at AS product_deleted_at, p.currency,
                    p.seller_id, s.store_name AS seller_name, s.status AS seller_status,
                    s.verification_status AS seller_verification_status,
                    (SELECT pi.image_url FROM product_images pi WHERE pi.product_id = p.id
                      ORDER BY pi.is_primary DESC, pi.sort_order ASC, pi.id ASC LIMIT 1) AS primary_image
             FROM cart_items ci
             JOIN product_variants v ON v.id = ci.variant_id
             JOIN products p ON p.id = v.product_id
             JOIN seller_profiles s ON s.id = p.seller_id
             LEFT JOIN inventory i ON i.variant_id = v.id
             WHERE ci.cart_id = :cart_id
             ORDER BY ci.id ASC',
            ['cart_id' => $cartId],
        );
    }

    /**
     * @return array<string,mixed>|null
     */
    public function findItem(int $cartId, int $variantId): ?array
    {
        return $this->db->selectOne(
            'SELECT id, cart_id, variant_id, quantity FROM cart_items
             WHERE cart_id = :cart_id AND variant_id = :variant_id LIMIT 1',
            ['cart_id' => $cartId, 'variant_id' => $variantId],
        );
    }

    /**
     * @return array<string,mixed>|null
     */
    public function findItemById(int $cartId, int $itemId): ?array
    {
        return $this->db->selectOne(
            'SELECT id, cart_id, variant_id, quantity FROM cart_items
             WHERE id = :id AND cart_id = :cart_id LIMIT 1',
            ['id' => $itemId, 'cart_id' => $cartId],
        );
    }

    public function addOrIncrement(int $cartId, int $variantId, int $quantity): void
    {
        $this->db->execute(
            'INSERT INTO cart_items (cart_id, variant_id, quantity)
             VALUES (:cart_id, :variant_id, :quantity)
             ON DUPLICATE KEY UPDATE quantity = quantity + VALUES(quantity)',
            ['cart_id' => $cartId, 'variant_id' => $variantId, 'quantity' => $quantity],
        );
    }

    public function setQuantity(int $itemId, int $cartId, int $quantity): bool
    {
        $statement = $this->db->execute(
            'UPDATE cart_items SET quantity = :quantity WHERE id = :id AND cart_id = :cart_id',
            ['quantity' => $quantity, 'id' => $itemId, 'cart_id' => $cartId],
        );

        return $this->db->affectedRows($statement) > 0;
    }

    public function removeItem(int $itemId, int $cartId): bool
    {
        $statement = $this->db->execute(
            'DELETE FROM cart_items WHERE id = :id AND cart_id = :cart_id',
            ['id' => $itemId, 'cart_id' => $cartId],
        );

        return $this->db->affectedRows($statement) > 0;
    }

    public function clear(int $cartId): int
    {
        return $this->db->affectedRows($this->db->execute(
            'DELETE FROM cart_items WHERE cart_id = :cart_id',
            ['cart_id' => $cartId],
        ));
    }

    public function touch(int $cartId): void
    {
        $this->db->execute('UPDATE carts SET updated_at = CURRENT_TIMESTAMP WHERE id = :id', ['id' => $cartId]);
    }

    public function markConverted(int $cartId): void
    {
        $this->db->execute(
            "UPDATE carts SET status = 'converted' WHERE id = :id AND status = 'active'",
            ['id' => $cartId],
        );
    }

    public function countItems(int $cartId): int
    {
        return (int) $this->db->scalar('SELECT COUNT(*) FROM cart_items WHERE cart_id = :cart_id', ['cart_id' => $cartId]);
    }

    /**
     * Total quantity of a cart (used to build the order snapshot).
     */
    public function totalQuantity(int $cartId): int
    {
        return (int) $this->db->scalar(
            'SELECT COALESCE(SUM(quantity), 0) FROM cart_items WHERE cart_id = :cart_id',
            ['cart_id' => $cartId],
        );
    }

    /**
     * Merges a guest cart's items into a user's cart after login, de-duplicating
     * on variant and summing quantities.
     */
    public function mergeItems(int $fromCartId, int $toCartId): void
    {
        $items = $this->db->select(
            'SELECT variant_id, quantity FROM cart_items WHERE cart_id = :cart_id',
            ['cart_id' => $fromCartId],
        );

        foreach ($items as $item) {
            $this->addOrIncrement($toCartId, (int) $item['variant_id'], (int) $item['quantity']);
        }

        $this->clear($fromCartId);
        $this->db->execute(
            "UPDATE carts SET status = 'abandoned' WHERE id = :id",
            ['id' => $fromCartId],
        );
    }
}
