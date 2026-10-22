<?php

declare(strict_types=1);

namespace Shopio\Tests\Feature;

use Shopio\Config\Config;
use Shopio\Database\Database;
use Shopio\Payments\SandboxGateway;
use Shopio\Repositories\InventoryRepository;
use Shopio\Tests\Support\Commerce;
use Shopio\Tests\Support\Factory;
use Shopio\Tests\Support\TestApplication;
use Shopio\Tests\TestCase;

/**
 * Provider webhook intake: signature verification, timestamp freshness, replay
 * protection and the state changes a trusted `payment.succeeded` produces.
 *
 * The webhook is the only path that may declare a payment as captured, so these
 * tests treat a forged or stale request as the primary attack surface.
 */
final class WebhookTest extends TestCase
{
    use Commerce;

    private function db(): Database
    {
        return TestApplication::make(Database::class);
    }

    public function test_a_valid_webhook_marks_the_payment_paid_and_settles_stock(): void
    {
        $bundle = Factory::sellerWithProduct(10, '300.00');
        $customer = Factory::user();
        $variantId = (int) $bundle['variant']['id'];

        $this->addToCart($customer, $variantId, 3);
        $checkout = $this->checkout($customer);
        $this->assertStatus(201, $checkout);
        $orderId = (int) $checkout->dataArray()['order']['id'];

        $payment = $this->initiatePayment($customer, $orderId);
        $reference = (string) $payment['providerReference'];

        $response = $this->sendWebhook($this->paymentSucceededEvent($reference, 'evt_ok_0001'));
        $this->assertStatus(200, $response);
        $this->assertSame('processed', $response->dataArray()['status']);

        $order = $this->db()->selectOne('SELECT status, payment_status FROM orders WHERE id = :id', ['id' => $orderId]);
        $this->assertSame('paid', $order['payment_status']);
        $this->assertSame('confirmed', $order['status']);

        $paymentRow = $this->db()->selectOne('SELECT status FROM payments WHERE order_id = :id', ['id' => $orderId]);
        $this->assertSame('succeeded', $paymentRow['status']);

        // The hold became a sale: reserved back to zero, on-hand decremented.
        $inventory = TestApplication::make(InventoryRepository::class)->forVariant($variantId);
        $this->assertSame(7, (int) $inventory['quantity_on_hand']);
        $this->assertSame(0, (int) $inventory['quantity_reserved']);

        $reservation = $this->db()->selectOne('SELECT status FROM stock_reservations WHERE order_id = :id', ['id' => $orderId]);
        $this->assertSame('consumed', $reservation['status']);
    }

    public function test_an_unsigned_webhook_is_rejected(): void
    {
        $raw = $this->encode($this->paymentSucceededEvent('sbx_x', 'evt_unsigned'));

        $this->assertStatus(400, $this->rawWebhookRaw($raw, ['content-type' => 'application/json']));
    }

    public function test_a_forged_signature_is_rejected(): void
    {
        $raw = $this->encode(['id' => 'evt_forged', 'type' => 'payment.succeeded', 'data' => ['provider_reference' => 'sbx_x']]);

        $this->assertStatus(400, $this->rawWebhookRaw($raw, [
            'content-type' => 'application/json',
            'x-shopio-signature' => str_repeat('0', 64),
            'x-shopio-timestamp' => (string) time(),
        ]));
    }

    public function test_a_body_tampered_after_signing_is_rejected(): void
    {
        $original = $this->encode(['id' => 'evt_tamper', 'type' => 'payment.succeeded', 'data' => ['provider_reference' => 'sbx_x']]);
        $tampered = $this->encode(['id' => 'evt_tamper', 'type' => 'payment.succeeded', 'data' => ['provider_reference' => 'sbx_evil']]);
        $timestamp = time();
        $signature = SandboxGateway::sign($original, $timestamp, $this->secret());

        $this->assertStatus(400, $this->rawWebhookRaw($tampered, [
            'content-type' => 'application/json',
            'x-shopio-signature' => $signature,
            'x-shopio-timestamp' => (string) $timestamp,
        ]));
    }

