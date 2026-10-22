<?php

declare(strict_types=1);

namespace Shopio\Controllers;

use Shopio\Http\Request;
use Shopio\Http\Response;

/**
 * Unauthenticated liveness probe. Deliberately exposes no version, stack,
 * dependency or configuration detail.
 */
final class HealthController extends Controller
{
    public function show(Request $request): Response
    {
        return $this->success([
            'status' => 'ok',
            'time' => gmdate('c'),
        ], 'Service is healthy', 200, [], $request);
    }
}
