<?php

declare(strict_types=1);

namespace Shopio\Controllers;

use Shopio\Http\Request;
use Shopio\Http\Response;
use Shopio\Services\CartService;
use Shopio\Validators\CommerceValidator;

/**
 * The authenticated customer's cart.
 */
final class CartController extends Controller
{
    public function __construct(private readonly CartService $cart)
    {
    }

    public function show(Request $request): Response
    {
        return $this->success($this->cart->get($this->auth($request)), 'Cart retrieved successfully', 200, [], $request);
    }

    public function addItem(Request $request): Response
    {
        $data = CommerceValidator::cartAdd($request->body());
        $cart = $this->cart->addItem($this->auth($request), (int) $data['variant_id'], (int) ($data['quantity'] ?? 1));

        return $this->success($cart, 'Item added to cart', 200, [], $request);
    }

    /**
     * @param array<string,string> $params
     */
    public function updateItem(Request $request, array $params): Response
    {
        $data = CommerceValidator::cartUpdate($request->body());
        $cart = $this->cart->updateItem($this->auth($request), $this->intParam($params, 'id'), (int) $data['quantity']);

        return $this->success($cart, 'Cart updated successfully', 200, [], $request);
    }

    /**
     * @param array<string,string> $params
     */
    public function removeItem(Request $request, array $params): Response
    {
        $cart = $this->cart->removeItem($this->auth($request), $this->intParam($params, 'id'));

        return $this->success($cart, 'Item removed from cart', 200, [], $request);
    }

    public function clear(Request $request): Response
    {
        $this->cart->clear($this->auth($request));

        return $this->success(null, 'Cart cleared successfully', 200, [], $request);
    }
}
