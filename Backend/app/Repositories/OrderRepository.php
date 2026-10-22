<?php

declare(strict_types=1);

namespace Shopio\Repositories;

use Shopio\Support\Money;

/**
 * Orders, order item snapshots, adjustments and status history.
 *
 * Totals are never stored: they are derived from `order_items` +
 * `order_adjustments` through the supplied `v_order_totals` view / `fn_order_total`.
 */
final class OrderRepository extends Repository
{
    /**
     * Generates a human-readable, collision-resistant order number.
     */
    public function generateOrderNumber(): string
    {
        return 'SH-' . gmdate('Ymd') . '-' . strtoupper(bin2hex(random_bytes(4)));
    }

    /**
     * @param array<string,mixed> $data
     */
    public function create(array $data): int
    {
        $this->db->execute(
            'INSERT INTO orders
                (order_number, user_id, customer_email, customer_name, customer_phone, currency, status,
                 payment_status, fulfillment_status, shipping_address_line, shipping_district, shipping_city,
                 shipping_region, shipping_country_code, shipping_postal_code, shipping_instructions, customer_note,
                 placed_at)
             VALUES
                (:order_number, :user_id, :customer_email, :customer_name, :customer_phone, :currency, :status,
                 :payment_status, :fulfillment_status, :shipping_address_line, :shipping_district, :shipping_city,
                 :shipping_region, :shipping_country_code, :shipping_postal_code, :shipping_instructions, :customer_note,
                 UTC_TIMESTAMP())',
            [
                'order_number' => $data['order_number'],
                'user_id' => $data['user_id'],
                'customer_email' => $data['customer_email'],
                'customer_name' => $data['customer_name'],
                'customer_phone' => $data['customer_phone'],
                'currency' => $data['currency'] ?? 'TZS',
                'status' => $data['status'] ?? 'pending',
                'payment_status' => $data['payment_status'] ?? 'unpaid',
                'fulfillment_status' => $data['fulfillment_status'] ?? 'unfulfilled',
                'shipping_address_line' => $data['shipping_address_line'],
                'shipping_district' => $data['shipping_district'] ?? null,
                'shipping_city' => $data['shipping_city'],
                'shipping_region' => $data['shipping_region'],
                'shipping_country_code' => $data['shipping_country_code'] ?? 'TZ',
                'shipping_postal_code' => $data['shipping_postal_code'] ?? null,
                'shipping_instructions' => $data['shipping_instructions'] ?? null,
                'customer_note' => $data['customer_note'] ?? null,
            ],
        );

        return $this->db->lastInsertId();
    }

    /**
     * @return array<string,mixed>|null
     */
    public function findById(int $id): ?array
    {
        return $this->db->selectOne('SELECT * FROM orders WHERE id = :id LIMIT 1', ['id' => $id]);
    }

    /**
     * @return array<string,mixed>|null
     */
    public function findByIdForUser(int $id, int $userId): ?array
    {
        return $this->db->selectOne(
            'SELECT * FROM orders WHERE id = :id AND user_id = :user_id LIMIT 1',
            ['id' => $id, 'user_id' => $userId],
        );
    }

    /**
     * @return array<string,mixed>|null
     */
    public function findByNumber(string $orderNumber): ?array
    {
        return $this->db->selectOne('SELECT * FROM orders WHERE order_number = :n LIMIT 1', ['n' => $orderNumber]);
    }

    /**
     * @return array<string,mixed>|null
     */
    public function lockById(int $id): ?array
    {
        return $this->db->selectOne('SELECT * FROM orders WHERE id = :id LIMIT 1 FOR UPDATE', ['id' => $id]);
    }

    /**
     * Confirms a seller has at least one item in the order, then returns the
     * order. Avoids leaking the existence of other sellers' orders.
     *
     * @return array<string,mixed>|null
     */
    public function findForSeller(int $orderId, int $sellerId): ?array
    {
        return $this->db->selectOne(
            'SELECT o.* FROM orders o
             WHERE o.id = :id
               AND EXISTS (SELECT 1 FROM order_items oi WHERE oi.order_id = o.id AND oi.seller_id = :seller_id)
             LIMIT 1',
            ['id' => $orderId, 'seller_id' => $sellerId],
        );
    }

