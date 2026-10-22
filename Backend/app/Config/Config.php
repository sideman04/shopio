<?php

declare(strict_types=1);

namespace Shopio\Config;

use Dotenv\Dotenv;
use Shopio\Exceptions\ConfigException;

/**
 * Centralised, immutable-after-boot configuration.
 *
 * Values are read from the process environment, which is populated from `.env`
 * in local development. Tests may override values through {@see Config::set()}.
 */
final class Config
{
    /** @var array<string,string> */
    private static array $values = [];

    private static bool $loaded = false;

    private static ?string $rootDir = null;

    public static function boot(string $rootDir): void
    {
        if (self::$loaded) {
            return;
        }

        self::$rootDir = rtrim($rootDir, '/');

        $envFile = self::$rootDir . '/.env';
        if (is_file($envFile)) {
            try {
                Dotenv::createImmutable(self::$rootDir, '.env')->safeLoad();
            } catch (\Throwable $e) {
                throw new ConfigException('Unable to load environment file: ' . $e->getMessage(), 0, $e);
            }
        }

        self::$loaded = true;
    }

    public static function rootDir(): string
    {
        if (self::$rootDir === null) {
            throw new ConfigException('Configuration root directory has not been set.');
        }

        return self::$rootDir;
    }

    /** Explicit override, primarily for tests. */
    public static function set(string $key, string $value): void
    {
        self::$values[$key] = $value;
    }

    public static function reset(): void
    {
        self::$values = [];
        self::$loaded = false;
        self::$rootDir = null;
    }

    public static function has(string $key): bool
    {
        return self::raw($key) !== null;
    }

    public static function get(string $key, ?string $default = null): ?string
    {
        $value = self::raw($key);

        return $value === null ? $default : $value;
    }

    public static function require(string $key): string
    {
        $value = self::raw($key);
        if ($value === null || $value === '') {
            throw new ConfigException(sprintf('Missing required configuration key "%s".', $key));
        }

        return $value;
    }

    public static function bool(string $key, bool $default = false): bool
    {
        $value = self::raw($key);
        if ($value === null || $value === '') {
            return $default;
        }

        return in_array(strtolower($value), ['1', 'true', 'yes', 'on'], true);
    }

    public static function int(string $key, int $default = 0): int
    {
        $value = self::raw($key);
        if ($value === null || $value === '') {
            return $default;
        }

        if (!is_numeric($value)) {
            throw new ConfigException(sprintf('Configuration key "%s" must be numeric.', $key));
        }

        return (int) $value;
    }

    /**
     * @return list<string>
     */
    public static function list(string $key, array $default = []): array
    {
        $value = self::raw($key);
        if ($value === null || $value === '') {
            return $default;
        }

        $parts = array_map(static fn (string $item): string => trim($item), explode(',', $value));

        return array_values(array_filter($parts, static fn (string $item): bool => $item !== ''));
    }

    public static function isProduction(): bool
    {
        return self::get('APP_ENV', 'production') === 'production';
    }

    public static function isDebug(): bool
    {
        return self::bool('APP_DEBUG', false);
    }

    private static function raw(string $key): ?string
    {
        if (array_key_exists($key, self::$values)) {
            return self::$values[$key];
        }

        $value = $_ENV[$key] ?? $_SERVER[$key] ?? getenv($key);
        if ($value === false) {
            return null;
        }

        return (string) $value;
    }
}
