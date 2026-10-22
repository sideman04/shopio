<?php

declare(strict_types=1);

namespace Shopio\Tests\Support;

use Shopio\Kernel;
use Shopio\Support\Container;

/**
 * Holds the single booted kernel for the whole test process.
 *
 * Booting once mirrors a long-running worker: configuration, container bindings
 * and routes are resolved a single time, while every test resets the database.
 */
final class TestApplication
{
    private static ?Kernel $kernel = null;

    public static function boot(string $root): void
    {
        self::$kernel ??= Kernel::boot($root);
    }

    public static function kernel(): Kernel
    {
        if (self::$kernel === null) {
            throw new \RuntimeException('The test application has not been booted.');
        }

        return self::$kernel;
    }

    public static function container(): Container
    {
        return self::kernel()->container();
    }

    /**
     * @template T of object
     * @param class-string<T> $id
     * @return T
     */
    public static function make(string $id): object
    {
        return self::container()->get($id);
    }
}