    /**
     * @return array<string,mixed>|null
     */
    public function totals(int $orderId): ?array
    {
        return $this->db->selectOne(
            'SELECT order_id, items_subtotal, items_discount, shipping_total, tax_total, other_adjustments, grand_total
             FROM v_order_totals WHERE order_id = :id LIMIT 1',
            ['id' => $orderId],
        );
    }

    /**
     * @return list<array<string,mixed>>
     */
    public function items(int $orderId): array
    {
        return $this->db->select(
            'SELECT oi.id, oi.order_id, oi.variant_id, oi.seller_id, oi.product_name_snapshot, oi.sku_snapshot,
                    oi.variant_snapshot, oi.image_url_snapshot, oi.quantity, oi.unit_price, oi.discount_amount,
                    oi.seller_commission_rate, oi.fulfillment_status, oi.created_at,
                    p.id AS product_id, p.slug AS product_slug, s.store_name AS seller_name
             FROM order_items oi
             LEFT JOIN product_variants v ON v.id = oi.variant_id
             LEFT JOIN products p ON p.id = v.product_id
             LEFT JOIN seller_profiles s ON s.id = oi.seller_id
             WHERE oi.order_id = :order_id
             ORDER BY oi.id ASC',
            ['order_id' => $orderId],
        );
    }

    /**
     * @return list<array<string,mixed>>
     */
    public function itemsForSeller(int $orderId, int $sellerId): array
    {
        return $this->db->select(
            'SELECT oi.id, oi.order_id, oi.variant_id, oi.seller_id, oi.product_name_snapshot, oi.sku_snapshot,
                    oi.variant_snapshot, oi.image_url_snapshot, oi.quantity, oi.unit_price, oi.discount_amount,
                    oi.seller_commission_rate, oi.fulfillment_status, oi.created_at,
                    p.id AS product_id, p.slug AS product_slug
             FROM order_items oi
             LEFT JOIN product_variants v ON v.id = oi.variant_id
             LEFT JOIN products p ON p.id = v.product_id
             WHERE oi.order_id = :order_id AND oi.seller_id = :seller_id
             ORDER BY oi.id ASC',
            ['order_id' => $orderId, 'seller_id' => $sellerId],
        );
    }

    /**
     * @return array<string,mixed>|null
     */
    public function itemByIdForSeller(int $itemId, int $sellerId): ?array
    {
        return $this->db->selectOne(
            'SELECT id, order_id, variant_id, seller_id, quantity, fulfillment_status
             FROM order_items WHERE id = :id AND seller_id = :seller_id LIMIT 1',
            ['id' => $itemId, 'seller_id' => $sellerId],
        );
    }

    /**
     * @param array<string,mixed> $data
     */
    public function createItem(array $data): int
    {
        $this->db->execute(
            'INSERT INTO order_items
                (order_id, variant_id, seller_id, product_name_snapshot, sku_snapshot, variant_snapshot,
                 image_url_snapshot, quantity, unit_price, discount_amount, seller_commission_rate, fulfillment_status)
             VALUES
                (:order_id, :variant_id, :seller_id, :product_name, :sku, :variant_name,
                 :image_url, :quantity, :unit_price, :discount_amount, :commission_rate, :fulfillment_status)',
            [
                'order_id' => (int) $data['order_id'],
                'variant_id' => $data['variant_id'],
                'seller_id' => $data['seller_id'],
                'product_name' => $data['product_name_snapshot'],
                'sku' => $data['sku_snapshot'],
                'variant_name' => $data['variant_snapshot'] ?? 'Default',
                'image_url' => $data['image_url_snapshot'] ?? null,
                'quantity' => (int) $data['quantity'],
                'unit_price' => (string) $data['unit_price'],
                'discount_amount' => (string) ($data['discount_amount'] ?? '0'),
                'commission_rate' => (string) $data['seller_commission_rate'],
                'fulfillment_status' => $data['fulfillment_status'] ?? 'unfulfilled',
            ],
        );

        return $this->db->lastInsertId();
    }

    public function setItemFulfillment(int $itemId, string $status): void
    {
        $this->db->execute(
            'UPDATE order_items SET fulfillment_status = :status WHERE id = :id',
            ['status' => $status, 'id' => $itemId],
        );
    }

    public function setItemFulfillmentForSeller(int $itemId, int $sellerId, string $status): bool
    {
        $statement = $this->db->execute(
            'UPDATE order_items SET fulfillment_status = :status WHERE id = :id AND seller_id = :seller_id',
            ['status' => $status, 'id' => $itemId, 'seller_id' => $sellerId],
        );

        return $this->db->affectedRows($statement) > 0;
    }

