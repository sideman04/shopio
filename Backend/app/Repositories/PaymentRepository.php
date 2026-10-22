<?php

declare(strict_types=1);

namespace Shopio\Repositories;

use Shopio\Support\Money;

/**
 * Payment records. Provider payloads are stored as JSON for reconciliation, but
 * only provider-verified data is ever trusted.
 */
final class PaymentRepository extends Repository
{
    /**
     * @param array<string,mixed>|null $payload
     */
    public function create(
        int $orderId,
        string $provider,
        string $amount,
        string $currency,
        string $status = 'initiated',
        ?string $idempotencyKey = null,
        ?string $providerReference = null,
        ?string $paymentMethod = null,
        ?array $payload = null,
    ): int {
        $this->db->execute(
            'INSERT INTO payments
                (order_id, provider, provider_reference, idempotency_key, amount, currency, status, payment_method, provider_payload)
             VALUES
                (:order_id, :provider, :provider_reference, :idempotency_key, :amount, :currency, :status, :payment_method, :payload)',
            [
                'order_id' => $orderId,
                'provider' => $provider,
                'provider_reference' => $providerReference,
                'idempotency_key' => $idempotencyKey,
                'amount' => $amount,
                'currency' => $currency,
                'status' => $status,
                'payment_method' => $paymentMethod,
                'payload' => $payload === null ? null : json_encode($payload, JSON_UNESCAPED_SLASHES | JSON_INVALID_UTF8_SUBSTITUTE),
            ],
        );

        return $this->db->lastInsertId();
    }

    /**
     * @return array<string,mixed>|null
     */
    public function findById(int $id): ?array
    {
        return $this->db->selectOne('SELECT * FROM payments WHERE id = :id LIMIT 1', ['id' => $id]);
    }

    /**
     * @return array<string,mixed>|null
     */
    public function lockById(int $id): ?array
    {
        return $this->db->selectOne('SELECT * FROM payments WHERE id = :id LIMIT 1 FOR UPDATE', ['id' => $id]);
    }

    /**
     * @return array<string,mixed>|null
     */
    public function latestForOrder(int $orderId): ?array
    {
        return $this->db->selectOne(
            'SELECT * FROM payments WHERE order_id = :order_id ORDER BY id DESC LIMIT 1',
            ['order_id' => $orderId],
        );
    }

    /**
     * @return list<array<string,mixed>>
     */
    public function allForOrder(int $orderId): array
    {
        return $this->db->select(
            'SELECT id, order_id, provider, provider_reference, amount, currency, status, payment_method,
                    paid_at, failure_code, created_at
             FROM payments WHERE order_id = :order_id ORDER BY id ASC',
            ['order_id' => $orderId],
        );
    }

    /**
     * @return array<string,mixed>|null
     */
    public function findByProviderReference(string $provider, string $reference): ?array
    {
        return $this->db->selectOne(
            'SELECT * FROM payments WHERE provider = :provider AND provider_reference = :reference ORDER BY id DESC LIMIT 1',
            ['provider' => $provider, 'reference' => $reference],
        );
    }

    /**
     * @return array<string,mixed>|null
     */
    public function findByIdempotencyKey(string $key): ?array
    {
        return $this->db->selectOne('SELECT * FROM payments WHERE idempotency_key = :key LIMIT 1', ['key' => $key]);
    }

    /**
     * @param array<string,mixed>|null $payload
     */
    public function markSucceeded(int $id, ?string $providerReference, ?string $paymentMethod, ?array $payload = null): bool
    {
        $statement = $this->db->execute(
            "UPDATE payments
             SET status = 'succeeded', provider_reference = COALESCE(:reference, provider_reference),
                 payment_method = COALESCE(:method, payment_method), paid_at = UTC_TIMESTAMP(),
                 failure_code = NULL, failure_message = NULL,
                 provider_payload = COALESCE(:payload, provider_payload)
             WHERE id = :id AND status IN ('initiated', 'pending')",
            [
                'reference' => $providerReference,
                'method' => $paymentMethod,
                'payload' => $payload === null ? null : json_encode($payload, JSON_UNESCAPED_SLASHES | JSON_INVALID_UTF8_SUBSTITUTE),
                'id' => $id,
            ],
        );

        return $this->db->affectedRows($statement) === 1;
    }

