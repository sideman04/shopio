<?php

declare(strict_types=1);

namespace Shopio\Http;

use Shopio\Config\Config;
use Shopio\Exceptions\ValidationException;
use Shopio\Support\IpMatcher;

/**
 * Immutable-ish representation of the inbound HTTP request.
 *
 * The client IP is only taken from forwarding headers when the direct peer is a
 * configured trusted proxy, so `X-Forwarded-For` cannot be spoofed to defeat IP
 * based rate limiting.
 */
final class Request
{
    /** @var array<string,mixed> */
    private array $attributes = [];

    /** @var array<string,mixed>|null */
    private ?array $parsedBody = null;

    private bool $bodyParsed = false;

    private ?string $rawBody = null;

    /**
     * @param array<string,string> $headers Lower-cased header names.
     * @param array<string,mixed>  $query
     * @param array<string,mixed>  $post
     * @param array<string,mixed>  $files
     * @param array<string,string> $cookies
     */
    public function __construct(
        private string $method,
        private string $path,
        private array $headers,
        private array $query = [],
        private array $post = [],
        private array $files = [],
        private array $cookies = [],
        private string $remoteAddress = '0.0.0.0',
        private ?string $rawBodyInput = null,
        /** @var array<string,mixed> */
        private array $server = [],
    ) {
    }

    /**
     * Builds a request from PHP superglobals.
     */
    public static function fromGlobals(): self
    {
        $method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');
        $uri = (string) ($_SERVER['REQUEST_URI'] ?? '/');
        $path = parse_url($uri, PHP_URL_PATH);
        $path = is_string($path) ? $path : '/';

        $headers = self::collectHeaders($_SERVER);

        return new self(
            $method,
            $path,
            $headers,
            $_GET,
            $_POST,
            $_FILES,
            $_COOKIE,
            (string) ($_SERVER['REMOTE_ADDR'] ?? '0.0.0.0'),
            null,
            $_SERVER,
        );
    }

    /**
     * @param array<string,mixed> $server
     * @return array<string,string>
     */
    private static function collectHeaders(array $server): array
    {
        $headers = [];
        foreach ($server as $key => $value) {
            if (str_starts_with((string) $key, 'HTTP_')) {
                $name = str_replace('_', '-', strtolower(substr((string) $key, 5)));
                $headers[$name] = (string) $value;
            } elseif (in_array($key, ['CONTENT_TYPE', 'CONTENT_LENGTH', 'CONTENT_MD5'], true)) {
                $name = str_replace('_', '-', strtolower((string) $key));
                $headers[$name] = (string) $value;
            }
        }

        return $headers;
    }

    public function method(): string
    {
        return $this->method;
    }

    public function path(): string
    {
        return $this->path;
    }

    /**
     * Re-roots the request path after stripping the API prefix.
     */
    public function withPath(string $path): self
    {
        $clone = clone $this;
        $clone->path = '/' . ltrim($path, '/');

        return $clone;
    }

    public function header(string $name, ?string $default = null): ?string
    {
        return $this->headers[strtolower($name)] ?? $default;
    }

    /**
     * @return array<string,string>
     */
    public function headers(): array
    {
        return $this->headers;
    }

    public function isJson(): bool
    {
        $contentType = strtolower($this->header('content-type', '') ?? '');

        return str_contains($contentType, 'application/json') || str_contains($contentType, '+json');
    }

    public function isMultipart(): bool
    {
        return str_contains(strtolower($this->header('content-type', '') ?? ''), 'multipart/form-data');
    }

    public function contentLength(): int
    {
        $length = $this->header('content-length');

        return $length === null ? 0 : (int) $length;
    }

    public function rawBody(): string
    {
        if ($this->rawBody !== null) {
            return $this->rawBody;
        }

        if ($this->rawBodyInput !== null) {
            return $this->rawBody = $this->rawBodyInput;
        }

        $body = file_get_contents('php://input');

        return $this->rawBody = $body === false ? '' : $body;
    }