    /**
     * @param array<string,mixed> $data
     */
    public function createAdjustment(array $data): int
    {
        $this->db->execute(
            'INSERT INTO order_adjustments (order_id, adjustment_type, label, amount)
             VALUES (:order_id, :type, :label, :amount)',
            [
                'order_id' => (int) $data['order_id'],
                'type' => $data['adjustment_type'],
                'label' => $data['label'],
                'amount' => (string) $data['amount'],
            ],
        );

        return $this->db->lastInsertId();
    }

    /**
     * @return list<array<string,mixed>>
     */
    public function adjustments(int $orderId): array
    {
        return $this->db->select(
            'SELECT id, order_id, adjustment_type, label, amount, created_at
             FROM order_adjustments WHERE order_id = :order_id ORDER BY id ASC',
            ['order_id' => $orderId],
        );
    }

    public function addHistory(int $orderId, ?int $changedBy, ?string $oldStatus, string $newStatus, ?string $note): void
    {
        $this->db->execute(
            'INSERT INTO order_status_history (order_id, changed_by, old_status, new_status, note)
             VALUES (:order_id, :changed_by, :old_status, :new_status, :note)',
            [
                'order_id' => $orderId,
                'changed_by' => $changedBy,
                'old_status' => $oldStatus,
                'new_status' => $newStatus,
                'note' => $note,
            ],
        );
    }

    /**
     * @return list<array<string,mixed>>
     */
    public function history(int $orderId): array
    {
        return $this->db->select(
            'SELECT h.id, h.order_id, h.old_status, h.new_status, h.note, h.created_at,
                    u.full_name AS changed_by_name
             FROM order_status_history h
             LEFT JOIN users u ON u.id = h.changed_by
             WHERE h.order_id = :order_id
             ORDER BY h.id ASC',
            ['order_id' => $orderId],
        );
    }

    public function setStatus(int $orderId, string $status): void
    {
        $this->db->execute('UPDATE orders SET status = :status WHERE id = :id', ['status' => $status, 'id' => $orderId]);
    }

    public function setPaymentStatus(int $orderId, string $status): void
    {
        $this->db->execute(
            'UPDATE orders SET payment_status = :status WHERE id = :id',
            ['status' => $status, 'id' => $orderId],
        );
    }

    public function setFulfillmentStatus(int $orderId, string $status): void
    {
        $this->db->execute(
            'UPDATE orders SET fulfillment_status = :status WHERE id = :id',
            ['status' => $status, 'id' => $orderId],
        );
    }

    public function markConfirmed(int $orderId): void
    {
        $this->db->execute(
            "UPDATE orders SET status = 'confirmed', confirmed_at = UTC_TIMESTAMP() WHERE id = :id",
            ['id' => $orderId],
        );
    }

    public function markDelivered(int $orderId): void
    {
        $this->db->execute(
            "UPDATE orders SET status = 'delivered', delivered_at = UTC_TIMESTAMP(), fulfillment_status = 'fulfilled'
             WHERE id = :id",
            ['id' => $orderId],
        );
    }

    public function markCancelled(int $orderId): void
    {
        $this->db->execute(
            "UPDATE orders SET status = 'cancelled', cancelled_at = UTC_TIMESTAMP() WHERE id = :id",
            ['id' => $orderId],
        );
    }

    /**
     * @param array<string,mixed> $filters
     * @return array{rows:list<array<string,mixed>>,total:int}
     */
    public function paginateForUser(int $userId, array $filters, int $page, int $perPage): array
    {
        $where = ['o.user_id = :user_id'];
        $params = ['user_id' => $userId];

        if (!empty($filters['status'])) {
            $where[] = 'o.status = :status';
            $params['status'] = (string) $filters['status'];
        }

        if (!empty($filters['payment_status'])) {
            $where[] = 'o.payment_status = :payment_status';
            $params['payment_status'] = (string) $filters['payment_status'];
        }

        $whereSql = implode(' AND ', $where);
        [$limit, $offset] = $this->window($page, $perPage);

        $total = (int) $this->db->scalar("SELECT COUNT(*) FROM orders o WHERE {$whereSql}", $params);

        $rows = $this->db->select(
            "SELECT o.id, o.order_number, o.status, o.payment_status, o.fulfillment_status, o.currency,
                    o.customer_name, o.customer_email, o.placed_at, o.delivered_at,
                    COALESCE(t.grand_total, 0) AS grand_total,
                    COALESCE(t.items_subtotal, 0) AS items_subtotal,
                    (SELECT COUNT(*) FROM order_items oi WHERE oi.order_id = o.id) AS item_count
             FROM orders o
             LEFT JOIN v_order_totals t ON t.order_id = o.id
             WHERE {$whereSql}
             ORDER BY o.placed_at DESC, o.id DESC
             LIMIT {$limit} OFFSET {$offset}",
            $params,
        );

        return ['rows' => $rows, 'total' => $total];
    }

