<?php

declare(strict_types=1);

namespace Shopio\Services;

use Shopio\Auth\AuthenticatedUser;
use Shopio\Config\Config;
use Shopio\Exceptions\NotFoundException;
use Shopio\Exceptions\ValidationException;
use Shopio\Repositories\CartRepository;
use Shopio\Repositories\ProductRepository;
use Shopio\Support\Money;
use Shopio\Support\Presenter;

/**
 * Shopping cart.
 *
 * The cart is always resolved from the authenticated user id (or, for guests,
 * the session token hash) — a cart id supplied by a client is never trusted.
 */
final class CartService
{
    public function __construct(
        private readonly CartRepository $carts,
        private readonly ProductRepository $products,
    ) {
    }

    /**
     * @return array<string,mixed>
     */
    public function get(AuthenticatedUser $auth): array
    {
        $cartId = $this->resolveCartId($auth);

        return $this->present($cartId);
    }

    /**
     * @return array<string,mixed>
     */
    public function addItem(AuthenticatedUser $auth, int $variantId, int $quantity): array
    {
        $variant = $this->products->findVariantWithProduct($variantId);
        if ($variant === null) {
            throw new NotFoundException('The requested product variant does not exist.');
        }

        if ((int) $variant['variant_is_active'] !== 1
            || $variant['product_status'] !== 'active'
            || $variant['product_deleted_at'] !== null
            || $variant['seller_status'] !== 'active') {
            throw new ValidationException(['variant_id' => ['This product is not currently available.']]);
        }

        $cartId = $this->resolveCartId($auth);

        $existing = $this->carts->findItem($cartId, $variantId);
        $newQuantity = ($existing === null ? 0 : (int) $existing['quantity']) + $quantity;

        if ($newQuantity > (int) $variant['available_stock']) {
            throw new ValidationException([
                'quantity' => ['Only ' . (int) $variant['available_stock'] . ' units are available.'],
            ]);
        }

        $this->carts->addOrIncrement($cartId, $variantId, $quantity);
        $this->carts->touch($cartId);

        return $this->present($cartId);
    }

    /**
     * @return array<string,mixed>
     */
    public function updateItem(AuthenticatedUser $auth, int $itemId, int $quantity): array
    {
        $cartId = $this->resolveCartId($auth);

        $item = $this->carts->findItemById($cartId, $itemId);
        if ($item === null) {
            throw new NotFoundException('The requested cart item does not exist.');
        }

        if ($quantity === 0) {
            $this->carts->removeItem($itemId, $cartId);

            return $this->present($cartId);
        }

        $variant = $this->products->findVariantWithProduct((int) $item['variant_id']);
        if ($variant === null || (int) $variant['available_stock'] < $quantity) {
            throw new ValidationException(['quantity' => ['The requested quantity is not available.']]);
        }

        $this->carts->setQuantity($itemId, $cartId, $quantity);
        $this->carts->touch($cartId);

        return $this->present($cartId);
    }

    /**
     * @return array<string,mixed>
     */
    public function removeItem(AuthenticatedUser $auth, int $itemId): array
    {
        $cartId = $this->resolveCartId($auth);
        $this->carts->removeItem($itemId, $cartId);
        $this->carts->touch($cartId);

        return $this->present($cartId);
    }

    public function clear(AuthenticatedUser $auth): void
    {
        $this->carts->clear($this->resolveCartId($auth));
    }

    public function resolveCartId(AuthenticatedUser $auth): int
    {
        return $this->carts->resolveForUser($auth->id, $this->expiry());
    }

    /**
     * @return array<string,mixed>
     */
    public function present(int $cartId): array
    {
        $items = array_map([Presenter::class, 'cartItem'], $this->carts->items($cartId));

        $subtotal = '0.00';
        $itemCount = 0;
        $hasUnavailable = false;
        foreach ($items as $item) {
            $subtotal = Money::add($subtotal, (string) $item['lineTotal']);
            $itemCount += (int) $item['quantity'];
            if (!$item['available']) {
                $hasUnavailable = true;
            }
        }

        return [
            'items' => $items,
            'itemCount' => $itemCount,
            'lineCount' => count($items),
            'subtotal' => $subtotal,
            'currency' => $items[0]['currency'] ?? Config::get('DEFAULT_CURRENCY', 'TZS'),
            'hasUnavailableItems' => $hasUnavailable,
        ];
    }

    private function expiry(): string
    {
        return gmdate('Y-m-d H:i:s', time() + Config::int('CART_TTL_SECONDS', 2_592_000));
    }
}
