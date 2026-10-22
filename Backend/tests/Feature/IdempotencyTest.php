<?php

declare(strict_types=1);

namespace Shopio\Tests\Feature;

use Shopio\Database\Database;
use Shopio\Tests\Support\Commerce;
use Shopio\Tests\Support\Factory;
use Shopio\Tests\Support\TestApplication;
use Shopio\Tests\TestCase;

/**
 * Idempotency keys on retryable money/order endpoints.
 *
 * Contract under test: replay returns the original response without re-running
 * the side effect; reusing a key with a different payload is a 409; omitting the
 * key (or using a fresh one) executes normally each time.
 */
final class IdempotencyTest extends TestCase
{
    use Commerce;

    private function db(): Database
    {
        return TestApplication::make(Database::class);
    }

    public function test_replaying_the_same_checkout_returns_the_original_order(): void
    {
        $bundle = Factory::sellerWithProduct(5);
        $customer = Factory::user();
        $this->addToCart($customer, (int) $bundle['variant']['id'], 1);

        $headers = $this->bearer($customer, ['idempotency-key' => 'checkout-key-000001']);
        $payload = [
            'customer_name' => 'Idem Buyer',
            'customer_email' => $customer['email'],
            'customer_phone' => '+255700000000',
            'shipping_address_line' => '1 Idempotent Way',
            'shipping_city' => 'Dar es Salaam',
            'shipping_region' => 'Dar es Salaam',
        ];

        $first = $this->postJson('/api/v1/orders', $payload, $headers);
        $this->assertStatus(201, $first);

        // Re-add to the cart to prove the replay does NOT re-run checkout.
        $this->addToCart($customer, (int) $bundle['variant']['id'], 1);

        $replay = $this->postJson('/api/v1/orders', $payload, $headers);
        $this->assertStatus(201, $replay);

        $firstId = (int) $first->dataArray()['order']['id'];
        $replayId = (int) $replay->dataArray()['order']['id'];
        $this->assertSame($firstId, $replayId);
        $this->assertSame($first->body(), $replay->body());

        $this->assertSame(1, (int) $this->db()->scalar('SELECT COUNT(*) FROM orders'));
        $this->assertSame(1, (int) $this->db()->scalar('SELECT COUNT(*) FROM stock_reservations'));
    }

    public function test_reusing_a_key_with_a_different_payload_conflicts(): void
    {
        $bundle = Factory::sellerWithProduct(5);
        $customer = Factory::user();
        $this->addToCart($customer, (int) $bundle['variant']['id'], 1);

        $headers = $this->bearer($customer, ['idempotency-key' => 'checkout-key-000002']);
        $base = [
            'customer_name' => 'Idem Buyer',
            'customer_email' => $customer['email'],
            'customer_phone' => '+255700000000',
            'shipping_address_line' => '1 Idempotent Way',
            'shipping_city' => 'Dar es Salaam',
            'shipping_region' => 'Dar es Salaam',
        ];

        $this->assertStatus(201, $this->postJson('/api/v1/orders', $base, $headers));

        $conflict = $this->postJson('/api/v1/orders', $base + ['customer_note' => 'different payload'], $headers);
        $this->assertStatus(409, $conflict);

        $this->assertSame(1, (int) $this->db()->scalar('SELECT COUNT(*) FROM orders'));
    }

    public function test_a_missing_key_allows_multiple_orders(): void
    {
        $bundle = Factory::sellerWithProduct(5);
        $customer = Factory::user();

        $this->addToCart($customer, (int) $bundle['variant']['id'], 1);
        $this->assertStatus(201, $this->checkout($customer));

        $this->addToCart($customer, (int) $bundle['variant']['id'], 1);
        $this->assertStatus(201, $this->checkout($customer));

        $this->assertSame(2, (int) $this->db()->scalar('SELECT COUNT(*) FROM orders'));
    }

    public function test_payment_initiation_is_idempotent(): void
    {
        $bundle = Factory::sellerWithProduct(5, '120.00');
        $customer = Factory::user();
        $this->addToCart($customer, (int) $bundle['variant']['id'], 1);

        $checkout = $this->checkout($customer);
        $this->assertStatus(201, $checkout);
        $orderId = (int) $checkout->dataArray()['order']['id'];

        $headers = $this->bearer($customer, ['idempotency-key' => 'payment-key-000001']);

        $first = $this->postJson('/api/v1/orders/' . $orderId . '/payments', ['provider' => 'sandbox'], $headers);
        $this->assertStatus(201, $first);

        $second = $this->postJson('/api/v1/orders/' . $orderId . '/payments', ['provider' => 'sandbox'], $headers);
        $this->assertStatus(201, $second);

        $this->assertSame($first->body(), $second->body());
        $this->assertSame(1, (int) $this->db()->scalar('SELECT COUNT(*) FROM payments'));
    }
}
