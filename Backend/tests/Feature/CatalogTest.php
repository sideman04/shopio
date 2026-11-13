<?php

declare(strict_types=1);

namespace Shopio\Tests\Feature;

use Shopio\Tests\Support\Factory;
use Shopio\Tests\TestCase;

/**
 * Public catalogue endpoints.
 */
final class CatalogTest extends TestCase
{
    public function test_public_product_detail_returns_the_full_product(): void
    {
        $bundle = Factory::sellerWithProduct(5);
        $slug = (string) $bundle['product']['slug'];

        $response = $this->get('/api/v1/products/' . rawurlencode($slug));

        $this->assertStatus(200, $response);
        $this->assertTrue($response->success());

        $product = $response->dataArray();
        $this->assertSame('active', $product['status']);
        $this->assertNotEmpty($product['variants']);
    }

    public function test_public_product_search_matches_the_seller_store_name(): void
    {
        $seller = Factory::seller([
            'store_name' => 'Amina Crafts',
            'store_slug' => 'amina-crafts',
        ]);
        $product = Factory::product((int) $seller['id'], [
            'name' => 'Handwoven basket',
            'slug' => 'handwoven-basket',
        ]);
        $variant = Factory::variant((int) $product['id']);
        Factory::stock((int) $variant['id'], 5, (int) $seller['user']['id']);

        $response = $this->get('/api/v1/products', ['q' => 'Amina Crafts']);

        $this->assertStatus(200, $response);
        $this->assertTrue($response->success());
        $this->assertCount(1, $response->dataArray());
        $this->assertSame('Amina Crafts', $response->dataArray()[0]['sellerName']);
        $this->assertSame('amina-crafts', $response->dataArray()[0]['sellerSlug']);
    }
}
