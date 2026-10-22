<?php

declare(strict_types=1);

namespace Shopio\Repositories;

/**
 * Fixed-window rate limiter backed by a single row per bucket.
 *
 * Each bucket is locked with `SELECT ... FOR UPDATE` inside a short transaction
 * so concurrent requests cannot race past the limit (the classic
 * read-then-write counter bug).
 */
final class RateLimitRepository extends Repository
{
    /**
     * @return array{allowed:bool,hits:int,remaining:int,retry_after:int,limit:int}
     */
    public function consume(string $bucketKey, int $windowSeconds, int $maxHits, int $blockSeconds = 0): array
    {
        $windowSeconds = max(1, $windowSeconds);
        $maxHits = max(1, $maxHits);

        return $this->db->transaction(function () use ($bucketKey, $windowSeconds, $maxHits, $blockSeconds): array {
            $this->db->execute(
                'INSERT IGNORE INTO rate_limits (bucket_key, hits, window_started_at, expires_at)
                 VALUES (:key, 0, UTC_TIMESTAMP(), DATE_ADD(UTC_TIMESTAMP(), INTERVAL :window SECOND))',
                ['key' => $bucketKey, 'window' => $windowSeconds],
            );

            $row = $this->db->selectOne(
                'SELECT hits, window_started_at, expires_at, blocked_until,
                        (window_started_at > DATE_SUB(UTC_TIMESTAMP(), INTERVAL :window SECOND)) AS window_active,
                        (blocked_until IS NOT NULL AND blocked_until > UTC_TIMESTAMP()) AS is_blocked,
                        GREATEST(0, TIMESTAMPDIFF(SECOND, UTC_TIMESTAMP(), blocked_until)) AS blocked_seconds,
                        GREATEST(0, TIMESTAMPDIFF(SECOND, UTC_TIMESTAMP(), expires_at)) AS window_seconds_left
                 FROM rate_limits WHERE bucket_key = :key FOR UPDATE',
                ['key' => $bucketKey, 'window' => $windowSeconds],
            );

            if ($row === null) {
                // Should not happen; fail open rather than 500.
                return ['allowed' => true, 'hits' => 0, 'remaining' => $maxHits, 'retry_after' => 0, 'limit' => $maxHits];
            }

            if ((int) $row['is_blocked'] === 1) {
                return [
                    'allowed' => false,
                    'hits' => (int) $row['hits'],
                    'remaining' => 0,
                    'retry_after' => max(1, (int) $row['blocked_seconds']),
                    'limit' => $maxHits,
                ];
            }

            $windowActive = (int) $row['window_active'] === 1;
            $hits = $windowActive ? ((int) $row['hits'] + 1) : 1;

            if (!$windowActive) {
                $this->db->execute(
                    'UPDATE rate_limits
                     SET hits = :hits, window_started_at = UTC_TIMESTAMP(),
                         expires_at = DATE_ADD(UTC_TIMESTAMP(), INTERVAL :window SECOND), blocked_until = NULL
                     WHERE bucket_key = :key',
                    ['hits' => $hits, 'window' => $windowSeconds, 'key' => $bucketKey],
                );
            } else {
                $this->db->execute(
                    'UPDATE rate_limits SET hits = :hits WHERE bucket_key = :key',
                    ['hits' => $hits, 'key' => $bucketKey],
                );
            }

            if ($hits > $maxHits) {
                $retryAfter = $blockSeconds > 0
                    ? $blockSeconds
                    : max(1, (int) $row['window_seconds_left']);

                if ($blockSeconds > 0) {
                    $this->db->execute(
                        'UPDATE rate_limits SET blocked_until = DATE_ADD(UTC_TIMESTAMP(), INTERVAL :block SECOND)
                         WHERE bucket_key = :key',
                        ['block' => $blockSeconds, 'key' => $bucketKey],
                    );
                }

                return [
                    'allowed' => false,
                    'hits' => $hits,
                    'remaining' => 0,
                    'retry_after' => $retryAfter,
                    'limit' => $maxHits,
                ];
            }

            return [
                'allowed' => true,
                'hits' => $hits,
                'remaining' => $maxHits - $hits,
                'retry_after' => 0,
                'limit' => $maxHits,
            ];
        }, 2);
    }

    public function reset(string $bucketKey): void
    {
        $this->db->execute('DELETE FROM rate_limits WHERE bucket_key = :key', ['key' => $bucketKey]);
    }

    public function clearBlock(string $bucketKey): void
    {
        $this->db->execute(
            'UPDATE rate_limits SET blocked_until = NULL, hits = 0 WHERE bucket_key = :key',
            ['key' => $bucketKey],
        );
    }

    public function purgeExpired(string $beforeUtc): int
    {
        return $this->db->affectedRows($this->db->execute(
            'DELETE FROM rate_limits WHERE expires_at < :before AND (blocked_until IS NULL OR blocked_until < :before)',
            ['before' => $beforeUtc],
        ));
    }
}
