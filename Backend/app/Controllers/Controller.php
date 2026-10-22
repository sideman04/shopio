<?php

declare(strict_types=1);

namespace Shopio\Controllers;

use Shopio\Auth\AuthenticatedUser;
use Shopio\Exceptions\AuthorizationException;
use Shopio\Http\Request;
use Shopio\Http\Response;

/**
 * Base controller.
 *
 * Controllers stay thin: validate, delegate to a service, present the result.
 * Identity is always taken from the request attribute set by AuthMiddleware and
 * never from user input.
 */
abstract class Controller
{
    /**
     * @param mixed                $data
     * @param array<string,mixed>  $meta
     */
    protected function success(
        mixed $data = null,
        string $message = 'Request completed successfully',
        int $status = 200,
        array $meta = [],
        ?Request $request = null,
    ): Response {
        return Response::success($data, $message, $status, $meta, $this->requestId($request));
    }

    /**
     * @param array<string,mixed> $meta
     */
    protected function created(mixed $data, string $message = 'Resource created successfully', array $meta = [], ?Request $request = null): Response
    {
        return $this->success($data, $message, 201, $meta, $request);
    }

    protected function noContent(): Response
    {
        return Response::noContent();
    }

    protected function paginated(mixed $items, int $total, int $page, int $perPage, string $message = 'Request completed successfully', ?Request $request = null): Response
    {
        $totalPages = $perPage > 0 ? (int) ceil($total / $perPage) : 0;

        return $this->success($items, $message, 200, [
            'pagination' => [
                'total' => $total,
                'page' => $page,
                'per_page' => $perPage,
                'total_pages' => $totalPages,
                'has_more' => $page < $totalPages,
            ],
        ], $request);
    }

    /**
     * @param list<string> $cookies Raw Set-Cookie values.
     */
    protected function withCookies(Response $response, array $cookies): Response
    {
        foreach ($cookies as $cookie) {
            $response->withCookie((string) $cookie);
        }

        return $response;
    }

    protected function auth(Request $request): AuthenticatedUser
    {
        $principal = $request->attribute('auth');
        if (!$principal instanceof AuthenticatedUser) {
            throw new AuthorizationException();
        }

        return $principal;
    }

    protected function optionalAuth(Request $request): ?AuthenticatedUser
    {
        $principal = $request->attribute('auth');

        return $principal instanceof AuthenticatedUser ? $principal : null;
    }

    /**
     * @param array<string,string> $params
     */
    protected function intParam(array $params, string $key): int
    {
        return (int) ($params[$key] ?? 0);
    }

    protected function page(Request $request): int
    {
        return max(1, (int) $request->query('page', 1));
    }

    protected function perPage(Request $request, int $default = 20, int $max = 100): int
    {
        $value = (int) $request->query('per_page', $default);

        return max(1, min($max, $value === 0 ? $default : $value));
    }

    private function requestId(?Request $request): ?string
    {
        if ($request === null) {
            return null;
        }

        $id = $request->attribute('request_id');

        return is_string($id) ? $id : null;
    }
}
