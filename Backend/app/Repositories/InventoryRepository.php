<?php

declare(strict_types=1);

namespace Shopio\Repositories;

/**
 * The single authoritative inventory workflow.
 *
 * INVARIANTS (enforced here and by the supplied triggers/constraints):
 *   1. `inventory.quantity_on_hand` is ONLY changed by inserting into
 *      `inventory_movements` — the supplied AFTER INSERT trigger applies the
 *      delta. PHP never issues `UPDATE inventory SET quantity_on_hand = ...`.
 *   2. `inventory.quantity_reserved` is a hold counter changed only through the
 *      guarded, conditional UPDATEs below, which are atomic at the row level
 *      (`... WHERE quantity_on_hand - quantity_reserved >= :qty`). That is what
 *      prevents overselling when two shoppers check out concurrently.
 *   3. Available stock is always `quantity_on_hand - quantity_reserved`
 *      (matching `fn_variant_available_stock`).
 *   4. Settling a hold = (a) decrease `quantity_reserved`, then (b) insert a
 *      `sale` movement. Order matters: the sale trigger rejects a sale that
 *      would push on-hand below the still-held quantity.
 *
 * `inventory_movements.release_reservation` is intentionally NOT used: it would
 * adjust `quantity_on_hand`, but under strategy (2)+(3) releasing a hold must
 * not change on-hand stock at all. Reservation lifecycle is persisted in
 * `stock_reservations` instead (see migration 0001).
 */
final class InventoryRepository extends Repository
{
    /**
     * @return array<string,mixed>|null
     */
    public function forVariant(int $variantId): ?array
    {
        return $this->db->selectOne(
            'SELECT variant_id, quantity_on_hand, quantity_reserved, low_stock_threshold, updated_at
             FROM inventory WHERE variant_id = :id LIMIT 1',
            ['id' => $variantId],
        );
    }

    /**
     * Adds stock through the movement ledger. `$delta` must be non-zero.
     */
    public function recordMovement(
        int $variantId,
        string $movementType,
        int $delta,
        ?int $changedBy = null,
        ?string $referenceType = null,
        ?int $referenceId = null,
        ?string $note = null,
    ): void {
        $this->db->execute(
            'INSERT INTO inventory_movements
                (variant_id, changed_by, movement_type, quantity_delta, reference_type, reference_id, note)
             VALUES
                (:variant_id, :changed_by, :movement_type, :delta, :reference_type, :reference_id, :note)',
            [
                'variant_id' => $variantId,
                'changed_by' => $changedBy,
                'movement_type' => $movementType,
                'delta' => $delta,
                'reference_type' => $referenceType,
                'reference_id' => $referenceId,
                'note' => $note,
            ],
        );
    }

    public function restock(int $variantId, int $quantity, int $actorId, ?string $note = null): void
    {
        $this->recordMovement($variantId, 'restock', $quantity, $actorId, 'manual', null, $note);
    }

    public function adjust(int $variantId, int $delta, int $actorId, ?string $note = null): void
    {
        $this->recordMovement($variantId, 'adjustment', $delta, $actorId, 'manual', null, $note);
    }

    public function setLowStockThreshold(int $variantId, int $threshold): void
    {
        $this->db->execute(
            'UPDATE inventory SET low_stock_threshold = :threshold WHERE variant_id = :id',
            ['threshold' => max(0, $threshold), 'id' => $variantId],
        );
    }

    /**
     * Atomically holds `$quantity` units. Returns false when not enough stock
     * is available — the conditional UPDATE is the concurrency guard.
     */
    public function hold(int $variantId, int $quantity): bool
    {
        if ($quantity <= 0) {
            return false;
        }

        $statement = $this->db->execute(
            'UPDATE inventory
             SET quantity_reserved = quantity_reserved + :qty
             WHERE variant_id = :id
               AND quantity_on_hand - quantity_reserved >= :qty2',
            ['qty' => $quantity, 'qty2' => $quantity, 'id' => $variantId],
        );

        return $this->db->affectedRows($statement) === 1;
    }