    /**
     * Parsed JSON body, or multipart/form fields for file uploads.
     *
     * Invalid JSON raises a 422 rather than silently producing an empty array.
     *
     * @return array<string,mixed>
     */
    public function body(): array
    {
        if ($this->bodyParsed) {
            return $this->parsedBody ?? [];
        }

        $this->bodyParsed = true;

        if ($this->post !== [] || $this->isMultipart()) {
            $this->parsedBody = $this->post;

            return $this->parsedBody;
        }

        $raw = $this->rawBody();
        if ($raw === '') {
            $this->parsedBody = [];

            return $this->parsedBody;
        }

        if (!$this->isJson()) {
            // Non-JSON bodies are rejected by middleware; be conservative here.
            $this->parsedBody = [];

            return $this->parsedBody;
        }

        $decoded = json_decode($raw, true);
        if (!is_array($decoded)) {
            throw new ValidationException(['body' => ['Request body must be a valid JSON object.']]);
        }

        $this->parsedBody = $decoded;

        return $this->parsedBody;
    }

    public function input(string $key, mixed $default = null): mixed
    {
        $body = $this->body();
        if (array_key_exists($key, $body)) {
            return $body[$key];
        }

        return $this->query[$key] ?? $default;
    }

    public function query(string $key, mixed $default = null): mixed
    {
        return $this->query[$key] ?? $default;
    }

    /**
     * @return array<string,mixed>
     */
    public function queryAll(): array
    {
        return $this->query;
    }

    /**
     * @return array<string,mixed>
     */
    public function files(): array
    {
        return $this->files;
    }

    public function file(string $key): ?array
    {
        $file = $this->files[$key] ?? null;

        return is_array($file) ? $file : null;
    }

    public function cookie(string $name, ?string $default = null): ?string
    {
        return $this->cookies[$name] ?? $default;
    }

    /**
     * Opaque bearer token, if present. Never logged.
     */
    public function bearerToken(): ?string
    {
        $header = $this->header('authorization');
        if ($header === null || $header === '') {
            return null;
        }

        if (preg_match('/^Bearer\s+(.+)$/i', trim($header), $matches) !== 1) {
            return null;
        }

        $token = trim($matches[1]);

        return $token === '' ? null : $token;
    }

    /**
     * Client IP, honouring X-Forwarded-For only from trusted proxies.
     */
    public function clientIp(): string
    {
        $trusted = Config::list('TRUSTED_PROXIES');
        if ($trusted === [] || !IpMatcher::matchesAny($this->remoteAddress, $trusted)) {
            return $this->remoteAddress;
        }

        $forwarded = $this->header('x-forwarded-for');
        if ($forwarded === null || $forwarded === '') {
            return $this->remoteAddress;
        }

        $chain = array_map('trim', explode(',', $forwarded));

        // Walk right-to-left, skipping trusted proxies, and return the first
        // address that is not itself a trusted proxy.
        for ($i = count($chain) - 1; $i >= 0; $i--) {
            $candidate = $chain[$i];
            if (filter_var($candidate, FILTER_VALIDATE_IP) === false) {
                continue;
            }

            if (!IpMatcher::matchesAny($candidate, $trusted)) {
                return $candidate;
            }
        }

        return $this->remoteAddress;
    }

    public function userAgent(): ?string
    {
        $value = $this->header('user-agent');

        return $value === null ? null : mb_substr($value, 0, 500);
    }

    public function isSecure(): bool
    {
        if (($this->server['HTTPS'] ?? '') !== '' && ($this->server['HTTPS'] ?? 'off') !== 'off') {
            return true;
        }

        if (Config::list('TRUSTED_PROXIES') !== []
            && IpMatcher::matchesAny($this->remoteAddress, Config::list('TRUSTED_PROXIES'))
            && strtolower($this->header('x-forwarded-proto', '') ?? '') === 'https') {
            return true;
        }

        return false;
    }

    /**
     * @return array<string,mixed>
     */
    public function server(): array
    {
        return $this->server;
    }

    public function setAttribute(string $key, mixed $value): void
    {
        $this->attributes[$key] = $value;
    }

    public function attribute(string $key, mixed $default = null): mixed
    {
        return $this->attributes[$key] ?? $default;
    }

    /**
     * @return array<string,mixed>
     */
    public function attributes(): array
    {
        return $this->attributes;
    }
}
