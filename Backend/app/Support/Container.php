<?php

declare(strict_types=1);

namespace Shopio\Support;

use Shopio\Exceptions\HttpException;

/**
 * Extremely small service container: explicit singletons plus reflection-based
 * autowiring for concrete classes. Deliberately framework-free.
 */
final class Container
{
    /** @var array<string,mixed> */
    private array $instances = [];

    /** @var array<string,callable(self):mixed> */
    private array $factories = [];

    public function instance(string $id, mixed $value): void
    {
        $this->instances[$id] = $value;
    }

    /**
     * @param callable(self):mixed $factory
     */
    public function factory(string $id, callable $factory): void
    {
        $this->factories[$id] = $factory;
    }

    public function has(string $id): bool
    {
        return isset($this->instances[$id]) || isset($this->factories[$id]);
    }

    /**
     * @template T of object
     * @param class-string<T>|string $id
     * @return ($id is class-string<T> ? T : mixed)
     */
    public function get(string $id): mixed
    {
        if (array_key_exists($id, $this->instances)) {
            return $this->instances[$id];
        }

        if (isset($this->factories[$id])) {
            $value = ($this->factories[$id])($this);
            $this->instances[$id] = $value;

            return $value;
        }

        if (!class_exists($id)) {
            throw new HttpException(500, 'Internal server error.', [], ['container_missing' => $id]);
        }

        return $this->instances[$id] = $this->autowire($id);
    }

    /**
     * @param class-string $class
     */
    private function autowire(string $class): object
    {
        $reflection = new \ReflectionClass($class);
        if (!$reflection->isInstantiable()) {
            throw new HttpException(500, 'Internal server error.', [], ['container_not_instantiable' => $class]);
        }

        $constructor = $reflection->getConstructor();
        if ($constructor === null || $constructor->getNumberOfParameters() === 0) {
            return new $class();
        }

        $arguments = [];
        foreach ($constructor->getParameters() as $parameter) {
            $type = $parameter->getType();
            if (!$type instanceof \ReflectionNamedType || $type->isBuiltin()) {
                if ($parameter->isDefaultValueAvailable()) {
                    $arguments[] = $parameter->getDefaultValue();
                    continue;
                }

                throw new HttpException(
                    500,
                    'Internal server error.',
                    [],
                    ['container_unresolvable' => $class . '::$' . $parameter->getName()],
                );
            }

            $arguments[] = $this->get($type->getName());
        }

        return $reflection->newInstanceArgs($arguments);
    }
}
