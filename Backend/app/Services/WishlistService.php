<?php

declare(strict_types=1);

namespace Shopio\Services;

use Shopio\Auth\AuthenticatedUser;
use Shopio\Exceptions\NotFoundException;
use Shopio\Repositories\ProductRepository;
use Shopio\Repositories\WishlistRepository;

/**
 * Wishlist: a simple user/product association. Product ownership is not a
 * concern (a wishlist is per-user), but the product must exist publicly.
 */
final class WishlistService
{
    public function __construct(
        private readonly WishlistRepository $wishlists,
        private readonly ProductRepository $products,
    ) {
    }

    /**
     * @return array{items:list<array<string,mixed>>,total:int}
     */
    public function list(AuthenticatedUser $auth, int $page, int $perPage): array
    {
        $result = $this->wishlists->paginateForUser($auth->id, $page, $perPage);

        $items = array_map(static function (array $row): array {
            return [
                'productId' => (int) $row['product_id'],
                'addedAt' => $row['added_at'] ?? null,
                'name' => $row['name'] ?? null,
                'slug' => $row['slug'] ?? null,
                'categoryName' => $row['category_name'] ?? null,
                'minPrice' => $row['min_price'] !== null ? (string) $row['min_price'] : null,
                'maxPrice' => $row['max_price'] !== null ? (string) $row['max_price'] : null,
                'availableStock' => (int) ($row['available_stock'] ?? 0),
                'primaryImage' => $row['primary_image'] ?? null,
                'rating' => (float) ($row['rating'] ?? 0),
                'reviewCount' => (int) ($row['review_count'] ?? 0),
                'available' => ($row['product_status'] ?? '') === 'active' && ($row['deleted_at'] ?? null) === null,
            ];
        }, $result['rows']);

        return ['items' => $items, 'total' => $result['total']];
    }

    public function add(AuthenticatedUser $auth, int $productId): void
    {
        if ($this->products->findPublicById($productId) === null) {
            throw new NotFoundException('The requested product does not exist.');
        }

        $this->wishlists->add($auth->id, $productId);
    }

    public function remove(AuthenticatedUser $auth, int $productId): void
    {
        $this->wishlists->remove($auth->id, $productId);
    }
}
