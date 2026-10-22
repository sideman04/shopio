<?php

declare(strict_types=1);

namespace Shopio\Services;

use Shopio\Auth\AuthenticatedUser;
use Shopio\Database\Database;
use Shopio\Exceptions\ConflictException;
use Shopio\Exceptions\NotFoundException;
use Shopio\Exceptions\ValidationException;
use Shopio\Http\Request;
use Shopio\Repositories\CategoryRepository;
use Shopio\Repositories\InventoryRepository;
use Shopio\Repositories\ProductRepository;
use Shopio\Support\Presenter;
use Shopio\Support\Str;

/**
 * Seller-side product management.
 *
 * Every operation first establishes ownership through a seller-scoped lookup:
 * a product/variant id posted by a seller is never trusted on its own
 * (IDOR/BOLA defence).
 */
final class ProductService
{
    public function __construct(
        private readonly Database $db,
        private readonly ProductRepository $products,
        private readonly InventoryRepository $inventory,
        private readonly CategoryRepository $categories,
        private readonly AuditService $audit,
    ) {
    }

    /**
     * @param array<string,mixed> $filters
     * @return array{items:list<array<string,mixed>>,total:int}
     */
    public function listForSeller(AuthenticatedUser $auth, array $filters, int $page, int $perPage): array
    {
        $result = $this->products->paginateForSeller($this->sellerId($auth), $filters, $page, $perPage);

        $items = array_map(
            function (array $row) use ($auth): array {
                $product = $this->getForSeller($auth, (int) $row['id']);
                $product['variantCount'] = count($product['variants']);
                $product['availableStock'] = array_sum(array_map(
                    static fn (array $variant): int => (int) ($variant['availableStock'] ?? $variant['stock'] ?? 0),
                    $product['variants'],
                ));
                $product['primaryImage'] = $product['images'][0]['imageUrl'] ?? null;

                return $product;
            },
            $result['rows'],
        );

        return ['items' => $items, 'total' => $result['total']];
    }

    /**
     * @return array<string,mixed>
     */
    public function getForSeller(AuthenticatedUser $auth, int $productId): array
    {
        $row = $this->requireProduct($auth, $productId);
        $variants = [];
        foreach ($this->products->variants($productId) as $variant) {
            $variants[] = $variant + ['options' => $this->products->variantOptions((int) $variant['id'])];
        }

        return Presenter::product(
            $row,
            $this->products->images($productId),
            $variants,
            $this->products->optionTypes($productId),
        ) + ['rejectionReason' => $row['rejection_reason'] ?? null];
    }

    /**
     * @param array<string,mixed> $data
     * @return array<string,mixed>
     */
    public function create(AuthenticatedUser $auth, array $data, Request $request): array
    {
        $sellerId = $this->sellerId($auth);

        if (!empty($data['category_id']) && !$this->categories->exists((int) $data['category_id'])) {
            throw new ValidationException(['category_id' => ['The selected category does not exist.']]);
        }

        $productId = $this->db->transaction(function () use ($data, $sellerId): int {
            $slug = $this->uniqueSlug((string) ($data['slug'] ?? $data['name']));

            $productId = $this->products->create([
                'seller_id' => $sellerId,
                'category_id' => $data['category_id'] ?? null,
                'name' => $data['name'],
                'slug' => $slug,
                'short_description' => $data['short_description'] ?? null,
                'description' => $data['description'] ?? null,
                'brand' => $data['brand'] ?? null,
                'condition_type' => $data['condition_type'] ?? 'new',
                'status' => 'draft',
            ]);

            foreach ($data['variants'] ?? [] as $variant) {
                $this->addVariantInternal($productId, $variant);
            }

            foreach ($data['images'] ?? [] as $index => $image) {
                $this->products->addImage(
                    $productId,
                    (string) $image['image_url'],
                    $image['alt_text'] ?? null,
                    (int) ($image['sort_order'] ?? $index),
                    !empty($image['is_primary']) || $index === 0,
                );
            }

            return $productId;
        });

        $this->audit->record($auth, 'product.created', 'product', $productId, $request);

        return $this->getForSeller($auth, $productId);
    }

