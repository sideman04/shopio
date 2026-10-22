<?php

declare(strict_types=1);

namespace Shopio\Middleware;

use Shopio\Auth\AuthenticatedUser;
use Shopio\Http\Request;
use Shopio\Http\Response;
use Shopio\Services\RateLimiter;

/**
 * Per-route fixed-window throttle.
 *
 * The identifier can be derived from the client IP, the authenticated subject,
 * or the combination of both (route-scoped). Instances are registered as named
 * container services with their limits baked in, which keeps throttling
 * declarative in the route table.
 */
final class RateLimitMiddleware
{
    /** @var 'ip'|'user'|'ip_user' */
    private readonly string $identifierMode;

    public function __construct(
        private readonly RateLimiter $limiter,
        private readonly string $scope,
        private readonly int $maxHits,
        private readonly int $windowSeconds,
        private readonly int $blockSeconds = 0,
        string $identifierMode = 'ip',
        private readonly ?string $message = null,
    ) {
        $this->identifierMode = in_array($identifierMode, ['ip', 'user', 'ip_user'], true) ? $identifierMode : 'ip';
    }

    public function __invoke(Request $request, callable $next): Response
    {
        $this->limiter->consume(
            $this->scope,
            $this->identifier($request),
            $this->maxHits,
            $this->windowSeconds,
            $this->blockSeconds,
            $this->message,
        );

        return $next($request);
    }

    private function identifier(Request $request): string
    {
        $principal = $request->attribute('auth');

        return match ($this->identifierMode) {
            'user' => $principal instanceof AuthenticatedUser
                ? 'user:' . $principal->id
                : 'ip:' . $request->clientIp(),
            'ip_user' => ($principal instanceof AuthenticatedUser ? 'user:' . $principal->id : 'anonymous')
                . '|ip:' . $request->clientIp(),
            default => 'ip:' . $request->clientIp(),
        };
    }
}
