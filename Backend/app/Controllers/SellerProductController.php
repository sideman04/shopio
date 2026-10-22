<?php

declare(strict_types=1);

namespace Shopio\Controllers;

use Shopio\Auth\AuthenticatedUser;
use Shopio\Http\Request;
use Shopio\Http\Response;
use Shopio\Policies\SellerPolicy;
use Shopio\Services\ProductService;
use Shopio\Validators\CatalogValidator;

/**
 * Seller catalogue management. Ownership of every product/variant is enforced in
 * {@see ProductService} through seller-scoped lookups.
 */
final class SellerProductController extends Controller
{
    public function __construct(private readonly ProductService $products)
    {
    }

    public function index(Request $request): Response
    {
        $result = $this->products->listForSeller(
            $this->seller($request),
            $this->filters($request, ['status', 'q', 'category_id']),
            $this->page($request),
            $this->perPage($request),
        );

        return $this->paginated($result['items'], $result['total'], $this->page($request), $this->perPage($request), 'Products retrieved successfully', $request);
    }

    public function store(Request $request): Response
    {
        $data = CatalogValidator::productCreate($request->body());
        $product = $this->products->create($this->seller($request), $data, $request);

        return $this->created($product, 'Product created successfully', [], $request);
    }

    /**
     * @param array<string,string> $params
     */
    public function show(Request $request, array $params): Response
    {
        return $this->success($this->products->getForSeller($this->seller($request), $this->intParam($params, 'id')), 'Product retrieved successfully', 200, [], $request);
    }

    /**
     * @param array<string,string> $params
     */
    public function update(Request $request, array $params): Response
    {
        $data = CatalogValidator::productUpdate($request->body());
        $product = $this->products->update($this->seller($request), $this->intParam($params, 'id'), $data, $request);

        return $this->success($product, 'Product updated successfully', 200, [], $request);
    }

    /**
     * @param array<string,string> $params
     */
    public function destroy(Request $request, array $params): Response
    {
        $this->products->delete($this->seller($request), $this->intParam($params, 'id'), $request);

        return $this->success(null, 'Product deleted successfully', 200, [], $request);
    }

    /**
     * @param array<string,string> $params
     */
    public function submit(Request $request, array $params): Response
    {
        CatalogValidator::submitForReview($request->body());
        $product = $this->products->submitForReview($this->seller($request), $this->intParam($params, 'id'), $request);

        return $this->success($product, 'Product submitted for review', 200, [], $request);
    }

    /**
     * @param array<string,string> $params
     */
    public function attachImage(Request $request, array $params): Response
    {
        $data = CatalogValidator::imageAttach($request->body());
        $product = $this->products->attachImage($this->seller($request), $this->intParam($params, 'id'), $data, $request);

        return $this->created($product, 'Image attached successfully', [], $request);
    }

    /**
     * @param array<string,string> $params
     */
    public function deleteImage(Request $request, array $params): Response
    {
        $product = $this->products->deleteImage(
            $this->seller($request),
            $this->intParam($params, 'id'),
            $this->intParam($params, 'imageId'),
            $request,
        );

        return $this->success($product, 'Image deleted successfully', 200, [], $request);
    }

    /**
     * @param array<string,string> $params
     */
    public function createVariant(Request $request, array $params): Response
    {
        $data = CatalogValidator::variantCreate($request->body());
        $product = $this->products->createVariant($this->seller($request), $this->intParam($params, 'id'), $data, $request);

        return $this->created($product, 'Variant added successfully', [], $request);
    }

    /**
     * @param array<string,string> $params
     */
    public function updateVariant(Request $request, array $params): Response
    {
        $data = CatalogValidator::variantUpdate($request->body());
        $product = $this->products->updateVariant($this->seller($request), $this->intParam($params, 'variantId'), $data, $request);

        return $this->success($product, 'Variant updated successfully', 200, [], $request);
    }

    /**
     * @param array<string,string> $params
     */
    public function deleteVariant(Request $request, array $params): Response
    {
        $product = $this->products->deleteVariant($this->seller($request), $this->intParam($params, 'variantId'), $request);

        return $this->success($product, 'Variant deleted successfully', 200, [], $request);
    }

    /**
     * @param array<string,string> $params
     */
    public function setOptions(Request $request, array $params): Response
    {
        $data = CatalogValidator::optionTypes($request->body());
        $product = $this->products->setOptionTypes($this->seller($request), $this->intParam($params, 'id'), $data, $request);

        return $this->success($product, 'Product options updated successfully', 200, [], $request);
    }

    public function inventory(Request $request): Response
    {
        $result = $this->products->inventory(
            $this->seller($request),
            $this->filters($request, ['q', 'low_stock', 'status']),
            $this->page($request),
            $this->perPage($request),
        );

        return $this->success(
            $result['items'],
            'Inventory retrieved successfully',
            200,
            [
                'pagination' => [
                    'total' => $result['total'],
                    'page' => $this->page($request),
                    'per_page' => $this->perPage($request),
                    'total_pages' => $this->perPage($request) > 0 ? (int) ceil($result['total'] / $this->perPage($request)) : 0,
                    'has_more' => $this->page($request) * $this->perPage($request) < $result['total'],
                ],
                'summary' => $result['summary'] ?? [],
            ],
            $request,
        );
    }

    public function adjustInventory(Request $request): Response
    {
        $data = CatalogValidator::inventoryAdjust($request->body());
        $this->products->adjustInventory($this->seller($request), $data, $request);

        return $this->success(null, 'Inventory updated successfully', 200, [], $request);
    }

    public function setThreshold(Request $request): Response
    {
        $data = CatalogValidator::inventoryThreshold($request->body());
        $this->products->setThreshold($this->seller($request), $data, $request);

        return $this->success(null, 'Low-stock threshold updated successfully', 200, [], $request);
    }

    /**
     * Policy gate: every endpoint here is seller-only.
     */
    private function seller(Request $request): AuthenticatedUser
    {
        $auth = $this->auth($request);
        (new SellerPolicy($auth))->assertSeller();

        return $auth;
    }

    /**
     * @param list<string> $allowed
     * @return array<string,mixed>
     */
    private function filters(Request $request, array $allowed): array
    {
        $filters = [];
        foreach ($allowed as $key) {
            $value = $request->query($key);
            if ($value !== null && $value !== '') {
                $filters[$key] = $value;
            }
        }

        return $filters;
    }
}