    /**
     * @param array<string,mixed>|null $payload
     */
    public function markFailed(int $id, ?string $code, ?string $message, ?array $payload = null): bool
    {
        $statement = $this->db->execute(
            "UPDATE payments
             SET status = 'failed', failure_code = :code, failure_message = :message,
                 provider_payload = COALESCE(:payload, provider_payload)
             WHERE id = :id AND status IN ('initiated', 'pending')",
            [
                'code' => $code,
                'message' => $message === null ? null : mb_substr($message, 0, 500),
                'payload' => $payload === null ? null : json_encode($payload, JSON_UNESCAPED_SLASHES | JSON_INVALID_UTF8_SUBSTITUTE),
                'id' => $id,
            ],
        );

        return $this->db->affectedRows($statement) === 1;
    }

    public function updateStatus(int $id, string $status): void
    {
        $this->db->execute('UPDATE payments SET status = :status WHERE id = :id', ['status' => $status, 'id' => $id]);
    }

    public function succeededTotal(int $orderId): string
    {
        return Money::format((string) $this->db->scalar(
            "SELECT COALESCE(SUM(amount), 0) FROM payments WHERE order_id = :order_id AND status = 'succeeded'",
            ['order_id' => $orderId],
        ));
    }

    public function hasSucceeded(int $orderId): bool
    {
        return $this->db->scalar(
            "SELECT 1 FROM payments WHERE order_id = :order_id AND status = 'succeeded' LIMIT 1",
            ['order_id' => $orderId],
        ) !== null;
    }

    public function latestSucceededForOrder(int $orderId): ?array
    {
        return $this->db->selectOne(
            "SELECT * FROM payments WHERE order_id = :order_id AND status = 'succeeded' ORDER BY id DESC LIMIT 1",
            ['order_id' => $orderId],
        );
    }

    /**
     * @return array{rows:list<array<string,mixed>>,total:int}
     */
    public function paginateForAdmin(array $filters, int $page, int $perPage): array
    {
        $where = ['1=1'];
        $params = [];

        if (!empty($filters['status'])) {
            $where[] = 'pay.status = :status';
            $params['status'] = (string) $filters['status'];
        }

        if (!empty($filters['provider'])) {
            $where[] = 'pay.provider = :provider';
            $params['provider'] = (string) $filters['provider'];
        }

        if (!empty($filters['q'])) {
            $where[] = '(pay.provider_reference LIKE :q ESCAPE \'\\\\\' OR o.order_number LIKE :q ESCAPE \'\\\\\')';
            $params['q'] = '%' . str_replace(['\\', '%', '_'], ['\\\\', '\\%', '\\_'], (string) $filters['q']) . '%';
        }

        $whereSql = implode(' AND ', $where);
        [$limit, $offset] = $this->window($page, $perPage);

        $total = (int) $this->db->scalar(
            "SELECT COUNT(*) FROM payments pay JOIN orders o ON o.id = pay.order_id WHERE {$whereSql}",
            $params,
        );

        $rows = $this->db->select(
            "SELECT pay.id, pay.order_id, pay.provider, pay.provider_reference, pay.amount, pay.currency,
                    pay.status, pay.payment_method, pay.paid_at, pay.failure_code, pay.created_at,
                    o.order_number, o.customer_name
             FROM payments pay
             JOIN orders o ON o.id = pay.order_id
             WHERE {$whereSql}
             ORDER BY pay.created_at DESC, pay.id DESC
             LIMIT {$limit} OFFSET {$offset}",
            $params,
        );

        return ['rows' => $rows, 'total' => $total];
    }
}