    /**
     * Releases a previously held quantity back to the available pool.
     */
    public function release(int $variantId, int $quantity): bool
    {
        if ($quantity <= 0) {
            return false;
        }

        $statement = $this->db->execute(
            'UPDATE inventory
             SET quantity_reserved = quantity_reserved - :qty
             WHERE variant_id = :id AND quantity_reserved >= :qty2',
            ['qty' => $quantity, 'qty2' => $quantity, 'id' => $variantId],
        );

        return $this->db->affectedRows($statement) === 1;
    }

    /**
     * Turns a hold into a real sale: releases the hold, then records the sale
     * movement (which decrements quantity_on_hand via the trigger).
     */
    public function settleHold(
        int $variantId,
        int $quantity,
        ?int $orderId = null,
        ?int $actorId = null,
    ): void {
        if (!$this->release($variantId, $quantity)) {
            // A missing hold must not silently become a free sale.
            throw new \RuntimeException('Reservation could not be released for variant ' . $variantId);
        }

        $this->recordMovement(
            $variantId,
            'sale',
            -$quantity,
            $actorId,
            $orderId === null ? null : 'order',
            $orderId,
            'Order settlement',
        );
    }

    /**
     * @param array<string,mixed> $filters
     * @return array{rows: list<array<string,mixed>>, total: int}
     */
    public function paginateForSeller(int $sellerId, array $filters, int $page, int $perPage): array
    {
        $where = ['p.seller_id = :seller_id', 'p.deleted_at IS NULL', 'v.is_active = 1'];
        $params = ['seller_id' => $sellerId];

        if (!empty($filters['q'])) {
            $where[] = '(p.name LIKE :q ESCAPE \'\\\\\' OR v.sku LIKE :q ESCAPE \'\\\\\')';
            $params['q'] = '%' . str_replace(['\\', '%', '_'], ['\\\\', '\\%', '\\_'], (string) $filters['q']) . '%';
        }

        if (!empty($filters['low_stock'])) {
            $where[] = 'i.quantity_on_hand - i.quantity_reserved <= i.low_stock_threshold';
        }

        $whereSql = implode(' AND ', $where);
        [$limit, $offset] = $this->window($page, $perPage);

        $rows = $this->db->select(
            "SELECT v.id AS variant_id, v.sku, v.variant_name, v.price, v.is_active,
                    p.id AS product_id, p.name AS product_name, p.status AS product_status,
                    COALESCE(i.quantity_on_hand, 0) AS quantity_on_hand,
                    COALESCE(i.quantity_reserved, 0) AS quantity_reserved,
                    COALESCE(i.quantity_on_hand - i.quantity_reserved, 0) AS available_stock,
                    COALESCE(i.low_stock_threshold, 5) AS low_stock_threshold
             FROM product_variants v
             JOIN products p ON p.id = v.product_id
             LEFT JOIN inventory i ON i.variant_id = v.id
             WHERE {$whereSql}
             ORDER BY i.quantity_on_hand - i.quantity_reserved ASC, p.name ASC
             LIMIT {$limit} OFFSET {$offset}",
            $params,
        );

        $total = (int) $this->db->scalar(
            "SELECT COUNT(*) FROM product_variants v
             JOIN products p ON p.id = v.product_id
             LEFT JOIN inventory i ON i.variant_id = v.id
             WHERE {$whereSql}",
            $params,
        );

        return ['rows' => $rows, 'total' => $total];
    }

    /**
     * @return list<array<string,mixed>>
     */
    public function movements(int $variantId, int $limit = 50): array
    {
        return $this->db->select(
            'SELECT m.id, m.variant_id, m.movement_type, m.quantity_delta, m.reference_type,
                    m.reference_id, m.note, m.created_at, u.full_name AS changed_by_name
             FROM inventory_movements m
             LEFT JOIN users u ON u.id = m.changed_by
             WHERE m.variant_id = :id
             ORDER BY m.id DESC
             LIMIT ' . max(1, min(200, $limit)),
            ['id' => $variantId],
        );
    }

    /**
     * Available stock total for a product across active variants.
     */
    public function availableForProduct(int $productId): int
    {
        return (int) $this->db->scalar(
            'SELECT COALESCE(SUM(GREATEST(i.quantity_on_hand - i.quantity_reserved, 0)), 0)
             FROM product_variants v JOIN inventory i ON i.variant_id = v.id
             WHERE v.product_id = :id AND v.is_active = 1',
            ['id' => $productId],
        );
    }

