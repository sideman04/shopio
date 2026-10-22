<?php

declare(strict_types=1);

namespace Shopio\Services;

use Shopio\Auth\AuthenticatedUser;
use Shopio\Exceptions\NotFoundException;
use Shopio\Exceptions\ValidationException;
use Shopio\Repositories\LoginAttemptRepository;
use Shopio\Support\Str;

/**
 * Account-security surfaces for the signed-in user: the devices that hold live
 * sessions and the recent sign-in history.
 *
 * Session rows are server-side truth — the raw token is never stored, so this
 * service only ever exposes safe metadata (id, IP, user agent, timestamps).
 * Login history is looked up by the SHA-256 fingerprint of the account email so
 * the plaintext address never reaches the query.
 */
final class SecurityService
{
    public function __construct(
        private readonly SessionService $sessions,
        private readonly LoginAttemptRepository $attempts,
    ) {
    }

    /**
     * @return list<array<string,mixed>>
     */
    public function sessions(AuthenticatedUser $auth): array
    {
        return array_map(
            static fn (array $row): array => [
                'id' => (int) $row['id'],
                'ipAddress' => $row['ip_address'],
                'userAgent' => $row['user_agent'],
                'lastUsedAt' => $row['last_used_at'],
                'createdAt' => $row['created_at'],
                'expiresAt' => $row['expires_at'],
                'current' => (int) $row['id'] === $auth->sessionId,
            ],
            $this->sessions->activeSessions($auth->id),
        );
    }

    public function revokeSession(AuthenticatedUser $auth, int $sessionId): void
    {
        if ($sessionId === $auth->sessionId) {
            throw new ValidationException([
                'session' => ['You cannot sign out of the device you are currently using.'],
            ]);
        }

        if (!$this->sessions->revokeOwned($auth->id, $sessionId, 'user_revoked')) {
            throw new NotFoundException('That session does not exist or has already ended.');
        }
    }

    public function revokeOtherSessions(AuthenticatedUser $auth): int
    {
        return $this->sessions->revokeAll($auth->id, 'user_revoked_others', $auth->sessionId);
    }

    /**
     * @return list<array<string,mixed>>
     */
    public function loginActivity(AuthenticatedUser $auth, int $limit = 25): array
    {
        $fingerprint = hash('sha256', Str::normaliseEmail($auth->email()));

        return array_map(
            static fn (array $row): array => [
                'id' => (int) $row['id'],
                'ipAddress' => $row['ip_address'],
                'successful' => (bool) $row['successful'],
                'createdAt' => $row['created_at'],
            ],
            $this->attempts->listForEmailHash($fingerprint, $limit),
        );
    }
}
