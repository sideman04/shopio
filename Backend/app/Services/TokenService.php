<?php

declare(strict_types=1);

namespace Shopio\Services;

use Shopio\Repositories\AuthTokenRepository;
use Shopio\Support\Str;

/**
 * Issues and consumes single-use, expiring auth tokens (email verification,
 * password reset, phone verification). Only the SHA-256 hash is persisted.
 */
final class TokenService
{
    public function __construct(private readonly AuthTokenRepository $tokens)
    {
    }

    /**
     * Issues a token for a purpose and returns the raw value for the caller to
     * email/SMS. Any previously outstanding token of the same purpose is
     * invalidated so only the newest link works.
     *
     * @return string raw token (never stored, never logged)
     */
    public function issue(int $userId, string $purpose, int $ttlSeconds): string
    {
        $raw = Str::randomToken(32);

        $this->tokens->invalidateForUser($userId, $purpose);
        $this->tokens->create(
            $userId,
            $purpose,
            Str::hashToken($raw),
            gmdate('Y-m-d H:i:s', time() + $ttlSeconds),
        );

        return $raw;
    }

    /**
     * Looks up an unused, unexpired token without consuming it.
     *
     * @return array<string,mixed>|null
     */
    public function find(string $purpose, string $rawToken): ?array
    {
        if ($rawToken === '') {
            return null;
        }

        return $this->tokens->findUsable($purpose, Str::hashToken($rawToken));
    }

    /**
     * Atomically consumes a token. Returns false when the token is unknown,
     * expired or already used — guaranteeing single use.
     */
    public function consume(string $purpose, string $rawToken): ?int
    {
        if ($rawToken === '') {
            return null;
        }

        $hash = Str::hashToken($rawToken);

        return $this->tokens->consume($purpose, $hash);
    }

    public function invalidatePurpose(int $userId, string $purpose): void
    {
        $this->tokens->invalidateForUser($userId, $purpose);
    }
}
