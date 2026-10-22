<?php

declare(strict_types=1);

namespace Shopio\Tests\Feature;

use Shopio\Database\Database;
use Shopio\Tests\Support\Commerce;
use Shopio\Tests\Support\Factory;
use Shopio\Tests\Support\TestApplication;
use Shopio\Tests\TestCase;

/**
 * Customer refunds and administrator refund decisions.
 *
 * Focus: the refundable balance can never be exceeded (even across multiple
 * partial refunds), a customer can only touch their own orders, and only the
 * provider-backed decision path can move money.
 */
final class RefundTest extends TestCase
{
    use Commerce;

    private function db(): Database
    {
        return TestApplication::make(Database::class);
    }

    public function test_a_customer_can_request_a_partial_refund(): void
    {
        $customer = Factory::user();
        $bundle = Factory::sellerWithProduct(5, '300.00');
        $this->addToCart($customer, (int) $bundle['variant']['id'], 1);

        ['orderId' => $orderId] = $this->placePaidOrder($customer);

        $response = $this->postJson('/api/v1/orders/' . $orderId . '/refunds', [
            'amount' => '100.00',
            'reason' => 'Item arrived damaged',
        ], $this->bearer($customer));

        $this->assertStatus(201, $response);
        $refund = $response->dataArray();
        $this->assertSame('requested', $refund['status']);
        $this->assertSame('100.00', (string) $refund['amount']);
        $this->assertSame($orderId, (int) $refund['orderId']);

        // A request alone does not move the order's payment state.
        $order = $this->db()->selectOne('SELECT payment_status FROM orders WHERE id = :id', ['id' => $orderId]);
        $this->assertSame('paid', $order['payment_status']);
    }

    public function test_a_refund_request_beyond_the_captured_amount_is_rejected(): void
    {
        $customer = Factory::user();
        $bundle = Factory::sellerWithProduct(5, '300.00');
        $this->addToCart($customer, (int) $bundle['variant']['id'], 1);
        ['orderId' => $orderId] = $this->placePaidOrder($customer);

        $response = $this->postJson('/api/v1/orders/' . $orderId . '/refunds', [
            'amount' => '300.01',
            'reason' => 'Trying to over-refund',
        ], $this->bearer($customer));

        $this->assertStatus(422, $response);
        $this->assertSame(0, (int) $this->db()->scalar('SELECT COUNT(*) FROM refunds'));
    }

    public function test_a_refund_without_a_captured_payment_conflicts(): void
    {
        $customer = Factory::user();
        $bundle = Factory::sellerWithProduct(5, '100.00');
        $this->addToCart($customer, (int) $bundle['variant']['id'], 1);

        $checkout = $this->checkout($customer);
        $this->assertStatus(201, $checkout);
        $orderId = (int) $checkout->dataArray()['order']['id'];

        $response = $this->postJson('/api/v1/orders/' . $orderId . '/refunds', [
            'amount' => '10.00',
            'reason' => 'Never paid for this order',
        ], $this->bearer($customer));

        $this->assertStatus(409, $response);
    }

    public function test_a_customer_cannot_refund_another_users_order(): void
    {
        $owner = Factory::user();
        $attacker = Factory::user();
        $bundle = Factory::sellerWithProduct(5, '100.00');
        $this->addToCart($owner, (int) $bundle['variant']['id'], 1);
        ['orderId' => $orderId] = $this->placePaidOrder($owner);

        $response = $this->postJson('/api/v1/orders/' . $orderId . '/refunds', [
            'amount' => '50.00',
            'reason' => 'Not my order at all',
        ], $this->bearer($attacker));

        // Existence is concealed: the attacker receives a 404, not a 403.
        $this->assertStatus(404, $response);
        $this->assertSame(0, (int) $this->db()->scalar('SELECT COUNT(*) FROM refunds'));
    }

    public function test_an_approved_partial_refund_marks_the_order_partially_refunded(): void
    {
        $admin = Factory::admin();
        $customer = Factory::user();
        $bundle = Factory::sellerWithProduct(5, '300.00');
        $this->addToCart($customer, (int) $bundle['variant']['id'], 1);
        ['orderId' => $orderId] = $this->placePaidOrder($customer);

        $refundId = $this->requestRefund($customer, $orderId, '100.00');

        $decision = $this->patchJson('/api/v1/admin/refunds/' . $refundId, [
            'status' => 'succeeded',
        ], $this->bearer($admin));
        $this->assertStatus(200, $decision);
        $this->assertSame('succeeded', $decision->dataArray()['status']);

        $order = $this->db()->selectOne('SELECT payment_status FROM orders WHERE id = :id', ['id' => $orderId]);
        $this->assertSame('partially_refunded', $order['payment_status']);
    }

