<?php

declare(strict_types=1);

namespace Shopio\Tests\Support;

use Shopio\Http\Response;

/**
 * Thin, assertion-friendly wrapper around the framework {@see Response} so tests
 * can read the JSON envelope without touching transport concerns.
 */
final class TestResponse
{
    public function __construct(private readonly Response $response)
    {
    }

    public function status(): int
    {
        return $this->response->status();
    }

    public function body(): string
    {
        return $this->response->body();
    }

    /**
     * @return array<string,mixed>
     */
    public function json(): array
    {
        $decoded = json_decode($this->response->body(), true);

        return is_array($decoded) ? $decoded : [];
    }

    public function success(): bool
    {
        return (bool) ($this->json()['success'] ?? false);
    }

    public function message(): string
    {
        return (string) ($this->json()['message'] ?? '');
    }

    public function data(): mixed
    {
        return $this->json()['data'] ?? null;
    }

    /**
     * @return array<string,mixed>
     */
    public function dataArray(): array
    {
        $data = $this->data();

        return is_array($data) ? $data : [];
    }

    /**
     * @return array<string,mixed>
     */
    public function meta(): array
    {
        $meta = $this->json()['meta'] ?? [];

        return is_array($meta) ? $meta : [];
    }

    /**
     * @return array<string,list<string>>
     */
    public function errors(): array
    {
        $errors = $this->json()['errors'] ?? [];

        return is_array($errors) ? $errors : [];
    }

    public function error(string $field): ?string
    {
        $errors = $this->errors();

        return isset($errors[$field][0]) ? (string) $errors[$field][0] : null;
    }

    public function requestId(): string
    {
        return (string) ($this->json()['request_id'] ?? '');
    }

    public function header(string $name): ?string
    {
        foreach ($this->response->headers() as $key => $value) {
            if (strtolower((string) $key) === strtolower($name)) {
                return (string) $value;
            }
        }

        return null;
    }

    /**
     * @return list<string>
     */
    public function setCookies(): array
    {
        return $this->response->cookies();
    }

    /**
     * Returns the raw value of a named cookie from the Set-Cookie headers.
     */
    public function cookie(string $name): ?string
    {
        foreach ($this->response->cookies() as $cookie) {
            $pair = explode(';', $cookie, 2)[0];
            $equals = strpos($pair, '=');
            if ($equals === false) {
                continue;
            }

            $cookieName = rawurldecode(substr($pair, 0, $equals));
            if ($cookieName === $name) {
                return rawurldecode(substr($pair, $equals + 1));
            }
        }

        return null;
    }
}
