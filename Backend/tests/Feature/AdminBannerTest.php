<?php

declare(strict_types=1);

namespace Shopio\Tests\Feature;

use Shopio\Tests\Support\Factory;
use Shopio\Tests\TestCase;

/**
 * Admin banner management.
 *
 * Storefront banners normally link to internal routes such as `/shop`, so the
 * validator must accept those paths as well as absolute http(s) URLs.
 */
final class AdminBannerTest extends TestCase
{
    public function test_admin_can_create_a_banner_with_an_internal_target(): void
    {
        $admin = Factory::admin();

        $response = $this->postJson('/api/v1/admin/banners', [
            'title' => 'Weekend sale',
            'subtitle' => 'Up to 40% off selected products',
            'image_url' => 'https://images.example.test/banner.jpg',
            'button_text' => 'Shop now',
            'target_url' => '/shop',
            'placement' => 'home_promo',
            'sort_order' => 2,
            'status' => 'draft',
        ], $this->bearer($admin));

        $this->assertStatus(201, $response);
        $this->assertSame('/shop', $response->dataArray()['targetUrl'] ?? null);
        $this->assertSame('Weekend sale', $response->dataArray()['title'] ?? null);
    }

    public function test_active_banner_is_returned_by_the_public_catalogue_endpoint(): void
    {
        $admin = Factory::admin();
        $title = 'Public banner ' . bin2hex(random_bytes(4));

        $created = $this->postJson('/api/v1/admin/banners', [
            'title' => $title,
            'subtitle' => 'Visible on the storefront',
            'target_url' => '/shop',
            'placement' => 'home_hero',
            'status' => 'active',
        ], $this->bearer($admin));
        $this->assertStatus(201, $created);

        $response = $this->get('/api/v1/banners', ['placement' => 'home_hero']);
        $this->assertStatus(200, $response);

        $titles = array_map(
            static fn (array $banner): string => (string) ($banner['title'] ?? ''),
            $response->dataArray(),
        );
        $this->assertContains($title, $titles);
    }

    public function test_admin_can_create_a_banner_with_iso_timestamps(): void
    {
        $admin = Factory::admin();

        $response = $this->postJson('/api/v1/admin/banners', [
            'title' => 'Scheduled banner',
            'target_url' => '/shop',
            'placement' => 'home_hero',
            'starts_at' => '2030-01-01T21:00:00.000Z',
            'ends_at' => '2030-01-02T20:59:59.000Z',
            'status' => 'draft',
        ], $this->bearer($admin));

        $this->assertStatus(201, $response);
        $banner = $response->dataArray();
        $this->assertSame('2030-01-01 21:00:00', $banner['startsAt'] ?? null);
        $this->assertSame('2030-01-02 20:59:59', $banner['endsAt'] ?? null);
    }

    public function test_admin_can_update_a_banner_with_iso_timestamps(): void
    {
        $admin = Factory::admin();

        $created = $this->postJson('/api/v1/admin/banners', [
            'title' => 'Rescheduled banner',
            'target_url' => '/shop',
            'placement' => 'home_promo',
            'status' => 'draft',
        ], $this->bearer($admin));
        $this->assertStatus(201, $created);

        $id = (int) ($created->dataArray()['id'] ?? 0);
        $response = $this->patchJson('/api/v1/admin/banners/' . $id, [
            'starts_at' => '2030-02-01T00:00:00.000Z',
            'ends_at' => '2030-02-28T23:59:59.000Z',
        ], $this->bearer($admin));

        $this->assertStatus(200, $response);
        $banner = $response->dataArray();
        $this->assertSame('2030-02-01 00:00:00', $banner['startsAt'] ?? null);
        $this->assertSame('2030-02-28 23:59:59', $banner['endsAt'] ?? null);
    }

    public function test_admin_can_use_an_absolute_target_url(): void
    {
        $admin = Factory::admin();

        $response = $this->postJson('/api/v1/admin/banners', [
            'title' => 'External campaign',
            'target_url' => 'https://example.test/campaign',
            'placement' => 'other',
            'status' => 'draft',
        ], $this->bearer($admin));

        $this->assertStatus(201, $response);
        $this->assertSame('https://example.test/campaign', $response->dataArray()['targetUrl'] ?? null);
    }

    public function test_admin_can_update_a_banner_to_an_internal_target(): void
    {
        $admin = Factory::admin();

        $created = $this->postJson('/api/v1/admin/banners', [
            'title' => 'Editable banner',
            'target_url' => 'https://example.test/old',
            'placement' => 'home_promo',
            'status' => 'draft',
        ], $this->bearer($admin));
        $this->assertStatus(201, $created);

        $id = (int) ($created->dataArray()['id'] ?? 0);
        $response = $this->patchJson('/api/v1/admin/banners/' . $id, [
            'target_url' => '/categories',
        ], $this->bearer($admin));

        $this->assertStatus(200, $response);
        $this->assertSame('/categories', $response->dataArray()['targetUrl'] ?? null);
    }

    public function test_banner_target_rejects_unsafe_schemes_and_protocol_relative_urls(): void
    {
        $admin = Factory::admin();

        foreach (['javascript:alert(1)', '//evil.example.test', '/\\evil.example.test'] as $target) {
            $response = $this->postJson('/api/v1/admin/banners', [
                'title' => 'Unsafe target',
                'target_url' => $target,
                'placement' => 'home_promo',
                'status' => 'draft',
            ], $this->bearer($admin));

            $this->assertStatus(422, $response);
        }
    }
}