    /**
     * @param array<string,mixed> $data
     * @return array<string,mixed>
     */
    public function update(AuthenticatedUser $auth, int $productId, array $data, Request $request): array
    {
        $this->requireProduct($auth, $productId);

        if (array_key_exists('category_id', $data) && $data['category_id'] !== null
            && !$this->categories->exists((int) $data['category_id'])) {
            throw new ValidationException(['category_id' => ['The selected category does not exist.']]);
        }

        $this->products->update($productId, $data);
        $this->audit->record($auth, 'product.updated', 'product', $productId, $request);

        return $this->getForSeller($auth, $productId);
    }

    public function delete(AuthenticatedUser $auth, int $productId, Request $request): void
    {
        $this->requireProduct($auth, $productId);
        $this->products->softDelete($productId);
        $this->audit->record($auth, 'product.deleted', 'product', $productId, $request);
    }

    public function submitForReview(AuthenticatedUser $auth, int $productId, Request $request): array
    {
        $this->requireProduct($auth, $productId);

        if ($this->products->countVariants($productId) === 0) {
            throw new ConflictException('Add at least one variant before submitting for review.');
        }

        $this->products->setStatus($productId, 'pending_review');
        $this->audit->record($auth, 'product.submitted', 'product', $productId, $request);

        return $this->getForSeller($auth, $productId);
    }

    /**
     * @param array<string,mixed> $data
     * @return array<string,mixed>
     */
    public function attachImage(AuthenticatedUser $auth, int $productId, array $data, Request $request): array
    {
        $this->requireProduct($auth, $productId);

        if ($this->products->countImages($productId) >= 20) {
            throw new ConflictException('A product may have at most 20 images.');
        }

        $this->db->transaction(function () use ($productId, $data): void {
            $isPrimary = !empty($data['is_primary']) || $this->products->countImages($productId) === 0;
            if ($isPrimary) {
                $this->products->clearPrimaryImages($productId);
            }
            $this->products->addImage($productId, (string) $data['image_url'], $data['alt_text'] ?? null, (int) ($data['sort_order'] ?? 0), $isPrimary);
        });

        $this->audit->record($auth, 'product.image_added', 'product', $productId, $request);

        return $this->getForSeller($auth, $productId);
    }

    public function deleteImage(AuthenticatedUser $auth, int $productId, int $imageId, Request $request): array
    {
        $this->requireProduct($auth, $productId);

        $image = $this->products->findImage($imageId);
        if ($image === null || (int) $image['product_id'] !== $productId) {
            throw new NotFoundException('The requested image does not exist.');
        }

        $this->products->deleteImage($productId, $imageId);
        $this->audit->record($auth, 'product.image_deleted', 'product', $productId, $request);

        return $this->getForSeller($auth, $productId);
    }

    /**
     * @param array<string,mixed> $data
     * @return array<string,mixed>
     */
    public function createVariant(AuthenticatedUser $auth, int $productId, array $data, Request $request): array
    {
        $this->requireProduct($auth, $productId);

        $variantId = $this->db->transaction(fn (): int => $this->addVariantInternal($productId, $data));

        $this->audit->record($auth, 'product.variant_added', 'variant', $variantId, $request);

        return $this->getForSeller($auth, $productId);
    }

