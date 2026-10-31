<?php

declare(strict_types=1);

namespace Shopio\Tests\Feature;

use Shopio\Database\Database;
use Shopio\Tests\Support\Commerce;
use Shopio\Tests\Support\Factory;
use Shopio\Tests\Support\TestApplication;
use Shopio\Tests\TestCase;

/**
 * Administrator workflows that previously only updated client-side state:
 * settings, order notes/item fulfilment, refunds and official review replies.
 */
final class AdminOperationsTest extends TestCase
{
    use Commerce;

    private function db(): Database
    {
        return TestApplication::make(Database::class);
    }

    public function test_admin_settings_round_trip_preserves_json_types_and_other_keys(): void
    {
        $admin = Factory::admin();

        $this->assertStatus(200, $this->get('/api/v1/admin/settings', [], $this->bearer($admin)));

        $response = $this->patchJson('/api/v1/admin/settings', [
            'settings' => [
                'site_name' => 'Shopio Test',
                'commission_rate' => 12.5,
                'tax_inclusive' => true,
                'featured_categories' => ['electronics', 'fashion'],
            ],
        ], $this->bearer($admin));

        $this->assertStatus(200, $response);
        $saved = $response->dataArray();
        $this->assertSame('Shopio Test', $saved['site_name'] ?? null);
        $this->assertSame(12.5, $saved['commission_rate'] ?? null);
        $this->assertTrue($saved['tax_inclusive'] ?? false);
        $this->assertSame(['electronics', 'fashion'], $saved['featured_categories'] ?? null);

        $reloaded = $this->get('/api/v1/admin/settings', [], $this->bearer($admin));
        $this->assertStatus(200, $reloaded);
        $this->assertSame('Shopio Test', $reloaded->dataArray()['site_name'] ?? null);

        // A partial save must not erase unrelated settings.
        $this->assertStatus(200, $this->patchJson('/api/v1/admin/settings', [
            'settings' => ['site_name' => 'Renamed Shopio'],
        ], $this->bearer($admin)));

        $again = $this->get('/api/v1/admin/settings', [], $this->bearer($admin))->dataArray();
        $this->assertSame('Renamed Shopio', $again['site_name'] ?? null);
        $this->assertSame(12.5, $again['commission_rate'] ?? null);
        $this->assertSame(['electronics', 'fashion'], $again['featured_categories'] ?? null);
    }

    public function test_settings_require_admin_and_reject_invalid_keys(): void
    {
        $customer = Factory::user();

        $this->assertStatus(403, $this->patchJson('/api/v1/admin/settings', [
            'settings' => ['site_name' => 'Nope'],
        ], $this->bearer($customer)));

        $admin = Factory::admin();
        $response = $this->patchJson('/api/v1/admin/settings', [
            'settings' => ['Bad Key' => 'value'],
        ], $this->bearer($admin));

        $this->assertStatus(422, $response);
        $this->assertArrayHasKey('settings', $response->errors());
    }

    public function test_admin_can_add_an_internal_order_note(): void
    {
        $admin = Factory::admin();
        $customer = Factory::user();
        $bundle = Factory::sellerWithProduct(5, '100.00');
        $this->addToCart($customer, (int) $bundle['variant']['id'], 1);
        $checkout = $this->checkout($customer);
        $this->assertStatus(201, $checkout);
        $orderId = (int) $checkout->dataArray()['order']['id'];

        $note = 'Customer called to confirm the delivery address.';
        $response = $this->postJson('/api/v1/admin/orders/' . $orderId . '/notes', [
            'note' => $note,
        ], $this->bearer($admin));

        $this->assertStatus(200, $response);
        $history = $this->db()->selectOne(
            'SELECT note FROM order_status_history WHERE order_id = :id ORDER BY id DESC LIMIT 1',
            ['id' => $orderId],
        );
        $this->assertSame($note, $history['note'] ?? null);

        $this->assertStatus(403, $this->postJson('/api/v1/admin/orders/' . $orderId . '/notes', [
            'note' => 'Customer note from a non-admin',
        ], $this->bearer($customer)));

        $this->assertStatus(422, $this->postJson('/api/v1/admin/orders/' . $orderId . '/notes', [
            'note' => '',
        ], $this->bearer($admin)));
    }

