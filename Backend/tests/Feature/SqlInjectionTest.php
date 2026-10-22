<?php

declare(strict_types=1);

namespace Shopio\Tests\Feature;

use Shopio\Database\Database;
use Shopio\Tests\Support\Commerce;
use Shopio\Tests\Support\Factory;
use Shopio\Tests\Support\TestApplication;
use Shopio\Tests\TestCase;

/**
 * SQL injection resistance.
 *
 * Every query goes through PDO prepared statements, so an injection payload is
 * treated as data. These tests assert that hostile input never produces a 500,
 * never authenticates, never bypasses scoping, and never damages the schema.
 */
final class SqlInjectionTest extends TestCase
{
    use Commerce;

    private const PAYLOADS = [
        "' OR '1'='1",
        "'; DROP TABLE users; --",
        "1' OR 1=1 -- ",
        "admin@example.test' -- ",
        "' UNION SELECT id, email, password_hash, 1,1,1,1,1 FROM users -- ",
    ];

    private function db(): Database
    {
        return TestApplication::make(Database::class);
    }

    public function test_injection_payloads_in_login_never_authenticate_or_crash(): void
    {
        Factory::user(['email' => 'victim@example.test']);
        Factory::admin(['email' => 'admin@example.test']);

        foreach (self::PAYLOADS as $payload) {
            $response = $this->postJson('/api/v1/auth/login', [
                'email' => $payload,
                'password' => $payload,
            ]);

            $this->assertContains($response->status(), [401, 422], "Payload leaked status: {$payload}");
            $this->assertFalse($response->success());
            $this->assertArrayNotHasKey('token', $response->dataArray());
        }

        // Schema and data are intact.
        $this->assertGreaterThanOrEqual(2, (int) $this->db()->scalar('SELECT COUNT(*) FROM users'));
    }

    public function test_injection_payloads_in_search_are_treated_as_data(): void
    {
        $bundle = Factory::sellerWithProduct(5);
        Factory::product((int) $bundle['seller']['id'], ['status' => 'active', 'name' => 'Visible Widget']);

        foreach (self::PAYLOADS as $payload) {
            $response = $this->get('/api/v1/products', ['q' => $payload]);

            $this->assertStatus(200, $response);
            $this->assertTrue($response->success());
            // A UNION-based payload must not surface extra rows.
            $this->assertLessThanOrEqual(1, count($response->dataArray()));
        }

        $this->assertGreaterThanOrEqual(1, (int) $this->db()->scalar('SELECT COUNT(*) FROM users'));
        $this->assertGreaterThanOrEqual(1, (int) $this->db()->scalar('SELECT COUNT(*) FROM products'));
    }

    public function test_injection_payloads_in_slug_lookups_return_not_found(): void
    {
        foreach (self::PAYLOADS as $payload) {
            $this->assertStatus(404, $this->get('/api/v1/products/' . rawurlencode($payload)));
            $this->assertStatus(404, $this->get('/api/v1/categories/' . rawurlencode($payload)));
        }
    }

    public function test_injection_payloads_in_path_ids_do_not_bypass_ownership(): void
    {
        $bundle = Factory::sellerWithProduct(5);
        $owner = Factory::user();
        $attacker = Factory::user();

        $this->addToCart($owner, (int) $bundle['variant']['id'], 1);
        $checkout = $this->checkout($owner);
        $this->assertStatus(201, $checkout);
        $orderId = (int) $checkout->dataArray()['order']['id'];

        $encoded = rawurlencode((string) $orderId . "' OR '1'='1");
        $response = $this->get('/api/v1/orders/' . $encoded, [], $this->bearer($attacker));

        // Casting to int neutralises the payload; the attacker still cannot read
        // the order.
        $this->assertContains($response->status(), [404, 400]);
        $this->assertFalse($response->success());
    }

    public function test_injection_payloads_in_admin_filters_are_safe(): void
    {
        $admin = Factory::admin();

        foreach (self::PAYLOADS as $payload) {
            $this->assertStatus(200, $this->get('/api/v1/admin/users', ['q' => $payload], $this->bearer($admin)));
            $this->assertStatus(200, $this->get('/api/v1/admin/orders', ['q' => $payload], $this->bearer($admin)));
        }
    }
}