    /**
     * Orders containing at least one item belonging to the seller. Rows are the
     * order; only the seller's own items are returned by itemsForSeller().
     *
     * @param array<string,mixed> $filters
     * @return array{rows:list<array<string,mixed>>,total:int}
     */
    public function paginateForSeller(int $sellerId, array $filters, int $page, int $perPage): array
    {
        $where = ['EXISTS (SELECT 1 FROM order_items oi WHERE oi.order_id = o.id AND oi.seller_id = :seller_id)'];
        $params = ['seller_id' => $sellerId];

        if (!empty($filters['fulfillment_status'])) {
            $where[] = 'EXISTS (SELECT 1 FROM order_items oi2 WHERE oi2.order_id = o.id
                               AND oi2.seller_id = :seller_id2 AND oi2.fulfillment_status = :fulfillment_status)';
            $params['seller_id2'] = $sellerId;
            $params['fulfillment_status'] = (string) $filters['fulfillment_status'];
        }

        if (!empty($filters['status'])) {
            $where[] = 'o.status = :status';
            $params['status'] = (string) $filters['status'];
        }

        $whereSql = implode(' AND ', $where);
        [$limit, $offset] = $this->window($page, $perPage);

        $total = (int) $this->db->scalar("SELECT COUNT(*) FROM orders o WHERE {$whereSql}", $params);

        $rows = $this->db->select(
            "SELECT o.id, o.order_number, o.status, o.payment_status, o.fulfillment_status, o.currency,
                    o.customer_name, o.customer_email, o.customer_phone, o.placed_at,
                    o.shipping_city, o.shipping_region, o.shipping_address_line,
                    (SELECT COALESCE(SUM(oi.quantity * oi.unit_price - oi.discount_amount), 0)
                       FROM order_items oi WHERE oi.order_id = o.id AND oi.seller_id = :seller_id3) AS seller_subtotal,
                    (SELECT COUNT(*) FROM order_items oi WHERE oi.order_id = o.id AND oi.seller_id = :seller_id4) AS seller_item_count
             FROM orders o
             WHERE {$whereSql}
             ORDER BY o.placed_at DESC, o.id DESC
             LIMIT {$limit} OFFSET {$offset}",
            $params + ['seller_id3' => $sellerId, 'seller_id4' => $sellerId],
        );

