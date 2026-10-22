<?php

declare(strict_types=1);

namespace Shopio\Http;

use FastRoute\Dispatcher;
use FastRoute\RouteCollector;
use Shopio\Exceptions\NotFoundException;
use Shopio\Support\Container;

use function FastRoute\simpleDispatcher;

/**
 * Thin router over nikic/fast-route.
 *
 * Each route stores its controller action plus the ordered list of middleware
 * that must run before it. Middleware are resolved from the container and may be
 * either `class-string` (invokable) or `[class-string, method]`.
 */
final class Router
{
    private ?Dispatcher $dispatcher = null;

    /** @var array<string,callable> */
    private array $collectors = [];

    /** @var list<array{method:string,path:string,handler:mixed,middleware:list<mixed>}> */
    private array $routes = [];

    public function __construct(private readonly Container $container)
    {
    }

    /**
     * @param mixed            $handler    [ControllerClass::class, 'method']
     * @param list<mixed>      $middleware Ordered middleware definitions.
     */
    public function add(string $method, string $path, mixed $handler, array $middleware = []): void
    {
        $method = strtoupper($method);
        $path = '/' . ltrim($path, '/');

        $this->routes[] = [
            'method' => $method,
            'path' => $path,
            'handler' => $handler,
            'middleware' => $middleware,
        ];

        $this->collectors[] = function (RouteCollector $collector) use ($method, $path, $handler, $middleware): void {
            $collector->addRoute($method, $path, [
                'handler' => $handler,
                'middleware' => $middleware,
            ]);
        };
    }

    /**
     * @param list<mixed> $middleware
     */
    public function get(string $path, mixed $handler, array $middleware = []): void
    {
        $this->add('GET', $path, $handler, $middleware);
    }

    /**
     * @param list<mixed> $middleware
     */
    public function post(string $path, mixed $handler, array $middleware = []): void
    {
        $this->add('POST', $path, $handler, $middleware);
    }

    /**
     * @param list<mixed> $middleware
     */
    public function put(string $path, mixed $handler, array $middleware = []): void
    {
        $this->add('PUT', $path, $handler, $middleware);
    }

    /**
     * @param list<mixed> $middleware
     */
    public function patch(string $path, mixed $handler, array $middleware = []): void
    {
        $this->add('PATCH', $path, $handler, $middleware);
    }

    /**
     * @param list<mixed> $middleware
     */
    public function delete(string $path, mixed $handler, array $middleware = []): void
    {
        $this->add('DELETE', $path, $handler, $middleware);
    }

    /**
     * @return list<array{method:string,path:string}>
     */
    public function definitions(): array
    {
        return array_map(
            static fn (array $route): array => ['method' => $route['method'], 'path' => $route['path']],
            $this->routes,
        );
    }

    private function dispatcher(): Dispatcher
    {
        if ($this->dispatcher === null) {
            $collectors = $this->collectors;
            $this->dispatcher = simpleDispatcher(static function (RouteCollector $collector) use ($collectors): void {
                foreach ($collectors as $register) {
                    $register($collector);
                }
            });
        }

        return $this->dispatcher;
    }

    public function dispatch(Request $request): Response
    {
        $result = $this->dispatcher()->dispatch($request->method(), $request->path());

        return match ($result[0]) {
            Dispatcher::NOT_FOUND => throw new NotFoundException('The requested endpoint does not exist.'),
            Dispatcher::METHOD_NOT_ALLOWED => throw new \Shopio\Exceptions\HttpException(
                405,
                'The HTTP method is not supported for this endpoint.',
                [],
                ['allowed' => $result[1]],
            ),
            default => $this->run($request, $result[1], $result[2]),
        };
    }

    /**
     * @param array{handler:mixed,middleware:list<mixed>} $route
     * @param array<string,string>                        $params
     */
    private function run(Request $request, array $route, array $params): Response
    {
        $handler = function (Request $request) use ($route, $params): Response {
            [$controllerClass, $action] = $route['handler'];
            $controller = $this->container->get($controllerClass);

            if (!method_exists($controller, $action)) {
                throw new \Shopio\Exceptions\HttpException(500, 'Internal server error.', [], [
                    'route_action_missing' => $controllerClass . '::' . $action,
                ]);
            }

            $response = $controller->{$action}($request, $params);
            if (!$response instanceof Response) {
                throw new \Shopio\Exceptions\HttpException(500, 'Internal server error.', [], [
                    'route_return_type' => $controllerClass . '::' . $action,
                ]);
            }

            return $response;
        };

        $pipeline = array_reverse($route['middleware']);
        foreach ($pipeline as $middleware) {
            $next = $handler;
            $handler = fn (Request $request): Response => $this->resolveMiddleware($middleware)($request, $next);
        }

        return $handler($request);
    }

    private function resolveMiddleware(mixed $middleware): callable
    {
        if (is_callable($middleware)) {
            return $middleware;
        }

        if (is_string($middleware)) {
            return $this->container->get($middleware);
        }

        if (is_array($middleware) && count($middleware) === 2) {
            [$class, $method] = $middleware;
            $instance = $this->container->get($class);

            return static fn (Request $request, callable $next): Response => $instance->{$method}($request, $next);
        }

        throw new \Shopio\Exceptions\HttpException(500, 'Internal server error.', [], ['middleware_invalid' => true]);
    }
}