    public function test_admin_can_advance_order_item_fulfilment(): void
    {
        $admin = Factory::admin();
        $customer = Factory::user();
        $bundle = Factory::sellerWithProduct(5, '100.00');
        $this->addToCart($customer, (int) $bundle['variant']['id'], 1);
        $checkout = $this->checkout($customer);
        $this->assertStatus(201, $checkout);
        $orderId = (int) $checkout->dataArray()['order']['id'];
        $itemId = (int) $this->db()->scalar(
            'SELECT id FROM order_items WHERE order_id = :id LIMIT 1',
            ['id' => $orderId],
        );

        $shipped = $this->patchJson('/api/v1/admin/orders/' . $orderId . '/items/' . $itemId, [
            'status' => 'shipped',
        ], $this->bearer($admin));
        $this->assertStatus(200, $shipped);

        $item = $this->db()->selectOne('SELECT fulfillment_status FROM order_items WHERE id = :id', ['id' => $itemId]);
        $this->assertSame('shipped', $item['fulfillment_status'] ?? null);
        $order = $this->db()->selectOne('SELECT status, fulfillment_status FROM orders WHERE id = :id', ['id' => $orderId]);
        $this->assertSame('shipped', $order['status'] ?? null);
        $this->assertSame('fulfilled', $order['fulfillment_status'] ?? null);

        $delivered = $this->patchJson('/api/v1/admin/orders/' . $orderId . '/items/' . $itemId, [
            'status' => 'delivered',
            'note' => 'Handed to the customer at the counter.',
        ], $this->bearer($admin));
        $this->assertStatus(200, $delivered);

        $item = $this->db()->selectOne('SELECT fulfillment_status FROM order_items WHERE id = :id', ['id' => $itemId]);
        $this->assertSame('delivered', $item['fulfillment_status'] ?? null);
        $order = $this->db()->selectOne('SELECT status, fulfillment_status FROM orders WHERE id = :id', ['id' => $orderId]);
        $this->assertSame('delivered', $order['status'] ?? null);
        $this->assertSame('fulfilled', $order['fulfillment_status'] ?? null);
    }

    public function test_admin_can_create_an_auditable_refund_request(): void
    {
        $admin = Factory::admin();
        $customer = Factory::user();
        $bundle = Factory::sellerWithProduct(5, '300.00');
        $this->addToCart($customer, (int) $bundle['variant']['id'], 1);
        ['orderId' => $orderId] = $this->placePaidOrder($customer);

        $response = $this->postJson('/api/v1/admin/orders/' . $orderId . '/refunds', [
            'amount' => '40.00',
            'reason' => 'Item arrived with a damaged box',
        ], $this->bearer($admin));

        $this->assertStatus(201, $response);
        $refund = $response->dataArray();
        $this->assertSame('requested', $refund['status'] ?? null);
        $this->assertSame('40.00', (string) ($refund['amount'] ?? ''));
        $this->assertSame($orderId, (int) ($refund['orderId'] ?? 0));

        $row = $this->db()->selectOne('SELECT * FROM refunds WHERE id = :id', ['id' => (int) $refund['id']]);
        $this->assertSame((int) $admin['id'], (int) $row['requested_by']);
        $this->assertGreaterThan(0, (int) $row['payment_id']);

        // Creating a request does not pretend the money has moved.
        $order = $this->db()->selectOne('SELECT payment_status FROM orders WHERE id = :id', ['id' => $orderId]);
        $this->assertSame('paid', $order['payment_status'] ?? null);

        $this->assertStatus(403, $this->postJson('/api/v1/admin/orders/' . $orderId . '/refunds', [
            'amount' => '10.00',
            'reason' => 'Not allowed for a non-admin',
        ], $this->bearer($customer)));

        $this->assertStatus(422, $this->postJson('/api/v1/admin/orders/' . $orderId . '/refunds', [
            'amount' => '9999.00',
            'reason' => 'Attempt to over-refund the order',
        ], $this->bearer($admin)));

        // Intermediate decisions are bookkeeping only; they must not move money.
        $approved = $this->patchJson('/api/v1/admin/refunds/' . (int) $refund['id'], [
            'status' => 'approved',
        ], $this->bearer($admin));
        $this->assertStatus(200, $approved);
        $this->assertSame('approved', $approved->dataArray()['status'] ?? null);
        $order = $this->db()->selectOne('SELECT payment_status FROM orders WHERE id = :id', ['id' => $orderId]);
        $this->assertSame('paid', $order['payment_status'] ?? null);

        $processing = $this->patchJson('/api/v1/admin/refunds/' . (int) $refund['id'], [
            'status' => 'processing',
        ], $this->bearer($admin));
        $this->assertStatus(200, $processing);
        $this->assertSame('processing', $processing->dataArray()['status'] ?? null);
        $order = $this->db()->selectOne('SELECT payment_status FROM orders WHERE id = :id', ['id' => $orderId]);
        $this->assertSame('paid', $order['payment_status'] ?? null);

        $completed = $this->patchJson('/api/v1/admin/refunds/' . (int) $refund['id'], [
            'status' => 'succeeded',
        ], $this->bearer($admin));
        $this->assertStatus(200, $completed);
        $this->assertSame('succeeded', $completed->dataArray()['status'] ?? null);
        $order = $this->db()->selectOne('SELECT payment_status FROM orders WHERE id = :id', ['id' => $orderId]);
        $this->assertSame('partially_refunded', $order['payment_status'] ?? null);
    }