    /**
     * @param array<string,mixed> $data
     * @return array<string,mixed>
     */
    public function updateVariant(AuthenticatedUser $auth, int $variantId, array $data, Request $request): array
    {
        $productId = $this->requireVariantOwnership($auth, $variantId);

        $options = $data['options'] ?? null;
        unset($data['options']);

        $this->db->transaction(function () use ($variantId, $productId, $data, $options): void {
            if ($data !== []) {
                $this->products->updateVariant($variantId, $data);
            }

            if (is_array($options)) {
                $this->syncVariantOptions($productId, $variantId, $options);
            }

            if (!empty($data['is_default'])) {
                $this->clearDefaultVariants($productId, $variantId);
            }
        });

        $this->audit->record($auth, 'product.variant_updated', 'variant', $variantId, $request);

        return $this->getForSeller($auth, $productId);
    }

    public function deleteVariant(AuthenticatedUser $auth, int $variantId, Request $request): array
    {
        $productId = $this->requireVariantOwnership($auth, $variantId);

        if ($this->products->countVariants($productId) <= 1) {
            throw new ConflictException('A product must keep at least one variant.');
        }

        $this->products->deleteVariant($variantId);
        $this->audit->record($auth, 'product.variant_deleted', 'variant', $variantId, $request);

        return $this->getForSeller($auth, $productId);
    }

    /**
     * @param array<string,mixed> $data
     * @return array<string,mixed>
     */
    public function setOptionTypes(AuthenticatedUser $auth, int $productId, array $data, Request $request): array
    {
        $this->requireProduct($auth, $productId);

        $this->db->transaction(function () use ($productId, $data): void {
            $this->db->execute('DELETE FROM product_option_types WHERE product_id = :id', ['id' => $productId]);
            foreach ($data['option_types'] as $type) {
                $typeId = $this->products->createOptionType($productId, (string) $type['name']);
                foreach ($type['values'] as $value) {
                    $this->products->createOptionValue($typeId, (string) $value);
                }
            }
        });

        $this->audit->record($auth, 'product.options_updated', 'product', $productId, $request);

        return $this->getForSeller($auth, $productId);
    }

    /**
     * @param array<string,mixed> $filters
     * @return array{items:list<array<string,mixed>>,total:int}
     */
    public function inventory(AuthenticatedUser $auth, array $filters, int $page, int $perPage): array
    {
        $result = $this->inventory->paginateForSeller($this->sellerId($auth), $filters, $page, $perPage);

        $items = array_map(static function (array $row): array {
            return [
                'variantId' => (int) $row['variant_id'],
                'productId' => (int) $row['product_id'],
                'productName' => (string) $row['product_name'],
                'productStatus' => (string) $row['product_status'],
                'sku' => (string) $row['sku'],
                'variantName' => (string) $row['variant_name'],
                'price' => (string) $row['price'],
                'isActive' => (bool) $row['is_active'],
                'quantityOnHand' => (int) $row['quantity_on_hand'],
                'quantityReserved' => (int) $row['quantity_reserved'],
                'availableStock' => (int) $row['available_stock'],
                'lowStockThreshold' => (int) $row['low_stock_threshold'],
                'isLowStock' => (int) $row['available_stock'] <= (int) $row['low_stock_threshold'],
            ];
        }, $result['rows']);

        return ['items' => $items, 'total' => $result['total'], 'summary' => $this->inventory->summaryForSeller($this->sellerId($auth))];
    }

    public function adjustInventory(AuthenticatedUser $auth, array $data, Request $request): void
    {
        $variantId = (int) $data['variant_id'];
        $this->requireVariantOwnership($auth, $variantId);

        $quantity = (int) $data['quantity'];
        if ($data['movement_type'] === 'restock' && $quantity <= 0) {
            throw new ValidationException(['quantity' => ['A restock quantity must be positive.']]);
        }

        $this->db->transaction(function () use ($variantId, $data, $quantity, $auth): void {
            $this->inventory->recordMovement(
                $variantId,
                (string) $data['movement_type'],
                $quantity,
                $auth->id,
                'manual',
                null,
                $data['note'] ?? null,
            );

            if (isset($data['low_stock_threshold'])) {
                $this->inventory->setLowStockThreshold($variantId, (int) $data['low_stock_threshold']);
            }
        });

        $this->audit->record($auth, 'inventory.adjusted', 'variant', $variantId, $request, ['delta' => $quantity]);
    }