    public function variantBelongsToSeller(int $variantId, int $sellerId): bool
    {
        return $this->db->scalar(
            'SELECT 1 FROM product_variants v JOIN products p ON p.id = v.product_id
             WHERE v.id = :id AND p.seller_id = :seller_id LIMIT 1',
            ['id' => $variantId, 'seller_id' => $sellerId],
        ) !== null;
    }

    // -----------------------------------------------------------------------
    // Stock reservation ledger
    // -----------------------------------------------------------------------

    public function createReservation(
        int $orderId,
        int $orderItemId,
        int $variantId,
        int $quantity,
        string $expiresAtUtc,
    ): int {
        $this->db->execute(
            'INSERT INTO stock_reservations (variant_id, order_id, order_item_id, quantity, status, expires_at)
             VALUES (:variant_id, :order_id, :order_item_id, :quantity, \'held\', :expires_at)',
            [
                'variant_id' => $variantId,
                'order_id' => $orderId,
                'order_item_id' => $orderItemId,
                'quantity' => $quantity,
                'expires_at' => $expiresAtUtc,
            ],
        );

        return $this->db->lastInsertId();
    }

    /**
     * @return array<string,mixed>|null
     */
    public function findReservationForItem(int $orderItemId): ?array
    {
        return $this->db->selectOne(
            'SELECT id, variant_id, order_id, order_item_id, quantity, status, expires_at
             FROM stock_reservations WHERE order_item_id = :id LIMIT 1',
            ['id' => $orderItemId],
        );
    }

    /**
     * @return list<array<string,mixed>>
     */
    public function heldReservationsForOrder(int $orderId): array
    {
        return $this->db->select(
            "SELECT id, variant_id, order_item_id, quantity, expires_at
             FROM stock_reservations
             WHERE order_id = :order_id AND status = 'held'
             ORDER BY id",
            ['order_id' => $orderId],
        );
    }

    public function markReservation(int $reservationId, string $status): void
    {
        $this->db->execute(
            'UPDATE stock_reservations SET status = :status, resolved_at = UTC_TIMESTAMP()
             WHERE id = :id AND status = \'held\'',
            ['status' => $status, 'id' => $reservationId],
        );
    }

    /**
     * @return list<array<string,mixed>>
     */
    public function expiredReservations(int $limit = 200): array
    {
        return $this->db->select(
            "SELECT id, variant_id, order_id, order_item_id, quantity
             FROM stock_reservations
             WHERE status = 'held' AND expires_at < UTC_TIMESTAMP()
             ORDER BY expires_at ASC
             LIMIT " . max(1, min(1000, $limit)),
        );
    }

    /**
     * Locks a single reservation row (used by the expiry sweeper).
     *
     * @return array<string,mixed>|null
     */
    public function lockReservation(int $reservationId): ?array
    {
        return $this->db->selectOne(
            'SELECT id, variant_id, order_id, order_item_id, quantity, status
             FROM stock_reservations WHERE id = :id LIMIT 1 FOR UPDATE',
            ['id' => $reservationId],
        );
    }

    /**
     * @return array{variants:int,low_stock:int,out_of_stock:int}
     */
    public function summaryForSeller(int $sellerId): array
    {
        $row = $this->db->selectOne(
            'SELECT COUNT(*) AS variants,
                    SUM(CASE WHEN i.quantity_on_hand - i.quantity_reserved <= i.low_stock_threshold
                             AND i.quantity_on_hand - i.quantity_reserved > 0 THEN 1 ELSE 0 END) AS low_stock,
                    SUM(CASE WHEN i.quantity_on_hand - i.quantity_reserved <= 0 THEN 1 ELSE 0 END) AS out_of_stock
             FROM product_variants v
             JOIN products p ON p.id = v.product_id
             LEFT JOIN inventory i ON i.variant_id = v.id
             WHERE p.seller_id = :seller_id AND p.deleted_at IS NULL',
            ['seller_id' => $sellerId],
        );

        return [
            'variants' => (int) ($row['variants'] ?? 0),
            'low_stock' => (int) ($row['low_stock'] ?? 0),
            'out_of_stock' => (int) ($row['out_of_stock'] ?? 0),
        ];
    }
}
