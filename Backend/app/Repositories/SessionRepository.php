<?php

declare(strict_types=1);

namespace Shopio\Repositories;

/**
 * Server-managed authentication sessions. Raw tokens are never stored: only
 * SHA-256 hashes, so a database disclosure cannot be replayed.
 */
final class SessionRepository extends Repository
{
    public function create(
        int $userId,
        string $tokenHash,
        ?string $csrfHash,
        ?string $ipAddress,
        ?string $userAgent,
        string $expiresAtUtc,
        string $absoluteExpiresAtUtc,
    ): int {
        $this->db->execute(
            'INSERT INTO sessions
                (user_id, token_hash, csrf_hash, ip_address, user_agent, last_used_at, expires_at, absolute_expires_at)
             VALUES
                (:user_id, :token_hash, :csrf_hash, INET6_ATON(:ip_address), :user_agent, UTC_TIMESTAMP(), :expires_at, :absolute_expires_at)',
            [
                'user_id' => $userId,
                'token_hash' => $tokenHash,
                'csrf_hash' => $csrfHash,
                'ip_address' => $ipAddress,
                'user_agent' => $userAgent,
                'expires_at' => $expiresAtUtc,
                'absolute_expires_at' => $absoluteExpiresAtUtc,
            ],
        );

        return $this->db->lastInsertId();
    }

    /**
     * @return array<string,mixed>|null
     */
    public function findActiveByTokenHash(string $tokenHash): ?array
    {
        return $this->db->selectOne(
            'SELECT s.id, s.user_id, s.csrf_hash, s.expires_at, s.absolute_expires_at, s.revoked_at,
                    INET6_NTOA(s.ip_address) AS ip_address, s.user_agent, s.last_used_at, s.created_at
             FROM sessions s
             WHERE s.token_hash = :hash
               AND s.revoked_at IS NULL
               AND s.expires_at > UTC_TIMESTAMP()
               AND s.absolute_expires_at > UTC_TIMESTAMP()
             LIMIT 1',
            ['hash' => $tokenHash],
        );
    }

    /**
     * @return array<string,mixed>|null
     */
    public function findById(int $id): ?array
    {
        return $this->db->selectOne(
            'SELECT id, user_id, expires_at, absolute_expires_at, revoked_at,
                    INET6_NTOA(ip_address) AS ip_address, user_agent, last_used_at, created_at
             FROM sessions WHERE id = :id LIMIT 1',
            ['id' => $id],
        );
    }

    /**
     * Sliding expiry: extends the session but never beyond the absolute cap.
     */
    public function touch(int $sessionId, string $slidingExpiryUtc): void
    {
        $this->db->execute(
            'UPDATE sessions
             SET last_used_at = UTC_TIMESTAMP(),
                 expires_at = LEAST(:sliding, absolute_expires_at)
             WHERE id = :id AND revoked_at IS NULL',
            ['sliding' => $slidingExpiryUtc, 'id' => $sessionId],
        );
    }

    public function revokeById(int $sessionId, string $reason): void
    {
        $this->db->execute(
            'UPDATE sessions SET revoked_at = UTC_TIMESTAMP(), revoked_reason = :reason
             WHERE id = :id AND revoked_at IS NULL',
            ['reason' => $reason, 'id' => $sessionId],
        );
    }

    /**
     * Revokes a session only when it belongs to the given user, so one account
     * can never sign another out. Returns true when a row was actually revoked.
     */
    public function revokeOwned(int $userId, int $sessionId, string $reason): bool
    {
        return $this->db->affectedRows($this->db->execute(
            'UPDATE sessions SET revoked_at = UTC_TIMESTAMP(), revoked_reason = :reason
             WHERE id = :id AND user_id = :user_id AND revoked_at IS NULL',
            ['reason' => $reason, 'id' => $sessionId, 'user_id' => $userId],
        )) > 0;
    }

    public function revokeAllForUser(int $userId, string $reason, ?int $exceptSessionId = null): int
    {
        $sql = 'UPDATE sessions SET revoked_at = UTC_TIMESTAMP(), revoked_reason = :reason
                WHERE user_id = :user_id AND revoked_at IS NULL';
        $params = ['reason' => $reason, 'user_id' => $userId];

        if ($exceptSessionId !== null) {
            $sql .= ' AND id <> :except';
            $params['except'] = $exceptSessionId;
        }

        return $this->db->affectedRows($this->db->execute($sql, $params));
    }

    /**
     * @return list<array<string,mixed>>
     */
    public function listForUser(int $userId): array
    {
        return $this->db->select(
            'SELECT id, INET6_NTOA(ip_address) AS ip_address, user_agent, last_used_at, created_at, expires_at
             FROM sessions
             WHERE user_id = :user_id AND revoked_at IS NULL AND expires_at > UTC_TIMESTAMP()
             ORDER BY last_used_at DESC
             LIMIT 50',
            ['user_id' => $userId],
        );
    }

    public function deleteExpired(string $beforeUtc): int
    {
        return $this->db->affectedRows($this->db->execute(
            'DELETE FROM sessions WHERE absolute_expires_at < :before',
            ['before' => $beforeUtc],
        ));
    }
}