    public function setThreshold(AuthenticatedUser $auth, array $data, Request $request): void
    {
        $variantId = (int) $data['variant_id'];
        $this->requireVariantOwnership($auth, $variantId);
        $this->inventory->setLowStockThreshold($variantId, (int) $data['low_stock_threshold']);
        $this->audit->record($auth, 'inventory.threshold', 'variant', $variantId, $request);
    }

    private function sellerId(AuthenticatedUser $auth): int
    {
        if ($auth->sellerId === null) {
            throw new NotFoundException('No store is associated with this account.');
        }

        return $auth->sellerId;
    }

    /**
     * @return array<string,mixed>
     */
    private function requireProduct(AuthenticatedUser $auth, int $productId): array
    {
        $product = $this->products->findForSeller($productId, $this->sellerId($auth));
        if ($product === null) {
            throw new NotFoundException('The requested product does not exist.');
        }

        return $product;
    }

    private function requireVariantOwnership(AuthenticatedUser $auth, int $variantId): int
    {
        $sellerId = $this->sellerId($auth);
        if (!$this->inventory->variantBelongsToSeller($variantId, $sellerId)) {
            throw new NotFoundException('The requested variant does not exist.');
        }

        $variant = $this->products->findVariant($variantId);

        return (int) ($variant['product_id'] ?? 0);
    }

    /**
     * @param array<string,mixed> $variant
     */
    private function addVariantInternal(int $productId, array $variant): int
    {
        if ($this->products->skuExists((string) $variant['sku'])) {
            throw new ValidationException(['sku' => ['This SKU is already in use.']]);
        }

        $variantId = $this->products->createVariant([
            'product_id' => $productId,
            'sku' => $variant['sku'],
            'variant_name' => $variant['variant_name'] ?? 'Default',
            'price' => $variant['price'],
            'compare_at_price' => $variant['compare_at_price'] ?? null,
            'cost_price' => $variant['cost_price'] ?? null,
            'weight_grams' => $variant['weight_grams'] ?? null,
            'is_default' => !empty($variant['is_default']) || $this->products->countVariants($productId) === 0,
            'is_active' => array_key_exists('is_active', $variant) ? (bool) $variant['is_active'] : true,
        ]);

        if (!empty($variant['options']) && is_array($variant['options'])) {
            $this->syncVariantOptions($productId, $variantId, $variant['options']);
        }

        return $variantId;
    }

    /**
     * @param array<string,string> $options
     */
    private function syncVariantOptions(int $productId, int $variantId, array $options): void
    {
        $this->products->clearVariantOptions($variantId);

        foreach ($options as $name => $value) {
            $typeId = $this->products->findOptionTypeId($productId, (string) $name)
                ?? $this->products->createOptionType($productId, (string) $name);
            $valueId = $this->products->findOptionValueId($typeId, (string) $value)
                ?? $this->products->createOptionValue($typeId, (string) $value);
            $this->products->linkVariantOption($variantId, $valueId);
        }
    }

    private function clearDefaultVariants(int $productId, int $exceptVariantId): void
    {
        $this->db->execute(
            'UPDATE product_variants SET is_default = 0 WHERE product_id = :product_id AND id <> :id',
            ['product_id' => $productId, 'id' => $exceptVariantId],
        );
    }

    private function uniqueSlug(string $source): string
    {
        $base = Str::slug($source) ?: 'product';
        $slug = $base;
        $attempt = 0;

        while ($this->products->slugExists($slug)) {
            $attempt++;
            $slug = $base . '-' . strtolower(bin2hex(random_bytes(3)));
            if ($attempt > 10) {
                $slug = $base . '-' . time();
                break;
            }
        }

        return $slug;
    }
}
