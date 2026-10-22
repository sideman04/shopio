<?php

declare(strict_types=1);

namespace Shopio\Services;

use Shopio\Exceptions\NotFoundException;
use Shopio\Http\Request;
use Shopio\Repositories\BannerRepository;
use Shopio\Repositories\CategoryRepository;
use Shopio\Repositories\ProductRepository;
use Shopio\Repositories\ReviewRepository;
use Shopio\Repositories\SellerRepository;
use Shopio\Support\Presenter;

/**
 * Public catalogue reads. Only products that pass the public eligibility rules
 * (active, non-deleted, active + approved seller) are ever returned — enforced in
 * {@see ProductRepository}.
 */
final class CatalogService
{
    private const MAX_PER_PAGE = 60;

    public function __construct(
        private readonly ProductRepository $products,
        private readonly CategoryRepository $categories,
        private readonly SellerRepository $sellers,
        private readonly BannerRepository $banners,
        private readonly ReviewRepository $reviews,
    ) {
    }

    /**
     * @return array{items:list<array<string,mixed>>,total:int,page:int,per_page:int}
     */
    public function products(Request $request): array
    {
        $page = max(1, (int) $request->query('page', 1));
        $perPage = min(self::MAX_PER_PAGE, max(1, (int) $request->query('per_page', 20)));

        $filters = [
            'q' => $request->query('q'),
            'brand' => $request->query('brand'),
            'sort' => $request->query('sort'),
            'min_price' => $request->query('min_price'),
            'max_price' => $request->query('max_price'),
            'rating_min' => $request->query('rating_min'),
            'in_stock' => $request->query('in_stock'),
        ];

        if ($request->query('condition') !== null) {
            $filters['condition'] = is_array($request->query('condition'))
                ? $request->query('condition')
                : explode(',', (string) $request->query('condition'));
        }

        $categorySlug = $request->query('category');
        if (is_string($categorySlug) && $categorySlug !== '') {
            $category = $this->categories->findActiveBySlug($categorySlug);
            if ($category !== null) {
                $filters['category_id'] = (int) $category['id'];
            }
        }

        $sellerSlug = $request->query('seller');
        if (is_string($sellerSlug) && $sellerSlug !== '') {
            $seller = $this->sellers->findBySlug($sellerSlug);
            if ($seller !== null) {
                $filters['seller_id'] = (int) $seller['id'];
            }
        }

        $result = $this->products->publicSearch($filters, $page, $perPage);

        return [
            'items' => array_map([Presenter::class, 'productSummary'], $result['rows']),
            'total' => $result['total'],
            'page' => $page,
            'per_page' => $perPage,
        ];
    }

    /**
     * @return array<string,mixed>
     */
    public function product(string $slug): array
    {
        $row = $this->products->findPublicBySlug($slug);
        if ($row === null) {
            throw new NotFoundException('The requested product does not exist.');
        }

        return $this->hydrateProduct($row);
    }

    /**
     * @return array{items:list<array<string,mixed>>,total:int,page:int,per_page:int}
     */
    public function reviews(string $slug, int $page, int $perPage, ?int $rating): array
    {
        $product = $this->products->findPublicBySlug($slug);
        if ($product === null) {
            throw new NotFoundException('The requested product does not exist.');
        }

        $result = $this->reviews->paginatePublishedForProduct((int) $product['id'], $page, min(50, $perPage), $rating);

        return [
            'items' => array_map(static fn (array $row): array => Presenter::review($row), $result['rows']),
            'total' => $result['total'],
            'page' => $page,
            'per_page' => $perPage,
        ];
    }

    /**
     * @return list<array<string,mixed>>
     */
    public function categories(): array
    {
        return array_map([Presenter::class, 'category'], $this->categories->publicList());
    }

    /**
     * @return array<string,mixed>
     */
    public function category(string $slug): array
    {
        $category = $this->categories->findActiveBySlug($slug);
        if ($category === null) {
            throw new NotFoundException('The requested category does not exist.');
        }

        return Presenter::category($category);
    }

    /**
     * @return list<array<string,mixed>>
     */
    public function banners(?string $placement): array
    {
        return array_map([Presenter::class, 'banner'], $this->banners->publicList($placement));
    }

    /**
     * @return array<string,mixed>
     */
    public function seller(string $slug): array
    {
        $seller = $this->sellers->findBySlug($slug);
        if ($seller === null || $seller['status'] !== 'active') {
            throw new NotFoundException('The requested store does not exist.');
        }

        return Presenter::seller($seller);
    }

    /**
     * @param array<string,mixed> $row
     * @return array<string,mixed>
     */
    private function hydrateProduct(array $row): array
    {
        $productId = (int) $row['id'];
        $variants = [];
        foreach ($this->products->variants($productId, true) as $variant) {
            $variants[] = $variant + ['options' => $this->products->variantOptions((int) $variant['id'])];
        }

        return Presenter::product(
            $row,
            $this->products->images($productId),
            $variants,
            $this->products->optionTypes($productId),
        );
    }
}
