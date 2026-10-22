<?php

declare(strict_types=1);

namespace Shopio\Tests\Feature;

use Shopio\Database\Database;
use Shopio\Repositories\InventoryRepository;
use Shopio\Tests\Support\Commerce;
use Shopio\Tests\Support\Factory;
use Shopio\Tests\Support\TestApplication;
use Shopio\Tests\TestCase;

/**
 * Checkout: cart -> order conversion, stock reservation, availability rules,
 * coupon application and the concurrency guard that prevents overselling.
 */
final class CheckoutTest extends TestCase
{
    use Commerce;

    private function db(): Database
    {
        return TestApplication::make(Database::class);
    }

    public function test_checkout_creates_an_order_and_reserves_stock(): void
    {
        $bundle = Factory::sellerWithProduct(10, '250.00');
        $customer = Factory::user();
        $variantId = (int) $bundle['variant']['id'];

        $this->assertStatus(200, $this->addToCart($customer, $variantId, 3));

        $checkout = $this->checkout($customer, ['customer_note' => 'Please call on arrival']);
        $this->assertStatus(201, $checkout);

        $order = $checkout->dataArray()['order'];
        $this->assertSame('pending', $order['status']);
        $this->assertSame('unpaid', $order['paymentStatus']);
        $this->assertSame('750.00', (string) $order['grandTotal']);
        $this->assertCount(1, $order['items']);
        $this->assertSame(3, $order['items'][0]['quantity']);
        $this->assertSame('250.00', (string) $order['items'][0]['unitPrice']);

        // Holds are recorded; on-hand is untouched until payment settles.
        $inventory = TestApplication::make(InventoryRepository::class)->forVariant($variantId);
        $this->assertSame(10, (int) ($inventory['quantity_on_hand'] ?? 0));
        $this->assertSame(3, (int) ($inventory['quantity_reserved'] ?? 0));
        $this->assertSame(1, (int) $this->db()->scalar('SELECT COUNT(*) FROM stock_reservations WHERE status = \'held\''));

        // The cart is emptied once converted.
        $this->assertSame(0, (int) ($this->get('/api/v1/cart', [], $this->bearer($customer))->dataArray()['itemCount'] ?? -1));
    }

    public function test_checkout_rejects_an_empty_cart(): void
    {
        $customer = Factory::user();

        $this->assertStatus(422, $this->checkout($customer));
    }

    public function test_checkout_fails_when_stock_is_no_longer_available(): void
    {
        $bundle = Factory::sellerWithProduct(5);
        $customer = Factory::user();
        $variantId = (int) $bundle['variant']['id'];

        $this->assertStatus(200, $this->addToCart($customer, $variantId, 5));

        // Stock drops after the item was added to the cart.
        TestApplication::make(InventoryRepository::class)->adjust($variantId, -3, (int) $bundle['user']['id'], 'shrinkage');

        $response = $this->checkout($customer);
        $this->assertStatus(409, $response);
    }

    public function test_checkout_rejects_a_product_that_went_offline(): void
    {
        $bundle = Factory::sellerWithProduct(5);
        $admin = Factory::admin();
        $customer = Factory::user();

        $this->assertStatus(200, $this->addToCart($customer, (int) $bundle['variant']['id'], 1));

        // Admin archives the product between add-to-cart and checkout.
        $this->assertStatus(200, $this->patchJson(
            '/api/v1/admin/products/' . $bundle['product']['id'],
            ['status' => 'archived'],
            $this->bearer($admin),
        ));

        $this->assertStatus(422, $this->checkout($customer));
    }

    public function test_coupon_discount_is_applied_at_checkout(): void
    {
        $admin = Factory::admin();
        $coupon = $this->postJson('/api/v1/admin/promotions', [
            'code' => 'TENOFF',
            'discount_type' => 'percentage',
            'discount_value' => '10.00',
        ], $this->bearer($admin));
        $this->assertStatus(201, $coupon);

        $bundle = Factory::sellerWithProduct(10, '200.00');
        $customer = Factory::user();
        $this->addToCart($customer, (int) $bundle['variant']['id'], 2);

        $checkout = $this->checkout($customer, ['coupon_code' => 'TENOFF']);
        $this->assertStatus(201, $checkout);

        $order = $checkout->dataArray()['order'];
        // 400.00 subtotal with a 40.00 order-level discount adjustment.
        $this->assertSame('400.00', (string) $order['itemsSubtotal']);
        $this->assertSame('360.00', (string) $order['grandTotal']);

        $discounts = array_values(array_filter($order['adjustments'], static fn (array $a): bool => $a['adjustmentType'] === 'discount'));
        $this->assertCount(1, $discounts);
        $this->assertSame('40.00', (string) $discounts[0]['amount']);
    }

