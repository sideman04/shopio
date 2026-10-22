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
 * Order and item status machines.
 *
 * The same transition table backs customer cancellation, seller fulfillment and
 * administrator overrides, so these tests assert that illegal jumps are refused
 * on every pathway and that cancellation returns reserved stock.
 */
final class StatusTransitionTest extends TestCase
{
    use Commerce;

    private function db(): Database
    {
        return TestApplication::make(Database::class);
    }

    public function test_customer_cancellation_releases_reserved_stock(): void
    {
        $bundle = Factory::sellerWithProduct(5, '100.00');
        $customer = Factory::user();
        $variantId = (int) $bundle['variant']['id'];

        $this->addToCart($customer, $variantId, 2);
        $checkout = $this->checkout($customer);
        $this->assertStatus(201, $checkout);
        $orderId = (int) $checkout->dataArray()['order']['id'];

        $cancel = $this->postJson('/api/v1/orders/' . $orderId . '/cancel', ['reason' => 'Changed my mind'], $this->bearer($customer));
        $this->assertStatus(200, $cancel);
        $this->assertSame('cancelled', $cancel->dataArray()['status']);

        $inventory = TestApplication::make(InventoryRepository::class)->forVariant($variantId);
        $this->assertSame(5, (int) $inventory['quantity_on_hand']);
        $this->assertSame(0, (int) $inventory['quantity_reserved']);

        $reservation = $this->db()->selectOne('SELECT status FROM stock_reservations WHERE order_id = :id', ['id' => $orderId]);
        $this->assertSame('released', $reservation['status']);
    }

    public function test_customer_cannot_cancel_another_users_order(): void
    {
        $bundle = Factory::sellerWithProduct(5);
        $owner = Factory::user();
        $attacker = Factory::user();
        $this->addToCart($owner, (int) $bundle['variant']['id'], 1);
        $checkout = $this->checkout($owner);
        $orderId = (int) $checkout->dataArray()['order']['id'];

        $this->assertStatus(404, $this->postJson('/api/v1/orders/' . $orderId . '/cancel', ['reason' => 'Not mine'], $this->bearer($attacker)));

        $order = $this->db()->selectOne('SELECT status FROM orders WHERE id = :id', ['id' => $orderId]);
        $this->assertSame('pending', $order['status']);
    }

    public function test_customer_cannot_cancel_once_the_order_has_shipped(): void
    {
        $admin = Factory::admin();
        $customer = Factory::user();
        $bundle = Factory::sellerWithProduct(3, '100.00');
        $this->addToCart($customer, (int) $bundle['variant']['id'], 1);
        ['orderId' => $orderId] = $this->placePaidOrder($customer);

        $this->assertStatus(200, $this->patchJson('/api/v1/admin/orders/' . $orderId . '/status', ['status' => 'shipped'], $this->bearer($admin)));

        $this->assertStatus(409, $this->postJson('/api/v1/orders/' . $orderId . '/cancel', ['reason' => 'Too late now'], $this->bearer($customer)));
    }

    public function test_admin_cannot_skip_order_states(): void
    {
        $admin = Factory::admin();
        $customer = Factory::user();
        $bundle = Factory::sellerWithProduct(3);
        $this->addToCart($customer, (int) $bundle['variant']['id'], 1);
        $checkout = $this->checkout($customer);
        $orderId = (int) $checkout->dataArray()['order']['id'];

        // pending -> delivered is not an allowed edge.
        $this->assertStatus(409, $this->patchJson('/api/v1/admin/orders/' . $orderId . '/status', ['status' => 'delivered'], $this->bearer($admin)));

        $order = $this->db()->selectOne('SELECT status FROM orders WHERE id = :id', ['id' => $orderId]);
        $this->assertSame('pending', $order['status']);
    }

