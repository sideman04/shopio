<?php

declare(strict_types=1);

namespace Shopio\Tests\Feature;

use Shopio\Database\Database;
use Shopio\Tests\Support\Commerce;
use Shopio\Tests\Support\Factory;
use Shopio\Tests\Support\TestApplication;
use Shopio\Tests\TestCase;

/**
 * Seller commissions and payouts.
 *
 * Focus: commission is deducted exactly once at payout time, only delivered and
 * paid items are eligible, an item can never be paid out twice, and payouts are
 * scoped to their owning seller.
 */
final class CommissionPayoutTest extends TestCase
{
    use Commerce;

    private function db(): Database
    {
        return TestApplication::make(Database::class);
    }

    public function test_earnings_summary_reports_gross_minus_commission(): void
    {
        $seller = Factory::seller(['commission_rate' => '10.00']);
        $product = Factory::product((int) $seller['id']);
        $variant = Factory::variant((int) $product['id'], ['price' => '100.00']);
        Factory::stock((int) $variant['id'], 10, (int) $seller['user']['id']);

        $customer = Factory::user();
        $this->addToCart($customer, (int) $variant['id'], 2);
        $this->placePaidOrder($customer);

        $summary = $this->get('/api/v1/sellers/payouts/summary', [], $this->bearer($seller['user']));
        $this->assertStatus(200, $summary);
        $data = $summary->dataArray();

        // 2 x 100.00 gross, 10% commission -> 20.00, net 180.00.
        $this->assertSame('180.00', (string) $data['earnedNet']);
        $this->assertSame('20.00', (string) $data['commissionTotal']);
        $this->assertSame(2, (int) $data['unitsSold']);

        // Nothing is payable until the items are delivered.
        $this->assertSame('0.00', (string) $data['availableForPayout']);
    }

    public function test_a_payout_before_delivery_is_rejected(): void
    {
        $bundle = $this->sellerBundle(1);
        $customer = Factory::user();
        $this->addToCart($customer, (int) $bundle['variant']['id'], 1);
        $this->placePaidOrder($customer);

        $response = $this->postJson('/api/v1/sellers/payouts', [
            'payout_method' => 'bank_transfer',
            'destination_label' => 'CRDB ****1234',
        ], $this->bearer($bundle['seller']['user']));

        $this->assertStatus(409, $response);
        $this->assertSame(0, (int) $this->db()->scalar('SELECT COUNT(*) FROM seller_payouts'));
    }

    public function test_a_delivered_paid_item_becomes_payable_and_can_only_be_paid_once(): void
    {
        $bundle = $this->sellerBundle(2, '100.00', '10.00');
        $customer = Factory::user();
        $this->addToCart($customer, (int) $bundle['variant']['id'], 2);

        ['orderId' => $orderId] = $this->placePaidOrder($customer);

        $this->markDelivered($bundle['seller'], $orderId);

        $summary = $this->get('/api/v1/sellers/payouts/summary', [], $this->bearer($bundle['seller']['user']));
        $this->assertSame('180.00', (string) $summary->dataArray()['availableForPayout']);

        $first = $this->postJson('/api/v1/sellers/payouts', [
            'payout_method' => 'bank_transfer',
            'destination_label' => 'CRDB ****1234',
        ], $this->bearer($bundle['seller']['user']));

        $this->assertStatus(201, $first);
        $this->assertSame('180.00', (string) $first->dataArray()['amount']);
        $this->assertSame('requested', $first->dataArray()['status']);

        $this->assertSame(1, (int) $this->db()->scalar('SELECT COUNT(*) FROM payout_items'));

        // The same item cannot be paid out a second time.
        $second = $this->postJson('/api/v1/sellers/payouts', [
            'payout_method' => 'bank_transfer',
            'destination_label' => 'CRDB ****1234',
        ], $this->bearer($bundle['seller']['user']));

        $this->assertStatus(409, $second);
        $this->assertSame(1, (int) $this->db()->scalar('SELECT COUNT(*) FROM seller_payouts'));
    }

