<?php

declare(strict_types=1);

namespace Shopio\Tests\Feature;

use Shopio\Tests\TestCase;

/**
 * Ensures the kernel, database reset and HTTP pipeline are wired correctly.
 * If this file fails, every other feature test is unreliable.
 */
final class HealthTest extends TestCase
{
    public function test_health_endpoint_returns_ok_envelope(): void
    {
        $response = $this->get('/api/v1/health');

        $this->assertStatus(200, $response);
        $this->assertEnvelope($response);
        $this->assertTrue($response->success());
        $this->assertSame('ok', $response->dataArray()['status'] ?? null);
    }

    public function test_unknown_route_returns_404_envelope(): void
    {
        $response = $this->get('/api/v1/definitely-not-a-route');

        $this->assertStatus(404, $response);
        $this->assertFalse($response->success());
        $this->assertNotSame('', $response->requestId());
    }

    public function test_database_reset_restores_reference_data(): void
    {
        $response = $this->get('/api/v1/categories');

        $this->assertStatus(200, $response);
        $this->assertCount(5, $response->dataArray());
    }

    public function test_security_headers_are_present_on_every_response(): void
    {
        $response = $this->get('/api/v1/health');

        $this->assertSame('nosniff', $response->header('X-Content-Type-Options'));
        $this->assertNotNull($response->header('X-Frame-Options'));
    }
}
