<?php

declare(strict_types=1);

namespace Shopio\Repositories;

/**
 * Append-only login attempt history.
 *
 * The email is hashed (never stored in the clear) so this table cannot be used
 * to enumerate accounts if it is disclosed.
 */
final class LoginAttemptRepository extends Repository
{
    public function record(string $emailHash, ?string $ipAddress, bool $successful): void
    {
        $this->db->execute(
            'INSERT INTO login_attempts (email_hash, ip_address, successful)
             VALUES (:email_hash, INET6_ATON(:ip), :successful)',
            [
                'email_hash' => $emailHash,
                'ip' => $ipAddress,
                'successful' => $successful ? 1 : 0,
            ],
        );
    }

    /**
     * Failures for a given account within the window (account-targeted abuse).
     */
    public function recentEmailFailures(string $emailHash, int $windowSeconds): int
    {
        return (int) $this->db->scalar(
            'SELECT COUNT(*) FROM login_attempts
             WHERE email_hash = :hash AND successful = 0
               AND created_at > DATE_SUB(UTC_TIMESTAMP(), INTERVAL :window SECOND)',
            ['hash' => $emailHash, 'window' => max(1, $windowSeconds)],
        );
    }

    /**
     * Failures from a given IP within the window (credential-stuffing abuse).
     */
    public function recentIpFailures(?string $ipAddress, int $windowSeconds): int
    {
        if ($ipAddress === null) {
            return 0;
        }

        return (int) $this->db->scalar(
            'SELECT COUNT(*) FROM login_attempts
             WHERE ip_address = INET6_ATON(:ip) AND successful = 0
               AND created_at > DATE_SUB(UTC_TIMESTAMP(), INTERVAL :window SECOND)',
            ['ip' => $ipAddress, 'window' => max(1, $windowSeconds)],
        );
    }

    public function clearForEmail(string $emailHash): void
    {
        $this->db->execute('DELETE FROM login_attempts WHERE email_hash = :hash', ['hash' => $emailHash]);
    }

    /**
     * Recent attempts for one account, newest first. The caller supplies the
     * already-hashed email so the plaintext address never touches the query.
     *
     * @return list<array<string,mixed>>
     */
    public function listForEmailHash(string $emailHash, int $limit = 25): array
    {
        $limit = max(1, min(100, $limit));

        return $this->db->select(
            'SELECT id, INET6_NTOA(ip_address) AS ip_address, successful, created_at
             FROM login_attempts
             WHERE email_hash = :hash
             ORDER BY created_at DESC
             LIMIT ' . $limit,
            ['hash' => $emailHash],
        );
    }

    public function purgeOlderThan(string $beforeUtc): int
    {
        return $this->db->affectedRows($this->db->execute(
            'DELETE FROM login_attempts WHERE created_at < :before',
            ['before' => $beforeUtc],
        ));
    }
}
