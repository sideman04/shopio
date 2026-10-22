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
}
