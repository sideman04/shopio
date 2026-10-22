<?php

declare(strict_types=1);

namespace Shopio\Tests\Support;

use Shopio\Config\Config;
use Shopio\Payments\SandboxGateway;

/**
 * Reusable commerce scenarios shared by feature tests.
 *
 * These helpers drive the real HTTP pipeline (cart -> checkout -> payment ->
 * signed webhook) so a "paid order" produced here is indistinguishable from one
 * created by a live client. Nothing is inserted behind the application's back.
 */
trait Commerce
{
    /**
     * Adds a variant to the authenticated user's cart.
     *
     * @param array<string,mixed> $user
     * @param array<string,string> $headers
     */
    protected function addToCart(array $user, int $variantId, int $quantity = 1, array $headers = []): TestResponse
    {
        return $this->postJson(
            '/api/v1/cart/items',
            ['variant_id' => $variantId, 'quantity' => $quantity],
            $this->bearer($user, $headers),
        );
    }

    /**
     * Places an order for the current cart using inline shipping details.
     *
     * @param array<string,mixed>  $user
     * @param array<string,mixed>  $payload
     * @param array<string,string> $headers
     */
    protected function checkout(array $user, array $payload = [], array $headers = []): TestResponse
    {
        $defaults = [
            'customer_name' => (string) ($user['full_name'] ?? 'Test Customer'),
            'customer_email' => (string) ($user['email'] ?? 'buyer@example.test'),
            'customer_phone' => '+255700000000',
            'shipping_address_line' => '123 Test Street',
            'shipping_city' => 'Dar es Salaam',
            'shipping_region' => 'Dar es Salaam',
            'shipping_country_code' => 'TZ',
        ];

        return $this->postJson('/api/v1/orders', $payload + $defaults, $this->bearer($user, $headers));
    }

    /**
     * Initiates a mock payment for an order and returns the payment payload.
     *
     * @param array<string,mixed>  $user
     * @param array<string,string> $headers
     * @return array<string,mixed>
     */
    protected function initiatePayment(array $user, int $orderId, array $headers = []): array
    {
        $response = $this->postJson(
            '/api/v1/orders/' . $orderId . '/payments',
            ['provider' => 'sandbox'],
            $this->bearer($user, $headers),
        );

        $this->assertStatus(201, $response);

        return $response->dataArray();
    }

    /**
     * Signs and delivers a mock provider webhook through the HTTP pipeline.
     *
     * @param array<string,mixed> $payload
     * @param array<string,string> $headers
     */
    protected function sendWebhook(array $payload, array $headers = [], string $provider = 'sandbox'): TestResponse
    {
        $secret = (string) (Config::get('PAYMENT_SANDBOX_SECRET', '') ?? '');
        $timestamp = time();
        $raw = json_encode($payload, JSON_UNESCAPED_SLASHES);
        $raw = is_string($raw) ? $raw : '{}';

        $signature = SandboxGateway::sign($raw, $timestamp, $secret);

        return $this->request('POST', '/api/v1/webhooks/payments/' . $provider, [
            'raw' => $raw,
            'headers' => [
                'content-type' => 'application/json',
                'x-shopio-signature' => $signature,
                'x-shopio-timestamp' => (string) $timestamp,
            ] + $headers,
        ]);
    }

    /**
     * Builds a payment.succeeded webhook payload.
     *
     * @return array<string,mixed>
     */
    protected function paymentSucceededEvent(string $providerReference, string $eventId): array
    {
        return [
            'id' => $eventId,
            'type' => 'payment.succeeded',
            'data' => ['provider_reference' => $providerReference],
        ];
    }

    /**
     * Full scenario: checkout the user's cart and settle it with a captured
     * mock payment. Returns the order id and the succeeded payment row.
     *
     * @param array<string,mixed> $user
     * @return array{orderId:int,payment:array<string,mixed>}
     */
    protected function placePaidOrder(array $user, array $checkoutPayload = []): array
    {
        $checkout = $this->checkout($user, $checkoutPayload);
        $this->assertStatus(201, $checkout);
        $orderId = (int) ($checkout->dataArray()['order']['id'] ?? 0);

        $payment = $this->initiatePayment($user, $orderId);
        $reference = (string) ($payment['providerReference'] ?? '');

        $webhook = $this->sendWebhook($this->paymentSucceededEvent($reference, 'evt_' . bin2hex(random_bytes(8))));
        $this->assertStatus(200, $webhook);

        return ['orderId' => $orderId, 'payment' => $payment];
    }

    /**
     * Convenience wrapper that also registers the customer.
     *
     * @return array{user:array<string,mixed>,session:array<string,mixed>}
     */
    protected function registerCustomer(array $overrides = []): array
    {
        $response = $this->postJson('/api/v1/auth/register', $overrides + [
            'full_name' => 'New Customer',
            'email' => Factory::uniqueEmail(),
            'password' => Factory::PASSWORD,
            'password_confirmation' => Factory::PASSWORD,
            'accept_terms' => 1,
        ]);

        $this->assertStatus(201, $response);

        return $response->dataArray();
    }
}
