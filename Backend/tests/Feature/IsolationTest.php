<?php

declare(strict_types=1);

namespace Shopio\Tests\Feature;

use Shopio\Tests\Support\Commerce;
use Shopio\Tests\Support\Factory;
use Shopio\Tests\TestCase;

/**
 * Horizontal privilege escalation (IDOR/BOLA): one user must never be able to
 * read or mutate another user's — or another seller's — resources, even by
 * guessing ids.
 */
final class IsolationTest extends TestCase
{
    use Commerce;

    public function test_customer_cannot_read_another_customers_order(): void
    {
        [$customerA, $customerB, $orderB] = $this->twoCustomerOrders();

        $response = $this->get('/api/v1/orders/' . $orderB, [], $this->bearer($customerA));

        // Foreign resources are hidden as 404 (never 403, which would confirm existence).
        $this->assertStatus(404, $response);
    }

    public function test_customer_cannot_cancel_another_customers_order(): void
    {
        [$customerA, $customerB, $orderB] = $this->twoCustomerOrders();

        $response = $this->postJson(
            '/api/v1/orders/' . $orderB . '/cancel',
            ['reason' => 'Not mine'],
            $this->bearer($customerA),
        );

        $this->assertStatus(404, $response);

        // Owner can still see the untouched order.
        $this->assertStatus(200, $this->get('/api/v1/orders/' . $orderB, [], $this->bearer($customerB)));
    }

    public function test_customer_cannot_read_or_request_refunds_for_another_order(): void
    {
        [$customerA, $customerB, $orderB, $branchB] = $this->twoCustomerOrders();

        $this->assertStatus(404, $this->get('/api/v1/orders/' . $orderB . '/refunds', [], $this->bearer($customerA)));

        $request = $this->postJson(
            '/api/v1/orders/' . $orderB . '/refunds',
            ['reason' => 'I want my money back'],
            $this->bearer($customerA),
        );
        $this->assertStatus(404, $request);

        // The legitimate owner is unaffected and still cannot refund an unpaid order.
        $owner = $this->postJson(
            '/api/v1/orders/' . $orderB . '/refunds',
            ['reason' => 'Legitimate request'],
            $this->bearer($customerB),
        );
        $this->assertStatus(409, $owner);
    }

    public function test_carts_are_isolated_per_user(): void
    {
        $bundleA = Factory::sellerWithProduct(5);
        $bundleB = Factory::sellerWithProduct(5);

        $customerA = Factory::user();
        $customerB = Factory::user();

        $this->assertStatus(200, $this->addToCart($customerA, (int) $bundleA['variant']['id'], 2));
        $this->assertStatus(200, $this->addToCart($customerB, (int) $bundleB['variant']['id'], 3));

        $cartA = $this->get('/api/v1/cart', [], $this->bearer($customerA))->dataArray();
        $cartB = $this->get('/api/v1/cart', [], $this->bearer($customerB))->dataArray();

        $this->assertSame(2, $cartA['itemCount'] ?? null);
        $this->assertSame(3, $cartB['itemCount'] ?? null);
    }

    public function test_address_mutations_are_scoped_to_the_owner(): void
    {
        $owner = Factory::user();
        $attacker = Factory::user();
        $addressId = Factory::address((int) $owner['id']);

        $this->assertStatus(404, $this->patchJson(
            '/api/v1/customers/addresses/' . $addressId,
            [
                'recipient_name' => 'Hijacked',
                'phone' => '+255711111111',
                'city_id' => Factory::cityId(),
                'street_address' => '999 Attacker Road',
            ],
            $this->bearer($attacker),
        ));

        $this->assertStatus(404, $this->delete('/api/v1/customers/addresses/' . $addressId, $this->bearer($attacker)));

        // The address is untouched for its owner.
        $addresses = $this->get('/api/v1/customers/addresses', [], $this->bearer($owner))->dataArray();
        $this->assertCount(1, $addresses);
        $this->assertSame('Test Recipient', $addresses[0]['recipientName'] ?? null);
    }

    public function test_seller_only_sees_their_own_items_in_a_shared_order(): void
    {
        $sellerA = Factory::seller();
        $sellerB = Factory::seller();
        $productA = Factory::product((int) $sellerA['id']);
        $productB = Factory::product((int) $sellerB['id']);
        $variantA = Factory::variant((int) $productA['id'], ['price' => '100.00']);
        $variantB = Factory::variant((int) $productB['id'], ['price' => '50.00']);
        Factory::stock((int) $variantA['id'], 5);
        Factory::stock((int) $variantB['id'], 5);

        $customer = Factory::user();
        $this->addToCart($customer, (int) $variantA['id'], 1);
        $this->addToCart($customer, (int) $variantB['id'], 1);

        $checkout = $this->checkout($customer);
        $this->assertStatus(201, $checkout);
        $orderId = (int) $checkout->dataArray()['order']['id'];

        $items = $checkout->dataArray()['order']['items'];
        $sellerAItem = null;
        $sellerBItem = null;
        foreach ($items as $item) {
            if ((int) $item['sellerId'] === (int) $sellerA['id']) {
                $sellerAItem = $item;
            }
            if ((int) $item['sellerId'] === (int) $sellerB['id']) {
                $sellerBItem = $item;
            }
        }
        $this->assertNotNull($sellerAItem);
        $this->assertNotNull($sellerBItem);

        // Seller A sees the order, but only their own line.
        $detail = $this->get('/api/v1/sellers/orders/' . $orderId, [], $this->bearer($sellerA['user']));
        $this->assertStatus(200, $detail);
        $seenItems = $detail->dataArray()['items'] ?? [];
        $this->assertCount(1, $seenItems);
        $this->assertSame((int) $sellerA['id'], (int) $seenItems[0]['sellerId']);

        // Seller A cannot mutate Seller B's item.
        $crossItem = $this->patchJson(
            '/api/v1/sellers/orders/' . $orderId . '/items/' . $sellerBItem['id'],
            ['status' => 'processing'],
            $this->bearer($sellerA['user']),
        );
        $this->assertStatus(404, $crossItem);
    }

    public function test_seller_cannot_read_an_order_they_have_no_items_in(): void
    {
        $bundle = Factory::sellerWithProduct(5);
        $unrelatedSeller = Factory::seller();
        $customer = Factory::user();

        $this->addToCart($customer, (int) $bundle['variant']['id'], 1);
        $checkout = $this->checkout($customer);
        $orderId = (int) $checkout->dataArray()['order']['id'];

        $response = $this->get('/api/v1/sellers/orders/' . $orderId, [], $this->bearer($unrelatedSeller['user']));

        $this->assertStatus(404, $response);
    }

    /**
     * @return array{0:array<string,mixed>,1:array<string,mixed>,2:int,3:array<string,mixed>}
     */
    private function twoCustomerOrders(): array
    {
        $bundleA = Factory::sellerWithProduct(5);
        $bundleB = Factory::sellerWithProduct(5);

        $customerA = Factory::user();
        $customerB = Factory::user();

        $this->addToCart($customerA, (int) $bundleA['variant']['id'], 1);
        $checkoutA = $this->checkout($customerA);
        $this->assertStatus(201, $checkoutA);

        $this->addToCart($customerB, (int) $bundleB['variant']['id'], 1);
        $checkoutB = $this->checkout($customerB);
        $this->assertStatus(201, $checkoutB);

        return [$customerA, $customerB, (int) $checkoutB->dataArray()['order']['id'], $bundleB];
    }
}