    public function test_an_admin_can_progress_a_payout_to_paid(): void
    {
        $admin = Factory::admin();
        $bundle = $this->sellerBundle(1, '100.00', '20.00');
        $customer = Factory::user();
        $this->addToCart($customer, (int) $bundle['variant']['id'], 1);
        ['orderId' => $orderId] = $this->placePaidOrder($customer);
        $this->markDelivered($bundle['seller'], $orderId);

        $payout = $this->postJson('/api/v1/sellers/payouts', [
            'payout_method' => 'mobile_money',
            'destination_label' => 'M-Pesa 0755',
        ], $this->bearer($bundle['seller']['user']));
        $this->assertStatus(201, $payout);
        $payoutId = (int) $payout->dataArray()['id'];
        $this->assertSame('80.00', (string) $payout->dataArray()['amount']);

        $processing = $this->patchJson('/api/v1/admin/payouts/' . $payoutId, ['status' => 'processing'], $this->bearer($admin));
        $this->assertStatus(200, $processing);
        $this->assertSame('processing', $processing->dataArray()['status']);

        $paid = $this->patchJson('/api/v1/admin/payouts/' . $payoutId, [
            'status' => 'paid',
            'provider_reference' => 'DISB-0001',
        ], $this->bearer($admin));
        $this->assertStatus(200, $paid);
        $this->assertSame('paid', $paid->dataArray()['status']);

        // A finalised payout cannot be moved again.
        $this->assertStatus(409, $this->patchJson('/api/v1/admin/payouts/' . $payoutId, ['status' => 'failed'], $this->bearer($admin)));

        $summary = $this->get('/api/v1/sellers/payouts/summary', [], $this->bearer($bundle['seller']['user']));
        $this->assertSame('80.00', (string) $summary->dataArray()['paidTotal']);
    }

    public function test_a_sellers_payout_summary_is_scoped_to_their_own_store(): void
    {
        $sellerA = $this->sellerBundle(1, '100.00', '10.00');
        $sellerB = $this->sellerBundle(1, '100.00', '10.00');

        $customer = Factory::user();
        $this->addToCart($customer, (int) $sellerA['variant']['id'], 1);
        $this->placePaidOrder($customer);

        $summaryB = $this->get('/api/v1/sellers/payouts/summary', [], $this->bearer($sellerB['seller']['user']));
        $this->assertStatus(200, $summaryB);
        $this->assertSame('0.00', (string) $summaryB->dataArray()['earnedNet']);
        $this->assertSame(0, (int) $summaryB->dataArray()['unitsSold']);
    }

    public function test_a_non_admin_cannot_decide_payouts(): void
    {
        $bundle = $this->sellerBundle(1);
        $customer = Factory::user();
        $this->addToCart($customer, (int) $bundle['variant']['id'], 1);
        ['orderId' => $orderId] = $this->placePaidOrder($customer);
        $this->markDelivered($bundle['seller'], $orderId);

        $payout = $this->postJson('/api/v1/sellers/payouts', [
            'payout_method' => 'bank_transfer',
            'destination_label' => 'NMB ****9999',
        ], $this->bearer($bundle['seller']['user']));
        $this->assertStatus(201, $payout);

        $this->assertStatus(403, $this->patchJson('/api/v1/admin/payouts/' . (int) $payout->dataArray()['id'], ['status' => 'paid'], $this->bearer($bundle['seller']['user'])));
    }

    /**
     * @return array{seller:array<string,mixed>,variant:array<string,mixed>}
     */
    private function sellerBundle(int $stock, string $price = '100.00', string $commission = '10.00'): array
    {
        $seller = Factory::seller(['commission_rate' => $commission]);
        $product = Factory::product((int) $seller['id']);
        $variant = Factory::variant((int) $product['id'], ['price' => $price]);
        Factory::stock((int) $variant['id'], $stock, (int) $seller['user']['id']);

        return ['seller' => $seller, 'variant' => $variant];
    }

    /**
     * Advances every item of an order through the seller fulfillment machine so
     * the order (and its items) reach `delivered`.
     *
     * @param array<string,mixed> $seller
     */
    private function markDelivered(array $seller, int $orderId): void
    {
        $items = $this->db()->select(
            'SELECT id FROM order_items WHERE order_id = :id AND seller_id = :seller_id',
            ['id' => $orderId, 'seller_id' => (int) $seller['id']],
        );

        foreach ($items as $item) {
            $itemId = (int) $item['id'];

            $shipped = $this->patchJson(
                '/api/v1/sellers/orders/' . $orderId . '/items/' . $itemId,
                ['status' => 'shipped'],
                $this->bearer($seller['user']),
            );
            $this->assertStatus(200, $shipped);

            $delivered = $this->patchJson(
                '/api/v1/sellers/orders/' . $orderId . '/items/' . $itemId,
                ['status' => 'delivered'],
                $this->bearer($seller['user']),
            );
            $this->assertStatus(200, $delivered);
        }
    }
}
