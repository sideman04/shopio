<?php

declare(strict_types=1);

namespace Shopio\Controllers;

use Shopio\Http\Request;
use Shopio\Http\Response;
use Shopio\Services\PaymentService;

/**
 * Provider webhook intake. Signature verification, replay protection and the
 * resulting state changes all live in {@see PaymentService}; this controller only
 * passes the raw body and headers through unchanged.
 */
final class PaymentWebhookController extends Controller
{
    public function __construct(private readonly PaymentService $payments)
    {
    }

    /**
     * @param array<string,string> $params
     */
    public function handle(Request $request, array $params): Response
    {
        $provider = (string) ($params['provider'] ?? '');
        $result = $this->payments->handleWebhook($provider, $request->rawBody(), $request->headers(), $request);

        return $this->success($result, 'Webhook processed', 200, [], $request);
    }
}
