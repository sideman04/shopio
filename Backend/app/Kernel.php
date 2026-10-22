<?php

declare(strict_types=1);

namespace Shopio;

use Shopio\Config\Config;
use Shopio\Database\Database;
use Shopio\Exceptions\HttpException;
use Shopio\Exceptions\RateLimitException;
use Shopio\Exceptions\ValidationException;
use Shopio\Http\Request;
use Shopio\Http\Response;
use Shopio\Http\Router;
use Shopio\Middleware\AuthMiddleware;
use Shopio\Middleware\BodyGuardMiddleware;
use Shopio\Middleware\CorsMiddleware;
use Shopio\Middleware\CsrfMiddleware;
use Shopio\Middleware\IdempotencyMiddleware;
use Shopio\Middleware\OptionalAuthMiddleware;
use Shopio\Middleware\RateLimitMiddleware;
use Shopio\Middleware\RequireRoleMiddleware;
use Shopio\Middleware\SecurityHeadersMiddleware;
use Shopio\Payments\GatewayRegistry;
use Shopio\Payments\SandboxGateway;
use Shopio\Repositories\IdempotencyRepository;
use Shopio\Services\Mail\LogMailer;
use Shopio\Services\Mail\Mailer;
use Shopio\Services\Mail\NullMailer;
use Shopio\Services\RateLimiter;
use Shopio\Support\Container;
use Shopio\Support\ErrorHandler;
use Shopio\Support\Logger;
use Shopio\Support\Str;
use Throwable;

/**
 * Application kernel: boots configuration, builds the container, wires routes
 * and turns any thrown exception into a safe JSON envelope.
 */
final class Kernel
{
    private function __construct(
        private readonly Container $container,
        private readonly Router $router,
        private readonly string $prefix,
    ) {
    }

    public static function boot(string $rootDir): self
    {
        Config::boot($rootDir);

        Logger::boot(
            self::absolutePath($rootDir, Config::get('LOG_DIR', 'storage/logs') ?? 'storage/logs'),
            Config::get('LOG_LEVEL', 'info') ?? 'info',
        );

        ErrorHandler::register();

        $container = new Container();
        self::registerCoreBindings($container, $rootDir);
        self::registerNamedMiddleware($container);

        $router = new Router($container);

        /** @var callable(Router):void $registerRoutes */
        $registerRoutes = require $rootDir . '/routes/api.php';
        $registerRoutes($router);

        return new self($container, $router, Config::get('API_PREFIX', '/api/v1') ?? '/api/v1');
    }

    public static function bootForTests(string $rootDir): self
    {
        return self::boot($rootDir);
    }

    private static function registerCoreBindings(Container $container, string $rootDir): void
    {
        $container->instance(Container::class, $container);
        $container->instance(Logger::class, Logger::instance());
        $container->instance(Database::class, new Database());
        $container->instance(Mailer::class, self::mailer());
        $container->factory(GatewayRegistry::class, static function (Container $c): GatewayRegistry {
            $registry = new GatewayRegistry();
            $registry->register(new SandboxGateway());

            return $registry;
        });
    }

    private static function mailer(): Mailer
    {
        return match (strtolower(Config::get('MAIL_DRIVER', 'log') ?? 'log')) {
            'null', 'none' => new NullMailer(),
            default => new LogMailer(),
        };
    }

    /**
     * Registers the named middleware used by the route table. Middleware that
     * needs a non-class dependency (role list, throttle limits, scope) cannot be
     * autowired, so each variant is bound explicitly under a stable id.
     */
    private static function registerNamedMiddleware(Container $container): void
    {
        $container->instance('mw.auth', new AuthMiddleware($container->get(\Shopio\Services\AuthService::class)));
        $container->instance('mw.auth.optional', new OptionalAuthMiddleware($container->get(\Shopio\Services\AuthService::class)));
        $container->instance('mw.csrf', new CsrfMiddleware());

        $auth = $container->get(\Shopio\Services\AuthService::class);
        $container->instance('mw.role.admin', new RequireRoleMiddleware($auth, ['admin']));
        $container->instance('mw.role.seller', new RequireRoleMiddleware($auth, ['seller']));
        $container->instance('mw.role.admin_or_seller', new RequireRoleMiddleware($auth, ['admin', 'seller']));

        $container->instance('mw.idempotency', new IdempotencyMiddleware($container->get(IdempotencyRepository::class)));

        $container->factory('mw.ratelimit.login', static fn (Container $c): RateLimitMiddleware => new RateLimitMiddleware(
            $c->get(RateLimiter::class), 'http:login', 20, 300, 300, 'ip_user',
            'Too many attempts. Please try again later.',
        ));
        $container->factory('mw.ratelimit.register', static fn (Container $c): RateLimitMiddleware => new RateLimitMiddleware(
            $c->get(RateLimiter::class), 'http:register', 10, 3600, 3600, 'ip',
            'Too many sign-up attempts. Please try again later.',
        ));
        $container->factory('mw.ratelimit.password', static fn (Container $c): RateLimitMiddleware => new RateLimitMiddleware(
            $c->get(RateLimiter::class), 'http:password', 10, 3600, 900, 'ip',
            'Too many requests. Please try again later.',
        ));
        $container->factory('mw.ratelimit.write', static fn (Container $c): RateLimitMiddleware => new RateLimitMiddleware(
            $c->get(RateLimiter::class), 'http:write', 120, 60, 0, 'user',
            'Too many requests. Please slow down.',
        ));
        $container->factory('mw.ratelimit.checkout', static fn (Container $c): RateLimitMiddleware => new RateLimitMiddleware(
            $c->get(RateLimiter::class), 'http:checkout', 20, 300, 60, 'user',
            'Too many checkout attempts. Please try again shortly.',
        ));
        $container->factory('mw.ratelimit.support', static fn (Container $c): RateLimitMiddleware => new RateLimitMiddleware(
            $c->get(RateLimiter::class), 'http:support', 5, 3600, 3600, 'ip',
            'Too many messages. Please try again later.',
        ));
        $container->factory('mw.ratelimit.upload', static fn (Container $c): RateLimitMiddleware => new RateLimitMiddleware(
            $c->get(RateLimiter::class), 'http:upload', 60, 3600, 600, 'user',
            'Too many uploads. Please try again later.',
        ));
    }

