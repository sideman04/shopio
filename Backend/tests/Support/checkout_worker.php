<?php

declare(strict_types=1);

/**
 * Out-of-process checkout worker used by the concurrency test.
 *
 * Boots the full application kernel against the test database, waits until a
 * shared start timestamp so two workers race for the same stock row, then issues
 * a single checkout and prints the resulting status/body as JSON.
 *
 * This is intentionally a plain script (not a PHPUnit test) so it can be spawned
 * with proc_open and given its own PDO connection.
 *
 * Usage: php checkout_worker.php '{"token":"...","body":{...},"start":1234.56}'
 */

use Shopio\Http\Request;
use Shopio\Tests\Support\TestApplication;

$root = dirname(__DIR__, 2);

require $root . '/tests/bootstrap.php';

/** @var array<string,mixed> $args */
$args = json_decode((string) ($argv[1] ?? '{}'), true);
if (!is_array($args)) {
    fwrite(STDERR, "invalid args\n");
    echo json_encode(['status' => 0, 'body' => '']);

    return;
}

$startAt = (float) ($args['start'] ?? 0.0);
$waitMicros = (int) (($startAt - microtime(true)) * 1_000_000);
if ($waitMicros > 0) {
    usleep($waitMicros);
}

$token = (string) ($args['token'] ?? '');
$body = is_array($args['body'] ?? null) ? $args['body'] : [];
$raw = json_encode($body, JSON_UNESCAPED_SLASHES);
$raw = is_string($raw) ? $raw : '{}';

$request = new Request(
    'POST',
    '/api/v1/orders',
    [
        'content-type' => 'application/json',
        'content-length' => (string) strlen($raw),
        'authorization' => 'Bearer ' . $token,
    ],
    [],
    [],
    [],
    [],
    '127.0.0.1',
    $raw,
);

$response = TestApplication::kernel()->handle($request);

echo json_encode(['status' => $response->status(), 'body' => $response->body()]);
