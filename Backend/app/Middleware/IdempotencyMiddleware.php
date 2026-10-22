<?php

declare(strict_types=1);

namespace Shopio\Middleware;

use Shopio\Auth\AuthenticatedUser;
use Shopio\Config\Config;
use Shopio\Exceptions\ConflictException;
use Shopio\Http\Request;
use Shopio\Http\Response;
use Shopio\Repositories\IdempotencyRepository;
use Shopio\Support\Logger;
use Shopio\Support\Str;

/**
 * Idempotent write handling for retryable, side-effecting endpoints (checkout,
 * payment capture, refunds, payouts).
 *
 * Contract:
 *   - missing key            => pass through untouched;
 *   - new key                => reserve, run the handler, persist the response;
 *   - replay (same key+body) => return the stored response without re-running;
 *   - conflict (same key, different body) => 409;
 *   - in progress            => 409 so the client retries with backoff.
 *
 * The reservation is committed before the handler runs, and the handler's
 * transaction is independent of it; a crashed handler leaves a `failed` record
 * that a retry with the same key is allowed to reuse.
 */
final class IdempotencyMiddleware
{
    public function __construct(
        private readonly IdempotencyRepository $keys,
        private readonly string $scope = 'default',
        private readonly ?int $ttlSeconds = null,
    ) {
    }

    public function __invoke(Request $request, callable $next): Response
    {
        $idemKey = $this->normaliseKey($request->header('idempotency-key'));
        if ($idemKey === null) {
            return $next($request);
        }

        $principal = $request->attribute('auth');
        $userId = $principal instanceof AuthenticatedUser ? $principal->id : null;
        $subjectKey = $this->subjectKey($request, $userId);

        $requestHash = hash('sha256', $request->method() . ' ' . $request->path() . ' ' . $this->canonicalBody($request));

        $begin = $this->keys->begin(
            $this->scope,
            $subjectKey,
            $userId,
            $idemKey,
            $requestHash,
            $this->ttlSeconds ?? Config::int('IDEMPOTENCY_TTL_SECONDS', 86_400),
        );

        switch ($begin['state']) {
            case 'conflict':
                throw new ConflictException(
                    'This idempotency key was already used with a different request.',
                    ['idempotency_key' => ['Key reused with a different payload.']],
                );

            case 'in_progress':
                throw new ConflictException('A request with this idempotency key is still being processed.', [
                    'idempotency_key' => ['Please retry shortly.'],
                ]);

            case 'replay':
                return $this->replay($begin['row'] ?? []);
        }

        $id = $begin['id'];

        try {
            $response = $next($request);
        } catch (\Throwable $e) {
            if (is_int($id)) {
                $this->keys->fail($id);
            }

            throw $e;
        }

        if (is_int($id) && $response->status() < 500) {
            $this->keys->complete($id, $response->status(), [
                'status' => $response->status(),
                'headers' => $response->headers(),
                'cookies' => $response->cookies(),
                'body' => $response->body(),
            ]);
        } elseif (is_int($id)) {
            // 5xx responses are not cached so the client can retry the same key.
            $this->keys->fail($id);
        }

        return $response;
    }

    /**
     * @param array<string,mixed> $row
     */
    private function replay(array $row): Response
    {
        $stored = json_decode((string) ($row['response_body'] ?? ''), true);
        if (!is_array($stored)) {
            throw new ConflictException('This request has already been processed.');
        }

        $status = (int) ($stored['status'] ?? 200);
        $body = (string) ($stored['body'] ?? '');
        $headers = is_array($stored['headers'] ?? null) ? $stored['headers'] : [];
        $cookies = is_array($stored['cookies'] ?? null) ? $stored['cookies'] : [];

        $response = new Response($status, $body, $headers);
        foreach ($cookies as $cookie) {
            if (is_string($cookie)) {
                $response->withCookie($cookie);
            }
        }

        Logger::instance()->debug('idempotent_replay', ['scope' => $this->scope]);

        return $response;
    }

    private function subjectKey(Request $request, ?int $userId): string
    {
        if ($userId !== null) {
            return 'user:' . $userId;
        }

        // Guests are keyed on a coarse fingerprint so a shared NAT is not
        // completely collapsed into one bucket.
        $fingerprint = hash('sha256', $request->clientIp() . '|' . ($request->userAgent() ?? ''));

        return 'guest:' . substr($fingerprint, 0, 32);
    }

    private function normaliseKey(?string $value): ?string
    {
        if ($value === null) {
            return null;
        }

        $value = trim($value);
        if ($value === '' || strlen($value) > 255) {
            return null;
        }

        return Str::assertSafeText($value, 'idempotency_key');
    }

    private function canonicalBody(Request $request): string
    {
        $body = $request->body();
        if ($body === []) {
            return '';
        }

        $this->ksortRecursive($body);
        $encoded = json_encode($body, JSON_UNESCAPED_SLASHES | JSON_INVALID_UTF8_SUBSTITUTE);

        return $encoded === false ? '' : $encoded;
    }

    /**
     * @param array<string,mixed> $array
     */
    private function ksortRecursive(array &$array): void
    {
        ksort($array);
        foreach ($array as &$value) {
            if (is_array($value)) {
                $this->ksortRecursive($value);
            }
        }
    }
}