    public function test_invalid_coupon_is_rejected_without_creating_an_order(): void
    {
        $bundle = Factory::sellerWithProduct(5);
        $customer = Factory::user();
        $this->addToCart($customer, (int) $bundle['variant']['id'], 1);

        $response = $this->checkout($customer, ['coupon_code' => 'DOES-NOT-EXIST']);
        $this->assertStatus(422, $response);

        // The transaction rolled back: nothing was reserved.
        $this->assertSame(0, (int) $this->db()->scalar('SELECT COUNT(*) FROM stock_reservations'));
        $this->assertSame(0, (int) $this->db()->scalar('SELECT COUNT(*) FROM orders'));
    }

    public function test_concurrent_checkouts_cannot_oversell_the_last_unit(): void
    {
        $worker = dirname(__DIR__) . '/Support/checkout_worker.php';
        if (!function_exists('proc_open') || !is_file($worker)) {
            $this->markTestSkipped('proc_open is unavailable; cannot spawn concurrent workers.');
        }

        $bundle = Factory::sellerWithProduct(1);
        $variantId = (int) $bundle['variant']['id'];

        $customerA = Factory::user();
        $customerB = Factory::user();

        $this->assertStatus(200, $this->addToCart($customerA, $variantId, 1));
        $this->assertStatus(200, $this->addToCart($customerB, $variantId, 1));

        $tokenA = Factory::token((int) $customerA['id']);
        $tokenB = Factory::token((int) $customerB['id']);

        $body = [
            'customer_name' => $customerA['full_name'],
            'customer_email' => $customerA['email'],
            'customer_phone' => '+255700000000',
            'shipping_address_line' => '123 Test Street',
            'shipping_city' => 'Dar es Salaam',
            'shipping_region' => 'Dar es Salaam',
            'shipping_country_code' => 'TZ',
        ];
        $bodyB = $body;
        $bodyB['customer_email'] = $customerB['email'];

        $startAt = microtime(true) + 2.0;

        $processes = [
            $this->spawnCheckoutWorker($worker, $tokenA, $body, $startAt),
            $this->spawnCheckoutWorker($worker, $tokenB, $bodyB, $startAt),
        ];

        $statuses = [];
        $bodies = [];
        foreach ($processes as $process) {
            $output = stream_get_contents($process['stdout']);
            fclose($process['stdout']);
            fclose($process['stderr']);
            proc_close($process['process']);

            $decoded = json_decode((string) $output, true);
            $this->assertIsArray($decoded, 'Worker produced no JSON: ' . (string) $output);
            $statuses[] = (int) $decoded['status'];
            $bodies[] = (string) $decoded['body'];
        }

        sort($statuses);
        $this->assertSame([201, 409], $statuses, 'Exactly one checkout must succeed. Bodies: ' . implode(' | ', $bodies));

        // Only one unit was sold/reserved and only one order exists.
        $this->assertSame(1, (int) $this->db()->scalar('SELECT COUNT(*) FROM orders'));
        $inventory = TestApplication::make(InventoryRepository::class)->forVariant($variantId);
        $this->assertSame(1, (int) ($inventory['quantity_reserved'] ?? 0));
        $this->assertSame(1, (int) ($inventory['quantity_on_hand'] ?? 0));
    }

    /**
     * @param array<string,mixed> $body
     * @return array{process:resource,stdout:resource,stderr:resource}
     */
    private function spawnCheckoutWorker(string $worker, string $token, array $body, float $startAt): array
    {
        $payload = json_encode(['token' => $token, 'body' => $body, 'start' => $startAt], JSON_UNESCAPED_SLASHES);

        $descriptors = [1 => ['pipe', 'w'], 2 => ['pipe', 'w']];
        $process = proc_open(
            [PHP_BINARY, $worker, (string) $payload],
            $descriptors,
            $pipes,
            dirname(__DIR__, 2),
        );

        $this->assertIsResource($process, 'Failed to spawn checkout worker.');

        return ['process' => $process, 'stdout' => $pipes[1], 'stderr' => $pipes[2]];
    }
}
