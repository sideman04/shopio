<?php

declare(strict_types=1);

namespace Shopio\Services;

use Shopio\Config\Config;
use Shopio\Repositories\SessionRepository;
use Shopio\Support\Str;

/**
 * Server-managed authentication sessions.
 *
 * The client receives an opaque random token. Only its SHA-256 hash is stored, so
 * a database leak cannot be replayed. Expiry is sliding, capped by an absolute
 * lifetime so a stolen token cannot live forever.
 */
final class SessionService
{
    public function __construct(
        private readonly SessionRepository $sessions,
    ) {
    }

    /**
     * @return array{token:string,csrf_token:string,session_id:int,expires_at:string}
     */
    public function start(int $userId, ?string $ipAddress, ?string $userAgent): array
    {
        $token = Str::randomToken(32);
        $csrfToken = Str::randomToken(24);
        $ttl = max(300, Config::int('SESSION_TTL', 7200));
        $absoluteTtl = max($ttl, Config::int('SESSION_ABSOLUTE_TTL', 1209600));

        $sessionId = $this->sessions->create(
            $userId,
            Str::hashToken($token),
            Str::hashToken($csrfToken),
            $ipAddress,
            $userAgent,
            gmdate('Y-m-d H:i:s', time() + $ttl),
            gmdate('Y-m-d H:i:s', time() + $absoluteTtl),
        );

        return [
            'token' => $token,
            'csrf_token' => $csrfToken,
            'session_id' => $sessionId,
            'expires_at' => gmdate('Y-m-d H:i:s', time() + $ttl),
        ];
    }

    /**
     * @return array<string,mixed>|null
     */
    public function resolve(string $token): ?array
    {
        if ($token === '') {
            return null;
        }

        return $this->sessions->findActiveByTokenHash(Str::hashToken($token));
    }

    /**
     * Sliding expiry extension, never beyond the absolute cap.
     */
    public function touch(int $sessionId): void
    {
        $ttl = max(300, Config::int('SESSION_TTL', 7200));
        $this->sessions->touch($sessionId, gmdate('Y-m-d H:i:s', time() + $ttl));
    }

    public function revoke(int $sessionId, string $reason): void
    {
        $this->sessions->revokeById($sessionId, $reason);
    }

    /**
     * Revokes a specific session owned by the user (returns false if it is not
     * theirs or is already revoked).
     */
    public function revokeOwned(int $userId, int $sessionId, string $reason): bool
    {
        return $this->sessions->revokeOwned($userId, $sessionId, $reason);
    }

    /**
     * Used after password reset, suspension and other security events.
     */
    public function revokeAll(int $userId, string $reason, ?int $exceptSessionId = null): int
    {
        return $this->sessions->revokeAllForUser($userId, $reason, $exceptSessionId);
    }

    /**
     * @return list<array<string,mixed>>
     */
    public function activeSessions(int $userId): array
    {
        return $this->sessions->listForUser($userId);
    }
}
