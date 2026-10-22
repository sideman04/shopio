<?php

declare(strict_types=1);

namespace Shopio\Repositories;

/**
 * One-time auth tokens for email verification, phone verification and password
 * reset. Only the SHA-256 hash of the token is persisted.
 */
final class AuthTokenRepository extends Repository
{
    public function create(int $userId, string $purpose, string $tokenHash, string $expiresAtUtc): int
    {
        $this->db->execute(
            'INSERT INTO auth_tokens (user_id, token_hash, purpose, expires_at)
             VALUES (:user_id, :token_hash, :purpose, :expires_at)',
            [
                'user_id' => $userId,
                'token_hash' => $tokenHash,
                'purpose' => $purpose,
                'expires_at' => $expiresAtUtc,
            ],
        );

        return $this->db->lastInsertId();
    }

    /**
     * Returns an unused, unexpired token row without consuming it.
     *
     * @return array<string,mixed>|null
     */
    public function findUsable(string $purpose, string $tokenHash): ?array
    {
        return $this->db->selectOne(
            'SELECT id, user_id, expires_at, used_at
             FROM auth_tokens
             WHERE purpose = :purpose AND token_hash = :hash
               AND used_at IS NULL AND expires_at > UTC_TIMESTAMP()
             LIMIT 1',
            ['purpose' => $purpose, 'hash' => $tokenHash],
        );
    }

    /**
     * Locks the token row for update so a reset token can only be consumed once
     * even under concurrent requests.
     *
     * @return array<string,mixed>|null
     */
    public function lockUsable(string $purpose, string $tokenHash): ?array
    {
        return $this->db->selectOne(
            'SELECT id, user_id, expires_at, used_at
             FROM auth_tokens
             WHERE purpose = :purpose AND token_hash = :hash
             LIMIT 1
             FOR UPDATE',
            ['purpose' => $purpose, 'hash' => $tokenHash],
        );
    }

    public function markUsed(int $id): bool
    {
        $statement = $this->db->execute(
            'UPDATE auth_tokens SET used_at = UTC_TIMESTAMP() WHERE id = :id AND used_at IS NULL',
            ['id' => $id],
        );

        return $this->db->affectedRows($statement) === 1;
    }

    /**
     * Atomically consumes a usable token and returns its owner, guaranteeing
     * single use even under concurrent requests. Returns null when the token is
     * unknown, expired or already used.
     */
    public function consume(string $purpose, string $tokenHash): ?int
    {
        return $this->transaction(function () use ($purpose, $tokenHash): ?int {
            $row = $this->lockUsable($purpose, $tokenHash);
            if ($row === null) {
                return null;
            }

            if ($row['used_at'] !== null || strtotime((string) $row['expires_at']) <= time()) {
                return null;
            }

            if (!$this->markUsed((int) $row['id'])) {
                return null;
            }

            return (int) $row['user_id'];
        });
    }

    /**
     * Invalidates every outstanding token of a purpose for a user (e.g. after a
     * password reset, or before issuing a fresh verification link).
     */
    public function invalidateForUser(int $userId, string $purpose): void
    {
        $this->db->execute(
            'UPDATE auth_tokens SET used_at = UTC_TIMESTAMP()
             WHERE user_id = :user_id AND purpose = :purpose AND used_at IS NULL',
            ['user_id' => $userId, 'purpose' => $purpose],
        );
    }

    public function deleteExpired(string $beforeUtc): int
    {
        $statement = $this->db->execute(
            'DELETE FROM auth_tokens WHERE expires_at < :before',
            ['before' => $beforeUtc],
        );

        return $this->db->affectedRows($statement);
    }
}
