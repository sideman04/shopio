<?php

declare(strict_types=1);

namespace Shopio\Repositories;

use Shopio\Support\Money;

/**
 * Seller payout requests and the order items they settle.
 */
final class PayoutRepository extends Repository
{
    public function generateReference(): string
    {
        return 'PO-' . gmdate('Ymd') . '-' . strtoupper(bin2hex(random_bytes(4)));
    }

    public function create(
        int $sellerId,
        string $reference,
        string $amount,
        string $currency,
        ?string $payoutMethod,
        ?string $destinationLabel,
        string $status = 'requested',
    ): int {
        $this->db->execute(
            'INSERT INTO seller_payouts
                (seller_id, payout_reference, amount, currency, payout_method, destination_label, status, requested_at)
             VALUES
                (:seller_id, :reference, :amount, :currency, :method, :destination, :status, UTC_TIMESTAMP())',
            [
                'seller_id' => $sellerId,
                'reference' => $reference,
                'amount' => $amount,
                'currency' => $currency,
                'method' => $payoutMethod,
                'destination' => $destinationLabel,
                'status' => $status,
            ],
        );

        return $this->db->lastInsertId();
    }

    public function addItem(int $payoutId, int $orderItemId, string $amount): void
    {
        $this->db->execute(
            'INSERT INTO payout_items (payout_id, order_item_id, amount)
             VALUES (:payout_id, :order_item_id, :amount)
             ON DUPLICATE KEY UPDATE amount = VALUES(amount)',
            ['payout_id' => $payoutId, 'order_item_id' => $orderItemId, 'amount' => $amount],
        );
    }

    /**
     * @return array<string,mixed>|null
     */
    public function findById(int $id): ?array
    {
        return $this->db->selectOne('SELECT * FROM seller_payouts WHERE id = :id LIMIT 1', ['id' => $id]);
    }

    /**
     * @return array<string,mixed>|null
     */
    public function findByIdForSeller(int $id, int $sellerId): ?array
    {
        return $this->db->selectOne(
            'SELECT * FROM seller_payouts WHERE id = :id AND seller_id = :seller_id LIMIT 1',
            ['id' => $id, 'seller_id' => $sellerId],
        );
    }

    /**
     * @return array<string,mixed>|null
     */
    public function lockById(int $id): ?array
    {
        return $this->db->selectOne('SELECT * FROM seller_payouts WHERE id = :id LIMIT 1 FOR UPDATE', ['id' => $id]);
    }

    /**
     * @return list<array<string,mixed>>
     */
    public function items(int $payoutId): array
    {
        return $this->db->select(
            'SELECT pi.order_item_id, pi.amount, oi.order_id, oi.product_name_snapshot, oi.sku_snapshot, oi.quantity
             FROM payout_items pi
             JOIN order_items oi ON oi.id = pi.order_item_id
             WHERE pi.payout_id = :payout_id
             ORDER BY pi.order_item_id',
            ['payout_id' => $payoutId],
        );
    }

