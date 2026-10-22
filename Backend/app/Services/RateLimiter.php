<?php

declare(strict_types=1);

namespace Shopio\Services;

use Shopio\Config\Config;
use Shopio\Exceptions\RateLimitException;
use Shopio\Repositories\LoginAttemptRepository;
use Shopio\Repositories\RateLimitRepository;
use Shopio\Support\Str;

/**
 * Rate limiting and progressive login delays.
 *
 * Two layers:
 *  - fixed-window counters (per IP, per route, per account) for blunt throttling;
 *  - login attempt history for account lockout and progressive delays.
 *
 * The progressive delay is deliberately capped (<= 1s) so that it cannot be used
 * to exhaust PHP workers — the real protection is the lockout.
 */
final class RateLimiter
{
    public function __construct(
        private readonly RateLimitRepository $limits,
        private readonly LoginAttemptRepository $attempts,
    ) {
    }

    /**
     * @throws RateLimitException
     */
    public function consume(string $scope, string $identifier, int $maxHits, int $windowSeconds, int $blockSeconds = 0, ?string $message = null): void
    {
        $bucket = $scope . ':' . hash('sha256', $identifier);

        $result = $this->limits->consume($bucket, $windowSeconds, $maxHits, $blockSeconds);

        if (!$result['allowed']) {
            throw new RateLimitException(
                $result['retry_after'],
                $message ?? 'Too many requests. Please try again later.',
                ['scope' => $scope],
            );
        }
    }

    public function reset(string $scope, string $identifier): void
    {
        $this->limits->reset($scope . ':' . hash('sha256', $identifier));
    }

    public function emailFingerprint(string $email): string
    {
        return hash('sha256', Str::normaliseEmail($email));
    }

    /**
     * Blocks login when an account or IP has accumulated too many failures.
     *
     * @throws RateLimitException
     */
    public function assertLoginAllowed(string $email, ?string $ipAddress): void
    {
        $window = Config::int('AUTH_DECAY_SECONDS', 900);
        $maxAttempts = Config::int('AUTH_MAX_ATTEMPTS', 8);

        $emailFailures = $this->attempts->recentEmailFailures($this->emailFingerprint($email), $window);
        $ipFailures = $this->attempts->recentIpFailures($ipAddress, $window);

        if ($emailFailures >= $maxAttempts || $ipFailures >= $maxAttempts * 3) {
            $lockout = Config::int('LOGIN_LOCKOUT_SECONDS', 900);

            throw new RateLimitException(
                $lockout,
                'Too many failed sign-in attempts. Please try again later.',
                ['reason' => 'login_lockout'],
            );
        }

        // Progressive delay: bounded so it cannot be weaponised for DoS.
        $failures = max($emailFailures, intdiv($ipFailures, 3));
        if ($failures > 0) {
            usleep(min(750_000, 100_000 * $failures));
        }
    }

    public function recordLoginFailure(string $email, ?string $ipAddress): void
    {
        $this->attempts->record($this->emailFingerprint($email), $ipAddress, false);
    }

    public function recordLoginSuccess(string $email, ?string $ipAddress): void
    {
        $this->attempts->record($this->emailFingerprint($email), $ipAddress, true);
    }
}
