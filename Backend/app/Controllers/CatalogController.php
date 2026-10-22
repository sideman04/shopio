<?php

declare(strict_types=1);

namespace Shopio\Controllers;

use Shopio\Exceptions\ValidationException;
use Shopio\Http\Request;
use Shopio\Http\Response;
use Shopio\Services\CatalogService;
use Shopio\Services\GeoService;

/**
 * Public catalogue: products, categories, banners, stores and geography.
 * These endpoints require no authentication and never expose internal data.
 */
final class CatalogController extends Controller
{
    public function __construct(
        private readonly CatalogService $catalog,
        private readonly GeoService $geo,
    ) {
    }

    public function products(Request $request): Response
    {
        $result = $this->catalog->products($request);

        return $this->paginated($result['items'], $result['total'], $result['page'], $result['per_page'], 'Products retrieved successfully', $request);
    }

    /**
     * @param array<string,string> $params
     */
    public function product(Request $request, array $params): Response
    {
        return $this->success($this->catalog->product((string) ($params['slug'] ?? '')), 'Product retrieved successfully', 200, [], $request);
    }

    /**
     * @param array<string,string> $params
     */
    public function productReviews(Request $request, array $params): Response
    {
        $rating = $request->query('rating');
        $ratingFilter = $rating === null || $rating === '' ? null : (int) $rating;

        $result = $this->catalog->reviews(
            (string) ($params['slug'] ?? ''),
            $this->page($request),
            $this->perPage($request, 10, 50),
            $ratingFilter,
        );

        return $this->paginated($result['items'], $result['total'], $result['page'], $result['per_page'], 'Reviews retrieved successfully', $request);
    }

    public function categories(Request $request): Response
    {
        return $this->success($this->catalog->categories(), 'Categories retrieved successfully', 200, [], $request);
    }

    /**
     * @param array<string,string> $params
     */
    public function category(Request $request, array $params): Response
    {
        return $this->success($this->catalog->category((string) ($params['slug'] ?? '')), 'Category retrieved successfully', 200, [], $request);
    }

    public function banners(Request $request): Response
    {
        $placement = $request->query('placement');
        $placement = is_string($placement) && $placement !== '' ? $placement : null;

        return $this->success($this->catalog->banners($placement), 'Banners retrieved successfully', 200, [], $request);
    }

    /**
     * Public storefront for a seller.
     *
     * @param array<string,string> $params
     */
    public function store(Request $request, array $params): Response
    {
        return $this->success($this->catalog->seller((string) ($params['slug'] ?? '')), 'Store retrieved successfully', 200, [], $request);
    }

    public function countries(Request $request): Response
    {
        return $this->success($this->geo->countries(), 'Countries retrieved successfully', 200, [], $request);
    }

    public function regions(Request $request): Response
    {
        $country = $request->query('country');
        $country = is_string($country) && $country !== '' ? strtoupper($country) : null;

        return $this->success($this->geo->regions($country), 'Regions retrieved successfully', 200, [], $request);
    }

    public function cities(Request $request): Response
    {
        $regionId = $request->query('region_id');
        if ($regionId !== null && $regionId !== '' && preg_match('/^\d+$/', (string) $regionId) !== 1) {
            throw new ValidationException(['region_id' => ['Must be an integer.']]);
        }

        $region = $regionId === null || $regionId === '' ? null : (int) $regionId;

        return $this->success($this->geo->cities($region), 'Cities retrieved successfully', 200, [], $request);
    }

    /**
     * @param array<string,string> $params
     */
    public function city(Request $request, array $params): Response
    {
        return $this->success($this->geo->city($this->intParam($params, 'id')), 'City retrieved successfully', 200, [], $request);
    }
}
