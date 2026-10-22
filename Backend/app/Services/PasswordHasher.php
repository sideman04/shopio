<?php

declare(strict_types=1);

namespace Shopio\Services;

use Shopio\Config\Config;
use Shopio\Exceptions\AuthenticationException;
use Shopio\Support\Logger;

/**
 * Password hashing.
 *
 * Prefers Argon2id and transparently falls back to bcrypt when the PHP build was
 * not compiled with Argon2 support (which is the case on some hosting/Android
 * PHP builds). `needsRehash()` drives opportunistic upgrades when the platform
 * gains Argon2id support later.
 */
final class PasswordHasher
{
    /** Supplied by the deployment to make offline cracking harder (optional). */
    private readonly ?string $pepper;

    public function __construct()
    {
        $pepper = Config::get('PASSWORD_PEPPER', '');
        $this->pepper = ($pepper === null || $pepper === '') ? null : $pepper;
    }

    public function algorithm(): string
    {
        $configured = strtolower(Config::get('PASSWORD_ALGO', 'auto') ?? 'auto');

        if ($configured === 'argon2id') {
            if (!defined('PASSWORD_ARGON2ID')) {
                throw new AuthenticationException(
                    'Password hashing is misconfigured on this server.',
                    ['password_algo' => 'argon2id_unavailable'],
                );
            }

            return PASSWORD_ARGON2ID;
        }

        if ($configured === 'bcrypt') {
            return PASSWORD_BCRYPT;
        }

        return self::argon2Available() ? PASSWORD_ARGON2ID : PASSWORD_BCRYPT;
    }

    public function hash(string $plainPassword): string
    {
        $algorithm = $this->algorithm();
        $options = $algorithm === PASSWORD_BCRYPT
            ? ['cost' => max(10, Config::int('PASSWORD_BCRYPT_COST', 12))]
            : [
                'memory_cost' => 65536,
                'time_cost' => 4,
                'threads' => 1,
            ];

        $hash = password_hash($this->applyPepper($plainPassword), $algorithm, $options);

        // password_hash() returns a non-empty hash or throws; the explicit
        // return keeps the failure mode obvious to readers.
        return $hash;
    }

    public function verify(string $plainPassword, string $storedHash): bool
    {
        return password_verify($this->applyPepper($plainPassword), $storedHash);
    }

    public function needsRehash(string $storedHash): bool
    {
        $algorithm = $this->algorithm();
        $options = $algorithm === PASSWORD_BCRYPT
            ? ['cost' => max(10, Config::int('PASSWORD_BCRYPT_COST', 12))]
            : ['memory_cost' => 65536, 'time_cost' => 4, 'threads' => 1];

        return password_needs_rehash($storedHash, $algorithm, $options);
    }

    public static function argon2Available(): bool
    {
        return defined('PASSWORD_ARGON2ID');
    }

    /**
     * Constant-work dummy verification used to equalise response time for
     * unknown accounts (timing-based account enumeration defence).
     */
    public function verifyDummy(string $plainPassword): void
    {
        static $dummy = null;
        if ($dummy === null) {
            $dummy = $this->hash('shopio-dummy-password-for-timing-equalisation');
        }

        $this->verify($plainPassword, $dummy);
    }

    /**
     * Reports the effective algorithm for startup diagnostics (no secrets).
     */
    public function describe(): string
    {
        return self::argon2Available() ? 'argon2id-available' : 'bcrypt-only';
    }

    private function applyPepper(string $plainPassword): string
    {
        if ($this->pepper === null) {
            return $plainPassword;
        }

        return hash_hmac('sha256', $plainPassword, $this->pepper);
    }
}
