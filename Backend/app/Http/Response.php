<?php

declare(strict_types=1);

namespace Shopio\Http;

/**
 * HTTP response with the Shopio JSON envelope.
 *
 * Success: {"success":true,"message":"...","data":{...},"meta":{...}}
 * Error:   {"success":false,"message":"...","errors":{...},"request_id":"..."}
 */
final class Response
{
    /** @var array<string,string> */
    private array $headers = [];

    /** @var list<string> Raw Set-Cookie values (a header name can repeat). */
    private array $cookies = [];

    /**
     * @param array<string,string> $headers
     */
    public function __construct(
        private int $status,
        private string $body = '',
        array $headers = [],
    ) {
        foreach ($headers as $name => $value) {
            $this->headers[$name] = $value;
        }
    }

    /**
     * @param array<string,mixed> $headers
     */
    public static function json(array $payload, int $status = 200, array $headers = []): self
    {
        $json = json_encode($payload, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE);
        if ($json === false) {
            $json = '{"success":false,"message":"Encoding error"}';
            $status = 500;
        }

        return new self($status, $json, array_merge(['Content-Type' => 'application/json; charset=utf-8'], $headers));
    }

    /**
     * @param array<string,mixed> $meta
     */
    public static function success(
        mixed $data = null,
        string $message = 'Request completed successfully',
        int $status = 200,
        array $meta = [],
        ?string $requestId = null,
    ): self {
        $payload = [
            'success' => true,
            'message' => $message,
            'data' => $data,
            'meta' => (object) $meta,
        ];

        if ($requestId !== null) {
            $payload['request_id'] = $requestId;
        }

        return self::json($payload, $status);
    }

    /**
     * @param array<string,mixed> $errors
     */
    public static function error(
        string $message,
        array $errors = [],
        int $status = 400,
        ?string $requestId = null,
        array $extra = [],
    ): self {
        $payload = [
            'success' => false,
            'message' => $message,
            'errors' => (object) $errors,
            'request_id' => $requestId ?? '',
        ];

        foreach ($extra as $key => $value) {
            $payload[$key] = $value;
        }

        return self::json($payload, $status);
    }

    public static function noContent(): self
    {
        return new self(204);
    }

    public function withHeader(string $name, string $value): self
    {
        $this->headers[$name] = $value;

        return $this;
    }

    /**
     * Adds a `Set-Cookie` value. Repeated calls emit multiple headers, which an
     * associative header map cannot represent.
     */
    public function withCookie(string $setCookieValue): self
    {
        if ($setCookieValue !== '') {
            $this->cookies[] = $setCookieValue;
        }

        return $this;
    }

    /**
     * @return list<string>
     */
    public function cookies(): array
    {
        return $this->cookies;
    }

    /**
     * @param array<string,string> $headers
     */
    public function withHeaders(array $headers): self
    {
        foreach ($headers as $name => $value) {
            $this->headers[$name] = $value;
        }

        return $this;
    }

    public function status(): int
    {
        return $this->status;
    }

    public function body(): string
    {
        return $this->body;
    }

    /**
     * @return array<string,string>
     */
    public function headers(): array
    {
        return $this->headers;
    }

    public function send(): void
    {
        if (!headers_sent()) {
            http_response_code($this->status);
            foreach ($this->headers as $name => $value) {
                header($name . ': ' . $value, false);
            }
            foreach ($this->cookies as $cookie) {
                header('Set-Cookie: ' . $cookie, false);
            }
        }

        if ($this->status !== 204 && $this->body !== '') {
            echo $this->body;
        }
    }
}
