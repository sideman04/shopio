<?php

declare(strict_types=1);

/**
 * Front controller for the Shopio REST API.
 *
 * Only this directory is intended to be web-exposed. Application code, `.env`,
 * logs and private uploads live outside the document root (or are blocked by
 * `public/.htaccess` when the whole project is served).
 */

use Shopio\Http\Request;
use Shopio\Kernel;

$root = dirname(__DIR__);

require $root . '/vendor/autoload.php';

$kernel = Kernel::boot($root);

$request = Request::fromGlobals();

// Enforce the request body size ceiling before any parsing work happens.
$maxBytes = (int) ($_ENV['UPLOAD_MAX_BYTES'] ?? getenv('UPLOAD_MAX_BYTES') ?: 8_388_608) + 65_536;
if ($request->contentLength() > $maxBytes) {
    header('Content-Type: application/json; charset=utf-8');
    http_response_code(413);
    echo json_encode([
        'success' => false,
        'message' => 'Payload too large.',
        'errors' => (object) [],
        'request_id' => '',
    ]);
    exit;
}

$response = $kernel->handle($request);
$response->send();