        return ['rows' => $rows, 'total' => $total];
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
            $where[] = '(o.order_number LIKE :q ESCAPE \'\\\\\' OR o.customer_email LIKE :q ESCAPE \'\\\\\'
                         OR o.customer_name LIKE :q ESCAPE \'\\\\\')';
            $params['q'] = '%' . str_replace(['\\', '%', '_'], ['\\\\', '\\%', '\\_'], (string) $filters['q']) . '%';
        }

        if (!empty($filters['status'])) {
            $where[] = 'o.status = :status';
            $params['status'] = (string) $filters['status'];
        }

        if (!empty($filters['payment_status'])) {
            $where[] = 'o.payment_status = :payment_status';
            $params['payment_status'] = (string) $filters['payment_status'];
        }

        if (!empty($filters['seller_id'])) {
            $where[] = 'EXISTS (SELECT 1 FROM order_items oi WHERE oi.order_id = o.id AND oi.seller_id = :seller_id)';
            $params['seller_id'] = (int) $filters['seller_id'];
        }

        if (!empty($filters['date_from'])) {
            $where[] = 'o.placed_at >= :date_from';
            $params['date_from'] = (string) $filters['date_from'];
        }

        if (!empty($filters['date_to'])) {
            $where[] = 'o.placed_at <= :date_to';
            $params['date_to'] = (string) $filters['date_to'];
        }

        $whereSql = implode(' AND ', $where);
        [$limit, $offset] = $this->window($page, $perPage);

        $total = (int) $this->db->scalar("SELECT COUNT(*) FROM orders o WHERE {$whereSql}", $params);

        $rows = $this->db->select(
            "SELECT o.id, o.order_number, o.status, o.payment_status, o.fulfillment_status, o.currency,
                    o.customer_name, o.customer_email, o.placed_at, o.delivered_at, o.cancelled_at,
                    COALESCE(t.grand_total, 0) AS grand_total,
                    (SELECT COUNT(*) FROM order_items oi WHERE oi.order_id = o.id) AS item_count,
                    (SELECT COUNT(DISTINCT oi.seller_id) FROM order_items oi WHERE oi.order_id = o.id) AS seller_count
             FROM orders o
             LEFT JOIN v_order_totals t ON t.order_id = o.id
             WHERE {$whereSql}
             ORDER BY o.placed_at DESC, o.id DESC
             LIMIT {$limit} OFFSET {$offset}",
            $params,
        );

        return ['rows' => $rows, 'total' => $total];
    }

    public function countAll(): int
    {
        return (int) $this->db->scalar('SELECT COUNT(*) FROM orders');
    }

    public function countByStatus(string $status): int
    {
        return (int) $this->db->scalar('SELECT COUNT(*) FROM orders WHERE status = :status', ['status' => $status]);
    }

    public function countPlacedSince(string $sinceUtc): int
    {
        return (int) $this->db->scalar('SELECT COUNT(*) FROM orders WHERE placed_at >= :since', ['since' => $sinceUtc]);
    }

    public function revenueSince(?string $sinceUtc = null): string
    {
        $sql = "SELECT COALESCE(SUM(t.grand_total), 0) FROM orders o
                JOIN v_order_totals t ON t.order_id = o.id
                WHERE o.payment_status IN ('paid', 'partially_refunded')";
        $params = [];

        if ($sinceUtc !== null) {
            $sql .= ' AND o.placed_at >= :since';
            $params['since'] = $sinceUtc;
        }

        return Money::format((string) $this->db->scalar($sql, $params));
    }

    public function countPaidSince(string $sinceUtc): int
    {
        return (int) $this->db->scalar(
            "SELECT COUNT(*) FROM orders
             WHERE placed_at >= :since AND payment_status IN ('paid', 'partially_refunded')",
            ['since' => $sinceUtc],
        );
    }

    /**
     * Seller revenue = sum of the seller's own item totals on paid orders, for
     * orders that are not cancelled.
     */
    public function sellerRevenue(int $sellerId, ?string $sinceUtc = null): string
    {
        $sql = "SELECT COALESCE(SUM(oi.quantity * oi.unit_price - oi.discount_amount), 0)
                FROM order_items oi
                JOIN orders o ON o.id = oi.order_id
                WHERE oi.seller_id = :seller_id
                  AND o.payment_status IN ('paid', 'partially_refunded')
                  AND o.status <> 'cancelled'";
        $params = ['seller_id' => $sellerId];

        if ($sinceUtc !== null) {
            $sql .= ' AND o.placed_at >= :since';
            $params['since'] = $sinceUtc;
        }

        return Money::format((string) $this->db->scalar($sql, $params));
    }

    public function sellerOrderCount(int $sellerId): int
    {
        return (int) $this->db->scalar(
            'SELECT COUNT(DISTINCT oi.order_id) FROM order_items oi WHERE oi.seller_id = :seller_id',
            ['seller_id' => $sellerId],
        );
    }

    /**
     * Items eligible for payout: delivered, on a paid order, not cancelled, and
     * not already attached to a payout.
     *
     * @return list<array<string,mixed>>
     */
    public function payoutEligibleItems(int $sellerId): array
    {
        return $this->db->select(
            "SELECT oi.id AS order_item_id, oi.order_id, oi.quantity, oi.unit_price, oi.discount_amount,
                    oi.seller_commission_rate,
                    (oi.quantity * oi.unit_price - oi.discount_amount) AS gross,
                    ROUND((oi.quantity * oi.unit_price - oi.discount_amount) * oi.seller_commission_rate / 100, 2) AS commission,
                    (oi.quantity * oi.unit_price - oi.discount_amount)
                      - ROUND((oi.quantity * oi.unit_price - oi.discount_amount) * oi.seller_commission_rate / 100, 2) AS net
             FROM order_items oi
             JOIN orders o ON o.id = oi.order_id
             WHERE oi.seller_id = :seller_id
               AND oi.fulfillment_status = 'delivered'
               AND o.payment_status IN ('paid', 'partially_refunded')
               AND o.status NOT IN ('cancelled', 'refunded')
               AND NOT EXISTS (SELECT 1 FROM payout_items pi WHERE pi.order_item_id = oi.id)
             ORDER BY oi.id ASC",
            ['seller_id' => $sellerId],
        );
    }

    /**
     * Locks eligible payout items for a seller (prevents double payout under
     * concurrency). Must run inside a transaction.
     *
     * @return list<array<string,mixed>>
     */
    public function lockPayoutEligibleItems(int $sellerId): array
    {
        return $this->db->select(
            "SELECT oi.id AS order_item_id, oi.quantity, oi.unit_price, oi.discount_amount, oi.seller_commission_rate
             FROM order_items oi
             JOIN orders o ON o.id = oi.order_id
             WHERE oi.seller_id = :seller_id
               AND oi.fulfillment_status = 'delivered'
               AND o.payment_status IN ('paid', 'partially_refunded')
               AND o.status NOT IN ('cancelled', 'refunded')
               AND NOT EXISTS (SELECT 1 FROM payout_items pi WHERE pi.order_item_id = oi.id)
             ORDER BY oi.id ASC
             FOR UPDATE",
            ['seller_id' => $sellerId],
        );
    }

    /**
     * Total amount already refunded (or in flight) for an order.
     */
    public function refundedTotal(int $orderId): string
    {
        return Money::format((string) $this->db->scalar(
            "SELECT COALESCE(SUM(amount), 0) FROM refunds
             WHERE order_id = :order_id AND status IN ('approved', 'processing', 'succeeded')",
            ['order_id' => $orderId],
        ));
    }

    public function pendingRefundTotal(int $orderId): string
    {
        return Money::format((string) $this->db->scalar(
            "SELECT COALESCE(SUM(amount), 0) FROM refunds
             WHERE order_id = :order_id AND status = 'requested'",
            ['order_id' => $orderId],
        ));
    }

    public function sellerEarningsSummary(int $sellerId): array
    {
        $row = $this->db->selectOne(
            "SELECT
                COALESCE(SUM(CASE WHEN o.payment_status IN ('paid', 'partially_refunded') AND o.status NOT IN ('cancelled','refunded')
                    THEN (oi.quantity * oi.unit_price - oi.discount_amount)
                        - ROUND((oi.quantity * oi.unit_price - oi.discount_amount) * oi.seller_commission_rate / 100, 2)
                    ELSE 0 END), 0) AS earned_net,
                COALESCE(SUM(CASE WHEN o.payment_status IN ('paid', 'partially_refunded') AND o.status NOT IN ('cancelled','refunded')
                    THEN ROUND((oi.quantity * oi.unit_price - oi.discount_amount) * oi.seller_commission_rate / 100, 2)
                    ELSE 0 END), 0) AS commission_total,
                COALESCE(SUM(CASE WHEN oi.fulfillment_status = 'delivered'
                        AND o.payment_status IN ('paid','partially_refunded') AND o.status NOT IN ('cancelled','refunded')
                        AND NOT EXISTS (SELECT 1 FROM payout_items pi WHERE pi.order_item_id = oi.id)
                    THEN (oi.quantity * oi.unit_price - oi.discount_amount)
                        - ROUND((oi.quantity * oi.unit_price - oi.discount_amount) * oi.seller_commission_rate / 100, 2)
                    ELSE 0 END), 0) AS available_for_payout,
                COALESCE(SUM(CASE WHEN o.payment_status IN ('paid', 'partially_refunded') THEN oi.quantity ELSE 0 END), 0) AS units_sold
             FROM order_items oi
             JOIN orders o ON o.id = oi.order_id
             WHERE oi.seller_id = :seller_id",
            ['seller_id' => $sellerId],
        );

        return [
            'earned_net' => Money::format((string) ($row['earned_net'] ?? '0')),
            'commission_total' => Money::format((string) ($row['commission_total'] ?? '0')),
            'available_for_payout' => Money::format((string) ($row['available_for_payout'] ?? '0')),
            'units_sold' => (int) ($row['units_sold'] ?? 0),
        ];
    }
}
