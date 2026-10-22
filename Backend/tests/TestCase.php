<?php

declare(strict_types=1);

namespace Shopio\Tests;

use PHPUnit\Framework\TestCase as BaseTestCase;
use Shopio\Http\Request;
use Shopio\Http\Response;
use Shopio\Tests\Support\ResetDatabase;
use Shopio\Tests\Support\TestApplication;
use Shopio\Tests\Support\TestResponse;

/**
 * Base test case: boots the shared kernel, resets the database before every test
 * and provides an HTTP client that drives the real middleware pipeline.
 */
abstract class TestCase extends BaseTestCase
{
    use ResetDatabase;

    /** @var array<string,string|null> */
    private array $configBackup = [];

    protected function setUp(): void
    {
        parent::setUp();

        $this->resetDatabase();
    }

    protected function tearDown(): void
    {
        $this->restoreConfig();

        parent::tearDown();
    }

    /**
     * Overrides a configuration value for the current test only (restored in
     * tearDown). Values are injected into the environment, which Config reads
     * live, so no kernel reboot is required.
     */
    protected function setConfig(string $key, ?string $value): void
    {
        if (!array_key_exists($key, $this->configBackup)) {
            $this->configBackup[$key] = $_ENV[$key] ?? null;
        }

        if ($value === null) {
            unset($_ENV[$key], $_SERVER[$key]);

            return;
        }

        $_ENV[$key] = $value;
        $_SERVER[$key] = $value;
    }

    private function restoreConfig(): void
    {
        foreach ($this->configBackup as $key => $value) {
            if ($value === null) {
                unset($_ENV[$key], $_SERVER[$key]);
                continue;
            }

            $_ENV[$key] = $value;
            $_SERVER[$key] = $value;
        }

        $this->configBackup = [];
    }

    /**
     * @param array<string,mixed> $options
     */
    protected function request(string $method, string $path, array $options = []): TestResponse
    {
        $headers = [];
        foreach (($options['headers'] ?? []) as $name => $value) {
            $headers[strtolower((string) $name)] = (string) $value;
        }

        $rawBody = $options['raw'] ?? null;
        if (isset($options['json'])) {
            $rawBody = json_encode($options['json'], JSON_UNESCAPED_SLASHES);
            $headers['content-type'] = $headers['content-type'] ?? 'application/json';
        }

        if ($rawBody !== null && !isset($headers['content-type'])) {
            $headers['content-type'] = 'application/json';
        }

        $request = new Request(
            strtoupper($method),
            $path,
            $headers,
            $options['query'] ?? [],
            $options['form'] ?? [],
            $options['files'] ?? [],
            $options['cookies'] ?? [],
            (string) ($options['ip'] ?? '127.0.0.1'),
            is_string($rawBody) ? $rawBody : null,
            $options['server'] ?? [],
        );

        return new TestResponse(TestApplication::kernel()->handle($request));
    }

    /**
     * @param array<string,mixed> $json
     * @param array<string,string> $headers
     */
    protected function get(string $path, array $query = [], array $headers = []): TestResponse
    {
        return $this->request('GET', $path, ['query' => $query, 'headers' => $headers]);
    }

    /**
     * @param array<string,mixed> $json
     * @param array<string,string> $headers
     */
    protected function postJson(string $path, array $json = [], array $headers = []): TestResponse
    {
        return $this->request('POST', $path, ['json' => $json, 'headers' => $headers]);
    }

    /**
     * @param array<string,mixed> $json
     * @param array<string,string> $headers
     */
    protected function patchJson(string $path, array $json = [], array $headers = []): TestResponse
    {
        return $this->request('PATCH', $path, ['json' => $json, 'headers' => $headers]);
    }

    /**
     * @param array<string,mixed> $json
     * @param array<string,string> $headers
     */
    protected function putJson(string $path, array $json = [], array $headers = []): TestResponse
    {
        return $this->request('PUT', $path, ['json' => $json, 'headers' => $headers]);
    }

    /**
     * @param array<string,string> $headers
     */
    protected function delete(string $path, array $headers = []): TestResponse
    {
        return $this->request('DELETE', $path, ['headers' => $headers]);
    }

    /**
     * @param array<string,mixed> $user
     * @param array<string,string> $headers
     */
    protected function bearer(array $user, array $headers = []): array
    {
        return $headers + ['authorization' => 'Bearer ' . \Shopio\Tests\Support\Factory::token((int) $user['id'])];
    }

    protected function json(TestResponse $response): array
    {
        return $response->json();
    }

    protected function assertEnvelope(TestResponse $response): void
    {
        $json = $response->json();
        $this->assertArrayHasKey('success', $json, 'Response envelope missing "success".');
        $this->assertArrayHasKey('message', $json, 'Response envelope missing "message".');
    }

    /**
     * Convenience: assert a status code and include the response body on failure.
     */
    protected function assertStatus(int $expected, Response|TestResponse $response): void
    {
        $status = $response instanceof TestResponse ? $response->status() : $response->status();
        $body = $response instanceof TestResponse ? $response->body() : $response->body();

        $this->assertSame($expected, $status, "Unexpected status. Body: {$body}");
    }
}