    public function test_a_stale_timestamp_is_rejected(): void
    {
        $raw = $this->encode($this->paymentSucceededEvent('sbx_x', 'evt_stale'));
        $staleTimestamp = time() - 3600;
        $signature = SandboxGateway::sign($raw, $staleTimestamp, $this->secret());

        $this->assertStatus(400, $this->rawWebhookRaw($raw, [
            'content-type' => 'application/json',
            'x-shopio-signature' => $signature,
            'x-shopio-timestamp' => (string) $staleTimestamp,
        ]));
    }

    public function test_an_unknown_provider_fails_closed(): void
    {
        $raw = $this->encode($this->paymentSucceededEvent('sbx_x', 'evt_unknown_provider'));
        $timestamp = time();
        $signature = SandboxGateway::sign($raw, $timestamp, $this->secret());

        $response = $this->rawWebhookRaw($raw, [
            'content-type' => 'application/json',
            'x-shopio-signature' => $signature,
            'x-shopio-timestamp' => (string) $timestamp,
        ], 'stripe');

        $this->assertStatus(422, $response);
    }

    public function test_a_signed_webhook_for_an_unknown_reference_is_rejected(): void
    {
        $response = $this->sendWebhook($this->paymentSucceededEvent('sbx_does_not_exist', 'evt_unknown_ref'));
        $this->assertStatus(404, $response);

        // The failed event is recorded for forensics but nothing was mutated.
        $this->assertSame(0, (int) $this->db()->scalar("SELECT COUNT(*) FROM payments WHERE status = 'succeeded'"));
    }

    public function test_replaying_the_same_event_is_ignored(): void
    {
        $bundle = Factory::sellerWithProduct(5, '100.00');
        $customer = Factory::user();
        $this->addToCart($customer, (int) $bundle['variant']['id'], 1);

        $checkout = $this->checkout($customer);
        $this->assertStatus(201, $checkout);
        $orderId = (int) $checkout->dataArray()['order']['id'];

        $payment = $this->initiatePayment($customer, $orderId);
        $event = $this->paymentSucceededEvent((string) $payment['providerReference'], 'evt_replay_0001');

        $first = $this->sendWebhook($event);
        $this->assertStatus(200, $first);
        $this->assertSame('processed', $first->dataArray()['status']);

        // A byte-identical redelivery must not double-settle or error.
        $second = $this->sendWebhook($event);
        $this->assertStatus(200, $second);
        $this->assertSame('duplicate', $second->dataArray()['status']);

        $inventory = TestApplication::make(InventoryRepository::class)->forVariant((int) $bundle['variant']['id']);
        $this->assertSame(4, (int) $inventory['quantity_on_hand']);
        $this->assertSame(0, (int) $inventory['quantity_reserved']);
        $this->assertSame(1, (int) $this->db()->scalar("SELECT COUNT(*) FROM inventory_movements WHERE movement_type = 'sale'"));
        $this->assertSame(1, (int) $this->db()->scalar('SELECT COUNT(*) FROM webhook_events'));
    }

    /**
     * @param array<string,string> $headers
     */
    private function rawWebhookRaw(string $raw, array $headers, string $provider = 'sandbox'): \Shopio\Tests\Support\TestResponse
    {
        return $this->request('POST', '/api/v1/webhooks/payments/' . $provider, [
            'raw' => $raw,
            'headers' => $headers,
        ]);
    }

    /**
     * @param array<string,mixed> $payload
     */
    private function encode(array $payload): string
    {
        $raw = json_encode($payload, JSON_UNESCAPED_SLASHES);

        return is_string($raw) ? $raw : '{}';
    }

    private function secret(): string
    {
        return (string) (Config::get('PAYMENT_SANDBOX_SECRET', '') ?? '');
    }
}
