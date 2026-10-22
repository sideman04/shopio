<?php

declare(strict_types=1);

namespace Shopio\Tests\Feature;

use Shopio\Tests\Support\Factory;
use Shopio\Tests\TestCase;

/**
 * Role-based access control: authentication is required, and role gates are
 * enforced independently of authentication.
 */
final class RbacTest extends TestCase
{
    public function test_admin_routes_reject_unauthenticated_callers(): void
    {
        $this->assertStatus(401, $this->get('/api/v1/admin/overview'));
        $this->assertStatus(401, $this->get('/api/v1/admin/users'));
    }

    public function test_customer_cannot_reach_admin_routes(): void
    {
        $customer = Factory::user();

        $this->assertStatus(403, $this->get('/api/v1/admin/overview', [], $this->bearer($customer)));
        $this->assertStatus(403, $this->get('/api/v1/admin/users', [], $this->bearer($customer)));
    }

    public function test_seller_cannot_reach_admin_routes(): void
    {
        $seller = Factory::seller();

        $this->assertStatus(403, $this->get('/api/v1/admin/overview', [], $this->bearer($seller['user'])));
    }

    public function test_customer_cannot_reach_seller_routes(): void
    {
        $customer = Factory::user();

        $this->assertStatus(403, $this->get('/api/v1/sellers/dashboard', [], $this->bearer($customer)));
        $this->assertStatus(403, $this->get('/api/v1/sellers/store', [], $this->bearer($customer)));
    }

    public function test_admin_cannot_reach_seller_only_routes(): void
    {
        $admin = Factory::admin();

        // The seller workspace is strictly seller-scoped, not "seller or admin".
        $this->assertStatus(403, $this->get('/api/v1/sellers/dashboard', [], $this->bearer($admin)));
    }

    public function test_admin_can_access_admin_surfaces(): void
    {
        $admin = Factory::admin();

        $overview = $this->get('/api/v1/admin/overview', [], $this->bearer($admin));
        $this->assertStatus(200, $overview);
        $this->assertTrue($overview->success());

        $this->assertStatus(200, $this->get('/api/v1/admin/users', [], $this->bearer($admin)));
        $this->assertStatus(200, $this->get('/api/v1/admin/orders', [], $this->bearer($admin)));
    }

    public function test_seller_can_access_seller_surfaces(): void
    {
        $seller = Factory::seller();

        $this->assertStatus(200, $this->get('/api/v1/sellers/dashboard', [], $this->bearer($seller['user'])));
        $this->assertStatus(200, $this->get('/api/v1/sellers/store', [], $this->bearer($seller['user'])));
        $this->assertStatus(200, $this->get('/api/v1/sellers/products', [], $this->bearer($seller['user'])));
    }

    public function test_customer_cannot_use_writes_on_admin_routes(): void
    {
        $customer = Factory::user();
        $target = Factory::user();

        $response = $this->patchJson(
            '/api/v1/admin/users/' . $target['id'] . '/status',
            ['status' => 'suspended'],
            $this->bearer($customer),
        );

        $this->assertStatus(403, $response);
    }
}
