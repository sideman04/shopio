<?php

declare(strict_types=1);

namespace Shopio\Controllers;

use Shopio\Config\Config;
use Shopio\Exceptions\AuthenticationException;
use Shopio\Http\Request;
use Shopio\Http\Response;
use Shopio\Repositories\AuthTokenRepository;
use Shopio\Repositories\IdempotencyRepository;
use Shopio\Repositories\InventoryRepository;
use Shopio\Repositories\LoginAttemptRepository;
use Shopio\Repositories\RateLimitRepository;
use Shopio\Repositories\SessionRepository;
use Shopio\Support\Str;

/**
 * Token-authenticated maintenance endpoint for scheduled jobs.
 *
 * Releasing expired stock reservations is required for inventory correctness (a
 * hold that expired must not permanently reduce availability). The remaining
 * tasks are housekeeping so the security tables do not grow without bound.
 *
 * The endpoint is guarded by a shared secret compared in constant time and is
 * never mounted behind the normal session auth.
 */
final class CronController extends Controller
{
    public function __construct(
        private readonly InventoryRepository $inventory,
        private readonly SessionRepository $sessions,
        private readonly AuthTokenRepository $tokens,
        private readonly RateLimitRepository $rateLimits,
        private readonly IdempotencyRepository $idempotency,
        private readonly LoginAttemptRepository $loginAttempts,
    ) {
    }

    public function run(Request $request): Response
    {
        $this->assertToken($request);

        $now = gmdate('Y-m-d H:i:s');
        $released = 0;

        foreach ($this->inventory->expiredReservations(500) as $reservation) {
            $this->inventory->release((int) $reservation['variant_id'], (int) $reservation['quantity']);
            $this->inventory->markReservation((int) $reservation['id'], 'expired');
            $released++;
        }

        $result = [
            'expiredReservationsReleased' => $released,
            'sessionsPurged' => $this->sessions->deleteExpired($now),
            'tokensPurged' => $this->tokens->deleteExpired($now),
            'rateLimitsPurged' => $this->rateLimits->purgeExpired($now),
            'idempotencyKeysPurged' => $this->idempotency->purgeExpired($now),
            'loginAttemptsPurged' => $this->loginAttempts->purgeOlderThan(gmdate('Y-m-d H:i:s', time() - 30 * 86400)),
        ];

        return $this->success($result, 'Maintenance completed', 200, [], $request);
    }

    private function assertToken(Request $request): void
    {
        $expected = Config::get('CRON_TOKEN', '') ?? '';
        $provided = $request->header('x-cron-token', '') ?? '';

        if ($expected === '' || $provided === '' || !Str::constantTimeEquals($provided, $expected)) {
            throw new AuthenticationException();
        }
    }
}