    public function test_the_remaining_balance_accounts_for_earlier_refunds(): void
    {
        $admin = Factory::admin();
        $customer = Factory::user();
        $bundle = Factory::sellerWithProduct(5, '300.00');
        $this->addToCart($customer, (int) $bundle['variant']['id'], 1);
        ['orderId' => $orderId] = $this->placePaidOrder($customer);

        $refundId = $this->requestRefund($customer, $orderId, '100.00');
        $this->assertStatus(200, $this->patchJson('/api/v1/admin/refunds/' . $refundId, ['status' => 'succeeded'], $this->bearer($admin)));

        // 200 remains; asking for 200.01 must fail.
        $tooMuch = $this->postJson('/api/v1/orders/' . $orderId . '/refunds', [
            'amount' => '200.01',
            'reason' => 'Attempt to exceed the remainder',
        ], $this->bearer($customer));
        $this->assertStatus(422, $tooMuch);

        // Exactly the remainder is allowed and settles the order.
        $exact = $this->postJson('/api/v1/orders/' . $orderId . '/refunds', [
            'amount' => '200.00',
            'reason' => 'Refund the remaining balance',
        ], $this->bearer($customer));
        $this->assertStatus(201, $exact);

        $this->assertStatus(200, $this->patchJson('/api/v1/admin/refunds/' . (int) $exact->dataArray()['id'], ['status' => 'succeeded'], $this->bearer($admin)));

        $order = $this->db()->selectOne('SELECT status, payment_status FROM orders WHERE id = :id', ['id' => $orderId]);
        $this->assertSame('refunded', $order['payment_status']);
        $this->assertSame('refunded', $order['status']);
    }

    public function test_a_requested_refund_can_be_defaulted_to_the_full_balance(): void
    {
        $admin = Factory::admin();
        $customer = Factory::user();
        $bundle = Factory::sellerWithProduct(5, '150.00');
        $this->addToCart($customer, (int) $bundle['variant']['id'], 1);
        ['orderId' => $orderId] = $this->placePaidOrder($customer);

        // No amount -> the whole captured amount.
        $response = $this->postJson('/api/v1/orders/' . $orderId . '/refunds', [
            'reason' => 'Order never arrived at all',
        ], $this->bearer($customer));
        $this->assertStatus(201, $response);
        $this->assertSame('150.00', (string) $response->dataArray()['amount']);

        $this->assertStatus(200, $this->patchJson('/api/v1/admin/refunds/' . (int) $response->dataArray()['id'], ['status' => 'succeeded'], $this->bearer($admin)));

        $order = $this->db()->selectOne('SELECT payment_status FROM orders WHERE id = :id', ['id' => $orderId]);
        $this->assertSame('refunded', $order['payment_status']);
    }

    public function test_an_admin_can_reject_a_refund(): void
    {
        $admin = Factory::admin();
        $customer = Factory::user();
        $bundle = Factory::sellerWithProduct(5, '100.00');
        $this->addToCart($customer, (int) $bundle['variant']['id'], 1);
        ['orderId' => $orderId] = $this->placePaidOrder($customer);

        $refundId = $this->requestRefund($customer, $orderId, '40.00');

        $decision = $this->patchJson('/api/v1/admin/refunds/' . $refundId, [
            'status' => 'rejected',
            'note' => 'Outside the return window',
        ], $this->bearer($admin));
        $this->assertStatus(200, $decision);
        $this->assertSame('rejected', $decision->dataArray()['status']);

        // A rejected refund does not consume the refundable balance.
        $order = $this->db()->selectOne('SELECT payment_status FROM orders WHERE id = :id', ['id' => $orderId]);
        $this->assertSame('paid', $order['payment_status']);

        $again = $this->postJson('/api/v1/orders/' . $orderId . '/refunds', [
            'amount' => '100.00',
            'reason' => 'Full refund after rejection',
        ], $this->bearer($customer));
        $this->assertStatus(201, $again);
    }

    public function test_a_finalised_refund_cannot_be_decided_again(): void
    {
        $admin = Factory::admin();
        $customer = Factory::user();
        $bundle = Factory::sellerWithProduct(5, '100.00');
        $this->addToCart($customer, (int) $bundle['variant']['id'], 1);
        ['orderId' => $orderId] = $this->placePaidOrder($customer);

        $refundId = $this->requestRefund($customer, $orderId, '50.00');

        $this->assertStatus(200, $this->patchJson('/api/v1/admin/refunds/' . $refundId, ['status' => 'succeeded'], $this->bearer($admin)));

        $second = $this->patchJson('/api/v1/admin/refunds/' . $refundId, ['status' => 'rejected'], $this->bearer($admin));
        $this->assertStatus(409, $second);
    }

    public function test_a_non_admin_cannot_decide_refunds(): void
    {
        $customer = Factory::user();
        $bundle = Factory::sellerWithProduct(5, '100.00');
        $this->addToCart($customer, (int) $bundle['variant']['id'], 1);
        ['orderId' => $orderId] = $this->placePaidOrder($customer);

        $refundId = $this->requestRefund($customer, $orderId, '25.00');

        $this->assertStatus(403, $this->patchJson('/api/v1/admin/refunds/' . $refundId, ['status' => 'succeeded'], $this->bearer($customer)));
    }

    private function requestRefund(array $customer, int $orderId, string $amount): int
    {
        $response = $this->postJson('/api/v1/orders/' . $orderId . '/refunds', [
            'amount' => $amount,
            'reason' => 'Refund requested in test',
        ], $this->bearer($customer));

        $this->assertStatus(201, $response);

        return (int) $response->dataArray()['id'];
    }
}
