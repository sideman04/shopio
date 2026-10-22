<?php

declare(strict_types=1);

namespace Shopio\Repositories;

use PDOException;

/**
 * Idempotency records for retryable write operations.
 *
 * The unique key is (scope, subject_key, idem_key). `subject_key` is
 * `user:<id>` for authenticated callers or a session fingerprint for guests, so
 * uniqueness holds even when `user_id` is NULL.
 */
final class IdempotencyRepository extends Repository
{
    /**
     * @return array{state:'proceed'|'replay'|'conflict'|'in_progress',row:array<string,mixed>|null,id:?int}
     */
    public function begin(
        string $scope,
        string $subjectKey,
        ?int $userId,
        string $idemKey,
        string $requestHash,
        int $ttlSeconds,
    ): array {
        $expiresAt = gmdate('Y-m-d H:i:s', time() + max(60, $ttlSeconds));

        try {
            $this->db->execute(
                'INSERT INTO idempotency_keys (scope, subject_key, user_id, idem_key, request_hash, status, expires_at)
                 VALUES (:scope, :subject, :user_id, :idem_key, :hash, \'in_progress\', :expires_at)',
                [
                    'scope' => $scope,
                    'subject' => $subjectKey,
                    'user_id' => $userId,
                    'idem_key' => $idemKey,
                    'hash' => $requestHash,
                    'expires_at' => $expiresAt,
                ],
            );

            return ['state' => 'proceed', 'row' => null, 'id' => $this->db->lastInsertId()];
        } catch (PDOException $e) {
            if ((int) ($e->errorInfo[1] ?? 0) !== 1062) {
                throw $this->db->mapPdoException($e);
            }
        }

        $row = $this->db->selectOne(
            'SELECT id, request_hash, status, response_status, response_body, resource_type, resource_id
             FROM idempotency_keys
             WHERE scope = :scope AND subject_key = :subject AND idem_key = :idem_key
             LIMIT 1
             FOR UPDATE',
            ['scope' => $scope, 'subject' => $subjectKey, 'idem_key' => $idemKey],
        );

        if ($row === null) {
            // Extremely unlikely (row deleted between insert and select); treat as new.
            return ['state' => 'proceed', 'row' => null, 'id' => null];
        }

        // Same key, different payload => the client reused a key incorrectly.
        if (!hash_equals((string) $row['request_hash'], $requestHash)) {
            return ['state' => 'conflict', 'row' => $row, 'id' => (int) $row['id']];
        }

        if ($row['status'] === 'completed') {
            return ['state' => 'replay', 'row' => $row, 'id' => (int) $row['id']];
        }

        if ($row['status'] === 'in_progress') {
            return ['state' => 'in_progress', 'row' => $row, 'id' => (int) $row['id']];
        }

        // Previously failed: allow a retry with the same key and payload.
        $this->db->execute(
            "UPDATE idempotency_keys SET status = 'in_progress', expires_at = :expires_at WHERE id = :id",
            ['expires_at' => $expiresAt, 'id' => (int) $row['id']],
        );

        return ['state' => 'proceed', 'row' => null, 'id' => (int) $row['id']];
    }

    /**
     * @param array<string,mixed> $responseBody
     */
    public function complete(
        int $id,
        int $responseStatus,
        array $responseBody,
        ?string $resourceType = null,
        ?int $resourceId = null,
    ): void {
        $encoded = json_encode($responseBody, JSON_UNESCAPED_SLASHES | JSON_INVALID_UTF8_SUBSTITUTE);

        $this->db->execute(
            "UPDATE idempotency_keys
             SET status = 'completed', response_status = :status, response_body = :body,
                 resource_type = :resource_type, resource_id = :resource_id
             WHERE id = :id",
            [
                'status' => $responseStatus,
                'body' => $encoded === false ? null : $encoded,
                'resource_type' => $resourceType,
                'resource_id' => $resourceId,
                'id' => $id,
            ],
        );
    }

    public function fail(int $id): void
    {
        $this->db->execute("UPDATE idempotency_keys SET status = 'failed' WHERE id = :id", ['id' => $id]);
    }

    public function purgeExpired(string $beforeUtc): int
    {
        return $this->db->affectedRows($this->db->execute(
            'DELETE FROM idempotency_keys WHERE expires_at < :before',
            ['before' => $beforeUtc],
        ));
    }
}