    public function test_admin_reply_is_stored_separately_from_the_seller_reply(): void
    {
        $admin = Factory::admin();
        $customer = Factory::user();
        $bundle = Factory::sellerWithProduct();
        $reviewId = $this->createReview($bundle, $customer);

        $response = $this->postJson('/api/v1/admin/reviews/' . $reviewId . '/reply', [
            'reply' => 'Thanks for flagging this — our team is reviewing the listing.',
        ], $this->bearer($admin));

        $this->assertStatus(200, $response);
        $review = $response->dataArray();
        $this->assertSame(
            'Thanks for flagging this — our team is reviewing the listing.',
            $review['adminReply'] ?? null,
        );
        $this->assertSame('Thanks from the seller', $review['sellerReply'] ?? null);

        $row = $this->db()->selectOne('SELECT * FROM product_reviews WHERE id = :id', ['id' => $reviewId]);
        $this->assertSame('Thanks from the seller', $row['seller_reply'] ?? null);
        $this->assertNotNull($row['admin_reply'] ?? null);
        $this->assertNotNull($row['admin_replied_at'] ?? null);

        // The public review feed exposes the official reply.
        $public = $this->get('/api/v1/products/' . $bundle['product']['slug'] . '/reviews');
        $this->assertStatus(200, $public);
        $publicReview = null;
        foreach ($public->dataArray() as $item) {
            if ((int) ($item['id'] ?? 0) === $reviewId) {
                $publicReview = $item;
                break;
            }
        }
        $this->assertNotNull($publicReview);
        $this->assertSame(
            'Thanks for flagging this — our team is reviewing the listing.',
            $publicReview['adminReply'] ?? null,
        );

        $this->assertStatus(422, $this->postJson('/api/v1/admin/reviews/' . $reviewId . '/reply', [
            'reply' => '',
        ], $this->bearer($admin)));

        $this->assertStatus(403, $this->postJson('/api/v1/admin/reviews/' . $reviewId . '/reply', [
            'reply' => 'A customer cannot post an official reply',
        ], $this->bearer($customer)));
    }

    /**
     * @param array{seller:array<string,mixed>,user:array<string,mixed>,product:array<string,mixed>,variant:array<string,mixed>} $bundle
     * @param array<string,mixed> $customer
     */
    private function createReview(array $bundle, array $customer): int
    {
        $this->db()->execute(
            'INSERT INTO product_reviews
                (product_id, user_id, rating, title, review_text, status, seller_reply, seller_replied_at)
             VALUES
                (:product_id, :user_id, 5, :title, :review_text, \'published\', :seller_reply, UTC_TIMESTAMP())',
            [
                'product_id' => (int) $bundle['product']['id'],
                'user_id' => (int) $customer['id'],
                'title' => 'Great purchase',
                'review_text' => 'The product matched the description.',
                'seller_reply' => 'Thanks from the seller',
            ],
        );

        return $this->db()->lastInsertId();
    }
}
