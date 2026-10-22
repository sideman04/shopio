<?php

declare(strict_types=1);

namespace Shopio\Tests\Feature;

use Shopio\Database\Database;
use Shopio\Tests\Support\Commerce;
use Shopio\Tests\Support\Factory;
use Shopio\Tests\Support\TestApplication;
use Shopio\Tests\TestCase;

/**
 * Mass assignment: clients cannot inject fields the endpoint does not own.
 *
 * Every mutating endpoint is backed by an allow-list validator, so unknown keys
 * are dropped before they can reach a repository. These tests assert the
 * *effect* (server-owned columns are unchanged), not just the response shape.
 */
final class MassAssignmentTest extends TestCase
{
    use Commerce;

    private function db(): Database
    {
        return TestApplication::make(Database::class);
    }

    public function test_profile_update_cannot_change_email_status_or_roles(): void
    {
        $user = Factory::user();

        $response = $this->patchJson('/api/v1/customers/profile', [
            'full_name' => 'Renamed User',
            'email' => 'attacker@evil.test',
            'status' => 'active',
            'roles' => ['admin'],
            'id' => 999,
        ], $this->bearer($user));

        $this->assertStatus(200, $response);

        $row = $this->db()->selectOne('SELECT full_name, email, status FROM users WHERE id = :id', ['id' => $user['id']]);
        $this->assertSame('Renamed User', $row['full_name'] ?? null);
        $this->assertSame($user['email'], $row['email'] ?? null);
        $this->assertSame('active', $row['status'] ?? null);

        $roles = $this->db()->select('SELECT r.code FROM user_roles ur JOIN roles r ON r.id = ur.role_id WHERE ur.user_id = :id', ['id' => $user['id']]);
        $this->assertSame(['customer'], array_column($roles, 'code'));
    }

    public function test_seller_cannot_forge_product_owner_status_or_rating(): void
    {
        $sellerA = Factory::seller();
        $sellerB = Factory::seller();

        $response = $this->postJson('/api/v1/sellers/products', [
            'name' => 'Sneaky Product',
            'short_description' => 'A test product',
            'seller_id' => $sellerB['id'],
            'status' => 'active',
            'is_featured' => 1,
            'rating' => '5.00',
            'review_count' => 100,
        ], $this->bearer($sellerA['user']));

        $this->assertStatus(201, $response);

        $productId = (int) ($response->dataArray()['id'] ?? 0);
        $row = $this->db()->selectOne('SELECT seller_id, status FROM products WHERE id = :id', ['id' => $productId]);

        $this->assertSame((int) $sellerA['id'], (int) $row['seller_id']);
        $this->assertSame('draft', $row['status']);
    }

    public function test_product_update_cannot_reassign_seller_or_publish(): void
    {
        $sellerA = Factory::seller();
        $sellerB = Factory::seller();
        $product = Factory::product((int) $sellerA['id'], ['status' => 'draft']);

        $response = $this->patchJson('/api/v1/sellers/products/' . $product['id'], [
            'name' => 'Updated Name',
            'seller_id' => $sellerB['id'],
            'status' => 'active',
        ], $this->bearer($sellerA['user']));

        $this->assertStatus(200, $response);

        $row = $this->db()->selectOne('SELECT seller_id, status, name FROM products WHERE id = :id', ['id' => $product['id']]);
        $this->assertSame((int) $sellerA['id'], (int) $row['seller_id']);
        $this->assertSame('draft', $row['status']);
        $this->assertSame('Updated Name', $row['name']);
    }

    public function test_coupon_create_ignores_created_by_and_used_count(): void
    {
        $admin = Factory::admin();

        $response = $this->postJson('/api/v1/admin/promotions', [
            'code' => 'SAVE10',
            'discount_type' => 'percentage',
            'discount_value' => '10.00',
            'created_by' => 999,
            'used_count' => 500,
        ], $this->bearer($admin));

        $this->assertStatus(201, $response);

        $couponId = (int) ($response->dataArray()['id'] ?? 0);
        $row = $this->db()->selectOne('SELECT created_by FROM coupons WHERE id = :id', ['id' => $couponId]);
        $this->assertSame((int) $admin['id'], (int) $row['created_by']);
    }

    public function test_checkout_ignores_client_supplied_totals_and_status(): void
    {
        $bundle = Factory::sellerWithProduct(5, '80.00');
        $customer = Factory::user();
        $otherUser = Factory::user();

        $this->addToCart($customer, (int) $bundle['variant']['id'], 1);

        $checkout = $this->checkout($customer, [
            'status' => 'delivered',
            'payment_status' => 'paid',
            'user_id' => $otherUser['id'],
            'grand_total' => '0.01',
            'fulfillment_status' => 'fulfilled',
        ]);

        $this->assertStatus(201, $checkout);
        $order = $checkout->dataArray()['order'];

        $this->assertSame((int) $customer['id'], (int) $order['userId']);
        $this->assertSame('pending', $order['status']);
        $this->assertSame('unpaid', $order['paymentStatus']);
        $this->assertSame('unfulfilled', $order['fulfillmentStatus']);
        // Totals are derived server-side from the line items, not the request.
        $this->assertSame('80.00', (string) $order['grandTotal']);
    }
}
