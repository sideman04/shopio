<?php

declare(strict_types=1);

namespace Shopio\Middleware;

use Shopio\Config\Config;
use Shopio\Exceptions\HttpException;
use Shopio\Http\Request;

/**
 * Rejects oversized bodies and content types we do not parse.
 *
 * Runs before routing so no request body is ever decoded for an unsupported
 * media type, and the size ceiling is enforced even if the web server did not.
 */
final class BodyGuardMiddleware
{
    private const UNSUPPORTED = 'The request content type is not supported.';

    public function assert(Request $request): void
    {
        $maxBytes = Config::int('UPLOAD_MAX_BYTES', 5_242_880) + 65_536;
        if ($request->contentLength() > $maxBytes) {
            throw new HttpException(413, 'Payload too large.');
        }

        $method = $request->method();
        if (in_array($method, ['GET', 'HEAD', 'OPTIONS', 'DELETE'], true)) {
            return;
        }

        if ($request->contentLength() === 0) {
            return;
        }

        if ($request->isJson() || $request->isMultipart()
            || str_contains(strtolower($request->header('content-type', '') ?? ''), 'application/x-www-form-urlencoded')) {
            return;
        }

        throw new HttpException(415, self::UNSUPPORTED, [], ['content_type' => $request->header('content-type')]);
    }
}
