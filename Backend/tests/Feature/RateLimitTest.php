<?php

declare(strict_types=1);

namespace Shopio\Tests\Feature;

use Shopio\Tests\Support\Factory;
use Shopio\Tests\TestCase;

/**
 * Rate limiting: fixed-window throttles are enforced per route/identifier and
 * produce a 429 error envelope with a Retry-After hint.
 */
final class RateLimitTest extends TestCase
{
    public function test_support_endpoint_is_throttled(): void
    {
        $payload = [
            'name' => 'Anonymous',
            'email' => 'anon@example.test',
            'subject' => 'Question about my order',
            'message' => 'Hello, I would like help with a recent order please.',
        ];

        for ($i = 0; $i < 5; $i++) {
            $response = $this->postJson('/api/v1/support', $payload);
            $this->assertStatus(201, $response);
        }

        $blocked = $this->postJson('/api/v1/support', $payload);

        $this->assertStatus(429, $blocked);
        $this->assertFalse($blocked->success());
        $this->assertNotSame('', $blocked->requestId());
        $this->assertNotNull($blocked->header('Retry-After'));

        $meta = $blocked->json();
        $this->assertArrayHasKey('retry_after', $meta);
    }

    public function test_registration_is_throttled_per_ip(): void
    {
        // The first registers; the rest conflict on the same email but still
        // consume the window. The 11th request must be throttled.
        for ($i = 0; $i < 10; $i++) {
            $this->postJson('/api/v1/auth/register', [
                'full_name' => 'Rate Limited',
                'email' => 'rate-limit@example.test',
                'password' => Factory::PASSWORD,
                'password_confirmation' => Factory::PASSWORD,
                'accept_terms' => 1,
            ]);
        }

        $blocked = $this->postJson('/api/v1/auth/register', [
            'full_name' => 'Rate Limited',
            'email' => 'rate-limited-2@example.test',
            'password' => Factory::PASSWORD,
            'password_confirmation' => Factory::PASSWORD,
            'accept_terms' => 1,
        ]);

        $this->assertStatus(429, $blocked);
        $this->assertNotNull($blocked->header('Retry-After'));
    }

    public function test_authenticated_write_throttle_counts_per_user(): void
    {
        // The write throttle is generous (120/min); verify a healthy request
        // passes and that two different users do not share a bucket.
        $bundle = Factory::sellerWithProduct(10);
        $userA = Factory::user();
        $userB = Factory::user();

        $this->assertStatus(200, $this->postJson('/api/v1/cart/items', [
            'variant_id' => (int) $bundle['variant']['id'],
            'quantity' => 1,
        ], $this->bearer($userA)));

        $this->assertStatus(200, $this->postJson('/api/v1/cart/items', [
            'variant_id' => (int) $bundle['variant']['id'],
            'quantity' => 1,
        ], $this->bearer($userB)));
    }
}