    public function test_admin_can_walk_an_order_through_the_legal_chain(): void
    {
        $admin = Factory::admin();
        $customer = Factory::user();
        $bundle = Factory::sellerWithProduct(3, '100.00');
        $this->addToCart($customer, (int) $bundle['variant']['id'], 1);
        ['orderId' => $orderId] = $this->placePaidOrder($customer);

        // The paid webhook already moved pending -> confirmed.
        foreach (['processing', 'shipped', 'delivered'] as $target) {
            $response = $this->patchJson('/api/v1/admin/orders/' . $orderId . '/status', ['status' => $target], $this->bearer($admin));
            $this->assertStatus(200, $response);
            $this->assertSame($target, $response->dataArray()['status']);
        }
    }

    public function test_admin_cancellation_releases_holds(): void
    {
        $admin = Factory::admin();
        $customer = Factory::user();
        $bundle = Factory::sellerWithProduct(4, '100.00');
        $variantId = (int) $bundle['variant']['id'];
        $this->addToCart($customer, $variantId, 2);
        $checkout = $this->checkout($customer);
        $orderId = (int) $checkout->dataArray()['order']['id'];

        $this->assertStatus(200, $this->patchJson('/api/v1/admin/orders/' . $orderId . '/status', ['status' => 'cancelled'], $this->bearer($admin)));

        $inventory = TestApplication::make(InventoryRepository::class)->forVariant($variantId);
        $this->assertSame(0, (int) $inventory['quantity_reserved']);
    }

    public function test_a_non_admin_cannot_change_order_status(): void
    {
        $customer = Factory::user();
        $bundle = Factory::sellerWithProduct(3);
        $this->addToCart($customer, (int) $bundle['variant']['id'], 1);
        $checkout = $this->checkout($customer);
        $orderId = (int) $checkout->dataArray()['order']['id'];

        $this->assertStatus(403, $this->patchJson('/api/v1/admin/orders/' . $orderId . '/status', ['status' => 'confirmed'], $this->bearer($customer)));
    }

    public function test_seller_fulfillment_cannot_skip_states(): void
    {
        $bundle = Factory::sellerWithProduct(3, '100.00');
        $seller = $bundle['seller'];
        $customer = Factory::user();
        $this->addToCart($customer, (int) $bundle['variant']['id'], 1);
        ['orderId' => $orderId] = $this->placePaidOrder($customer);

        $itemId = (int) $this->db()->scalar('SELECT id FROM order_items WHERE order_id = :id', ['id' => $orderId]);

        // unfulfilled -> delivered is not permitted; shipped is.
        $this->assertStatus(409, $this->patchJson(
            '/api/v1/sellers/orders/' . $orderId . '/items/' . $itemId,
            ['status' => 'delivered'],
            $this->bearer($seller['user']),
        ));

        $this->assertStatus(200, $this->patchJson(
            '/api/v1/sellers/orders/' . $orderId . '/items/' . $itemId,
            ['status' => 'shipped'],
            $this->bearer($seller['user']),
        ));

        $this->assertStatus(200, $this->patchJson(
            '/api/v1/sellers/orders/' . $orderId . '/items/' . $itemId,
            ['status' => 'delivered'],
            $this->bearer($seller['user']),
        ));

        $item = $this->db()->selectOne('SELECT fulfillment_status FROM order_items WHERE id = :id', ['id' => $itemId]);
        $this->assertSame('delivered', $item['fulfillment_status']);
    }

    public function test_a_seller_cannot_fulfill_another_sellers_item(): void
    {
        $ownerBundle = Factory::sellerWithProduct(3, '100.00');
        $otherBundle = Factory::sellerWithProduct(3, '100.00');
        $customer = Factory::user();
        $this->addToCart($customer, (int) $ownerBundle['variant']['id'], 1);
        ['orderId' => $orderId] = $this->placePaidOrder($customer);

        $itemId = (int) $this->db()->scalar('SELECT id FROM order_items WHERE order_id = :id', ['id' => $orderId]);

        $response = $this->patchJson(
            '/api/v1/sellers/orders/' . $orderId . '/items/' . $itemId,
            ['status' => 'shipped'],
            $this->bearer($otherBundle['seller']['user']),
        );

        $this->assertStatus(404, $response);
        $item = $this->db()->selectOne('SELECT fulfillment_status FROM order_items WHERE id = :id', ['id' => $itemId]);
        $this->assertSame('unfulfilled', $item['fulfillment_status']);
    }
}