    private static function absolutePath(string $rootDir, string $relative): string
    {
        if (str_starts_with($relative, '/')) {
            return $relative;
        }

        return rtrim($rootDir, '/') . '/' . $relative;
    }

    public function container(): Container
    {
        return $this->container;
    }

    public function router(): Router
    {
        return $this->router;
    }

    public function prefix(): string
    {
        return '/' . trim($this->prefix, '/');
    }

    /**
     * Runs the request through the global pipeline (body guard, CORS preflight,
     * routing) and then decorates the response with security headers and CORS.
     */
    public function handle(Request $request): Response
    {
        $requestId = $this->requestId($request);
        $request->setAttribute('request_id', $requestId);

        $response = $this->dispatch($request, $requestId);

        return $this->finalise($request, $response);
    }

    private function dispatch(Request $request, string $requestId): Response
    {
        try {
            // Reject oversized / unsupported bodies before any parsing happens.
            $this->container->get(BodyGuardMiddleware::class)->assert($request);

            if ($request->method() === 'OPTIONS') {
                return $this->container->get(CorsMiddleware::class)->preflight($request)
                    ->withHeader('X-Request-Id', $requestId);
            }

            $path = $this->normalisePath($request->path());

            return $this->router->dispatch($request->withPath($path))->withHeader('X-Request-Id', $requestId);
        } catch (RateLimitException $e) {
            return Response::error($e->getMessage(), $e->errors(), 429, $requestId, ['retry_after' => $e->retryAfter()])
                ->withHeader('Retry-After', (string) $e->retryAfter())
                ->withHeader('X-Request-Id', $requestId);
        } catch (ValidationException $e) {
            return Response::error('The given data was invalid.', $e->errors(), 422, $requestId)
                ->withHeader('X-Request-Id', $requestId);
        } catch (HttpException $e) {
            if ($e->statusCode() >= 500) {
                Logger::instance()->error('Unhandled application exception', [
                    'request_id' => $requestId,
                    'status' => $e->statusCode(),
                    'context' => $e->logContext(),
                ]);
            }

            return Response::error($e->getMessage(), $e->errors(), $e->statusCode(), $requestId)
                ->withHeaders($this->errorHeaders($e->statusCode()))
                ->withHeader('X-Request-Id', $requestId);
        } catch (Throwable $e) {
            Logger::instance()->critical('Unhandled exception', [
                'request_id' => $requestId,
                'exception' => $e::class,
                'message' => $e->getMessage(),
                'file' => basename($e->getFile()) . ':' . $e->getLine(),
            ]);

            $message = Config::isDebug()
                ? 'Internal server error: ' . $e->getMessage()
                : 'Internal server error.';

            return Response::error($message, [], 500, $requestId)
                ->withHeader('X-Request-Id', $requestId);
        }
    }

    /**
     * Applies the response decorators that must run for EVERY response, including
     * errors: baseline security headers and the strict-origin CORS reflection.
     */
    private function finalise(Request $request, Response $response): Response
    {
        $response = $this->container->get(SecurityHeadersMiddleware::class)->apply($request, $response);

        return $this->container->get(CorsMiddleware::class)->apply($request, $response);
    }

    /**
     * @return array<string,string>
     */
    private function errorHeaders(int $status): array
    {
        // Never let a browser cache an error, and prevent content sniffing.
        return [
            'Cache-Control' => 'no-store, no-cache, must-revalidate',
            'X-Content-Type-Options' => 'nosniff',
        ];
    }

    /**
     * Strips the configured API prefix and returns the route-relative path.
     *
     * The versioned prefix is canonical; a bare `/api` prefix is also accepted so
     * the existing React client (which defaults to `/api`) keeps working during
     * migration, and tools may hit the unversioned path directly in local dev.
     */
    private function normalisePath(string $path): string
    {
        $prefix = $this->prefix();

        if ($path === $prefix) {
            return '/';
        }

        if ($prefix !== '' && str_starts_with($path, $prefix . '/')) {
            return substr($path, strlen($prefix));
        }

        // Legacy unversioned namespace (`/api/...`).
        if ($path === '/api') {
            return '/';
        }

        if (str_starts_with($path, '/api/')) {
            return substr($path, 4);
        }

        // No recognised prefix: route against the raw path. Unknown paths still
        // 404 at the router, so this cannot broaden the API surface.
        return $path;
    }

    private function requestId(Request $request): string
    {
        // A caller-supplied id is echoed only if it is already opaque/safe.
        $incoming = $request->header('x-request-id');
        if ($incoming !== null && preg_match('/^[A-Za-z0-9._-]{8,64}$/', $incoming) === 1) {
            return $incoming;
        }

        return Str::uuidV4();
    }
}
