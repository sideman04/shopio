<?php

declare(strict_types=1);

namespace Shopio\Auth;

/**
 * The authenticated principal derived exclusively from a validated session.
 *
 * Controllers and policies read identity from here — never from request bodies,
 * query strings or client-supplied headers.
 */
final class AuthenticatedUser
{
    /**
     * @param list<string>      $roles
     * @param array<string,mixed> $user
     */
    public function __construct(
        public readonly int $id,
        public readonly array $user,
        public readonly array $roles,
        public readonly ?int $sellerId,
        public readonly int $sessionId,
        public readonly string $via,
        public readonly ?string $csrfHash,
    ) {
    }

    public function hasRole(string $role): bool
    {
        return in_array($role, $this->roles, true);
    }

    public function isAdmin(): bool
    {
        return $this->hasRole('admin');
    }

    public function isSeller(): bool
    {
        return $this->hasRole('seller');
    }

    public function email(): string
    {
        return (string) ($this->user['email'] ?? '');
    }

    public function fullName(): string
    {
        return (string) ($this->user['full_name'] ?? '');
    }

    public function status(): string
    {
        return (string) ($this->user['status'] ?? 'active');
    }
}