    /**
     * @return array{rows:list<array<string,mixed>>,total:int}
     */
    public function paginateForSeller(int $sellerId, int $page, int $perPage): array
    {
        [$limit, $offset] = $this->window($page, $perPage);

        $total = (int) $this->db->scalar('SELECT COUNT(*) FROM seller_payouts WHERE seller_id = :seller_id', ['seller_id' => $sellerId]);

        $rows = $this->db->select(
            "SELECT p.id, p.seller_id, p.payout_reference, p.amount, p.currency, p.payout_method,
                    p.destination_label, p.status, p.requested_at, p.processed_at, p.admin_note,
                    (SELECT COUNT(*) FROM payout_items pi WHERE pi.payout_id = p.id) AS item_count
             FROM seller_payouts p
             WHERE p.seller_id = :seller_id
             ORDER BY p.requested_at DESC, p.id DESC
             LIMIT {$limit} OFFSET {$offset}",
            ['seller_id' => $sellerId],
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

        if (!empty($filters['status'])) {
            $where[] = 'p.status = :status';
            $params['status'] = (string) $filters['status'];
        }

        if (!empty($filters['seller_id'])) {
            $where[] = 'p.seller_id = :seller_id';
            $params['seller_id'] = (int) $filters['seller_id'];
        }

        if (!empty($filters['q'])) {
            $where[] = '(p.payout_reference LIKE :q ESCAPE \'\\\\\' OR s.store_name LIKE :q ESCAPE \'\\\\\')';
            $params['q'] = '%' . str_replace(['\\', '%', '_'], ['\\\\', '\\%', '\\_'], (string) $filters['q']) . '%';
        }

        $whereSql = implode(' AND ', $where);
        [$limit, $offset] = $this->window($page, $perPage);

        $total = (int) $this->db->scalar(
            "SELECT COUNT(*) FROM seller_payouts p JOIN seller_profiles s ON s.id = p.seller_id WHERE {$whereSql}",
            $params,
        );

        $rows = $this->db->select(
            "SELECT p.id, p.seller_id, p.payout_reference, p.amount, p.currency, p.payout_method,
                    p.destination_label, p.status, p.requested_at, p.processed_at, p.processed_by,
                    p.provider_reference, p.admin_note, s.store_name AS seller_name,
                    u.full_name AS processed_by_name,
                    (SELECT COUNT(*) FROM payout_items pi WHERE pi.payout_id = p.id) AS item_count
             FROM seller_payouts p
             JOIN seller_profiles s ON s.id = p.seller_id
             LEFT JOIN users u ON u.id = p.processed_by
             WHERE {$whereSql}
             ORDER BY p.requested_at DESC, p.id DESC
             LIMIT {$limit} OFFSET {$offset}",
            $params,
        );

        return ['rows' => $rows, 'total' => $total];
    }

    public function updateStatus(
        int $id,
        string $status,
        ?int $processedBy = null,
        ?string $providerReference = null,
        ?string $adminNote = null,
    ): void {
        $this->db->execute(
            "UPDATE seller_payouts
             SET status = :status,
                 processed_by = COALESCE(:processed_by, processed_by),
                 provider_reference = COALESCE(:reference, provider_reference),
                 admin_note = COALESCE(:note, admin_note),
                 processed_at = CASE WHEN :status2 IN ('paid', 'rejected', 'failed') THEN UTC_TIMESTAMP() ELSE processed_at END
             WHERE id = :id",
            [
                'status' => $status,
                'status2' => $status,
                'processed_by' => $processedBy,
                'reference' => $providerReference,
                'note' => $adminNote,
                'id' => $id,
            ],
        );
    }

    public function requestedTotal(int $sellerId): string
    {
        return Money::format((string) $this->db->scalar(
            "SELECT COALESCE(SUM(amount), 0) FROM seller_payouts
             WHERE seller_id = :seller_id AND status IN ('requested', 'pending', 'processing')",
            ['seller_id' => $sellerId],
        ));
    }

    public function paidTotal(int $sellerId): string
    {
        return Money::format((string) $this->db->scalar(
            "SELECT COALESCE(SUM(amount), 0) FROM seller_payouts
             WHERE seller_id = :seller_id AND status = 'paid'",
            ['seller_id' => $sellerId],
        ));
    }

    public function pendingCount(): int
    {
        return (int) $this->db->scalar(
            "SELECT COUNT(*) FROM seller_payouts WHERE status IN ('requested', 'pending', 'processing')",
        );
    }

    /**
     * @return list<array<string,mixed>>
     */
    public function recentForSeller(int $sellerId, int $limit = 5): array
    {
        return $this->db->select(
            'SELECT * FROM seller_payouts WHERE seller_id = :seller_id
             ORDER BY requested_at DESC LIMIT ' . max(1, min(50, $limit)),
            ['seller_id' => $sellerId],
        );
    }
}
