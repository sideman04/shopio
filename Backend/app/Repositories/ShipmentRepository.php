<?php

declare(strict_types=1);

namespace Shopio\Repositories;

/**
 * Shipments for an order (one order may be split across several shipments).
 */
final class ShipmentRepository extends Repository
{
    public function create(
        int $orderId,
        ?string $carrier,
        ?string $serviceName,
        ?string $trackingNumber,
        string $status,
        string $shippingCost = '0',
        ?string $trackingUrl = null,
    ): int {
        $this->db->execute(
            'INSERT INTO shipments
                (order_id, carrier, service_name, tracking_number, status, shipping_cost, tracking_url,
                 shipped_at)
             VALUES
                (:order_id, :carrier, :service, :tracking, :status, :cost, :url,
                 CASE WHEN :status2 IN (\'shipped\', \'in_transit\', \'delivered\') THEN UTC_TIMESTAMP() ELSE NULL END)',
            [
                'order_id' => $orderId,
                'carrier' => $carrier,
                'service' => $serviceName,
                'tracking' => $trackingNumber,
                'status' => $status,
                'status2' => $status,
                'cost' => $shippingCost,
                'url' => $trackingUrl,
            ],
        );

        return $this->db->lastInsertId();
    }

    /**
     * @return list<array<string,mixed>>
     */
    public function forOrder(int $orderId): array
    {
        return $this->db->select(
            'SELECT id, order_id, carrier, service_name, tracking_number, status, shipping_cost,
                    shipped_at, delivered_at, tracking_url, created_at, updated_at
             FROM shipments WHERE order_id = :order_id ORDER BY id ASC',
            ['order_id' => $orderId],
        );
    }

    /**
     * @return array<string,mixed>|null
     */
    public function findById(int $id): ?array
    {
        return $this->db->selectOne('SELECT * FROM shipments WHERE id = :id LIMIT 1', ['id' => $id]);
    }

    public function updateStatus(int $id, string $status): void
    {
        $this->db->execute(
            "UPDATE shipments
             SET status = :status,
                 shipped_at = CASE WHEN :status2 IN ('shipped', 'in_transit', 'delivered')
                                   THEN COALESCE(shipped_at, UTC_TIMESTAMP()) ELSE shipped_at END,
                 delivered_at = CASE WHEN :status3 = 'delivered' THEN COALESCE(delivered_at, UTC_TIMESTAMP())
                                     ELSE delivered_at END
             WHERE id = :id",
            ['status' => $status, 'status2' => $status, 'status3' => $status, 'id' => $id],
        );
    }

    /**
     * @return array{total:int,delivered:int,in_transit:int,pending:int}
     */
    public function summaryForSeller(int $sellerId): array
    {
        $row = $this->db->selectOne(
            "SELECT COUNT(*) AS total,
                    SUM(CASE WHEN sh.status = 'delivered' THEN 1 ELSE 0 END) AS delivered,
                    SUM(CASE WHEN sh.status IN ('shipped', 'in_transit') THEN 1 ELSE 0 END) AS in_transit,
                    SUM(CASE WHEN sh.status IN ('pending', 'packed') THEN 1 ELSE 0 END) AS pending
             FROM shipments sh
             WHERE sh.order_id IN (SELECT DISTINCT oi.order_id FROM order_items oi WHERE oi.seller_id = :seller_id)",
            ['seller_id' => $sellerId],
        );

        return [
            'total' => (int) ($row['total'] ?? 0),
            'delivered' => (int) ($row['delivered'] ?? 0),
            'in_transit' => (int) ($row['in_transit'] ?? 0),
            'pending' => (int) ($row['pending'] ?? 0),
        ];
    }
}
