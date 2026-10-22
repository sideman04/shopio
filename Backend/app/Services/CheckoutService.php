<?php

declare(strict_types=1);

namespace Shopio\Services;

use Shopio\Auth\AuthenticatedUser;
use Shopio\Config\Config;
use Shopio\Database\Database;
use Shopio\Exceptions\ConflictException;
use Shopio\Exceptions\ValidationException;
use Shopio\Http\Request;
use Shopio\Repositories\AddressRepository;
use Shopio\Repositories\CartRepository;
use Shopio\Repositories\CouponRepository;
use Shopio\Repositories\InventoryRepository;
use Shopio\Repositories\OrderRepository;
use Shopio\Repositories\ProductRepository;
use Shopio\Support\Money;
use Shopio\Support\Str;

/**
 * Checkout: turns the authenticated user's cart into an order.
 *
 * Everything that changes state runs in one transaction. Stock is held with the
 * guarded conditional UPDATE in {@see InventoryRepository::hold()} while the
 * variant row is locked, which is what makes concurrent checkouts safe. A
 * per-item `stock_reservations` row records the hold so it can be released or
 * settled later.
 */
final class CheckoutService
{
    public function __construct(
        private readonly Database $db,
        private readonly CartRepository $carts,
        private readonly CartService $cartService,
        private readonly ProductRepository $products,
        private readonly InventoryRepository $inventory,
        private readonly OrderRepository $orders,
        private readonly CouponRepository $coupons,
        private readonly CouponService $couponService,
        private readonly AddressRepository $addresses,
        private readonly OrderService $orderService,
        private readonly PaymentService $payments,
        private readonly AuditService $audit,
    ) {
    }

    /**
     * @param array<string,mixed> $data
     * @return array{order:array<string,mixed>,payment:array<string,mixed>|null}
     */
    public function checkout(AuthenticatedUser $auth, array $data, Request $request): array
    {
        $cartId = $this->cartService->resolveCartId($auth);
        $items = $this->carts->items($cartId);

        if ($items === []) {
            throw new ValidationException(['cart' => ['Your cart is empty.']]);
        }

        $shipping = $this->resolveShipping($auth, $data);

        $orderId = $this->db->transaction(function () use ($auth, $cartId, $items, $shipping, $data): int {
            $subtotal = '0.00';
            $lines = [];

            foreach ($items as $item) {
                $variantId = (int) $item['variant_id'];
                $quantity = (int) $item['quantity'];

                // Lock the variant (and its inventory row) for the duration of the
                // transaction so availability cannot change under us.
                $variant = $this->products->lockVariantForCheckout($variantId);
                if ($variant === null || (int) $variant['variant_is_active'] !== 1
                    || $variant['product_status'] !== 'active' || $variant['product_deleted_at'] !== null
                    || $variant['seller_status'] !== 'active') {
                    throw new ValidationException(['cart' => ['"' . (string) $item['product_name'] . '" is no longer available.']]);
                }

                if (!$this->inventory->hold($variantId, $quantity)) {
                    throw new ConflictException('"' . (string) $item['product_name'] . '" does not have enough stock.');
                }

                $unitPrice = (string) $variant['price'];
                $subtotal = Money::add($subtotal, Money::mul($unitPrice, $quantity));

                $lines[] = [
                    'variant' => $variant,
                    'quantity' => $quantity,
                    'unit_price' => $unitPrice,
                    'image' => $this->primaryImage((int) $variant['product_id']),
                ];
            }

            $coupon = null;
            $discount = '0.00';
            if (!empty($data['coupon_code'])) {
                $coupon = $this->coupons->findByCode((string) $data['coupon_code']);
                if ($coupon === null) {
                    // Fail closed: a supplied-but-unknown code must be reported,
                    // never silently ignored (which would charge full price).
                    throw new ValidationException(['coupon_code' => ['This coupon code is not valid.']]);
                }

                $locked = $this->coupons->lockById((int) $coupon['id']) ?? $coupon;
                $this->couponService->assertUsable($locked, $subtotal, $auth->id);
                $discount = $this->couponService->discountFor($locked, $subtotal);
                $coupon = $locked;
            }

            $shippingFlat = Money::format(Config::get('DEFAULT_SHIPPING_FLAT', '0.00') ?? '0.00');
            $taxRate = Money::format(Config::get('DEFAULT_TAX_RATE', '0.00') ?? '0.00');
            $taxable = Money::sub($subtotal, $discount);
            $tax = Money::percent($taxable, $taxRate);

            $orderId = $this->orders->create([
                'order_number' => $this->orders->generateOrderNumber(),
                'user_id' => $auth->id,
                'customer_email' => $shipping['customer_email'],
                'customer_name' => $shipping['customer_name'],
                'customer_phone' => $shipping['customer_phone'],
                'currency' => Config::get('DEFAULT_CURRENCY', 'TZS') ?? 'TZS',
                'status' => 'pending',
                'payment_status' => 'unpaid',
                'shipping_address_line' => $shipping['shipping_address_line'],
                'shipping_district' => $shipping['shipping_district'],
                'shipping_city' => $shipping['shipping_city'],
                'shipping_region' => $shipping['shipping_region'],
                'shipping_country_code' => $shipping['shipping_country_code'],
                'shipping_postal_code' => $shipping['shipping_postal_code'],
                'shipping_instructions' => $shipping['shipping_instructions'],
                'customer_note' => $data['customer_note'] ?? null,
            ]);

            $expiresAt = gmdate('Y-m-d H:i:s', time() + Config::int('STOCK_RESERVATION_TTL', 900));

            foreach ($lines as $line) {
                $variant = $line['variant'];
                $orderItemId = $this->orders->createItem([
                    'order_id' => $orderId,
                    'variant_id' => (int) $variant['variant_id'],
                    'seller_id' => (int) $variant['seller_id'],
                    'product_name_snapshot' => (string) $variant['product_name'],
                    'sku_snapshot' => (string) $variant['sku'],
                    'variant_snapshot' => (string) $variant['variant_name'],
                    'image_url_snapshot' => $line['image'],
                    'quantity' => $line['quantity'],
                    'unit_price' => $line['unit_price'],
                    'discount_amount' => '0.00',
                    'seller_commission_rate' => (string) $variant['commission_rate'],
                    'fulfillment_status' => 'unfulfilled',
                ]);

                $this->inventory->createReservation(
                    $orderId,
                    $orderItemId,
                    (int) $variant['variant_id'],
                    $line['quantity'],
                    $expiresAt,
                );
            }

            if (!Money::isZero($discount)) {
                $this->orders->createAdjustment([
                    'order_id' => $orderId,
                    'adjustment_type' => 'discount',
                    'label' => 'Coupon ' . (string) ($coupon['code'] ?? ''),
                    'amount' => $discount,
                ]);
            }

            if (!Money::isZero($shippingFlat)) {
                $this->orders->createAdjustment([
                    'order_id' => $orderId,
                    'adjustment_type' => 'shipping',
                    'label' => 'Shipping',
                    'amount' => $shippingFlat,
                ]);
            }

            if (!Money::isZero($tax)) {
                $this->orders->createAdjustment([
                    'order_id' => $orderId,
                    'adjustment_type' => 'tax',
                    'label' => 'Tax',
                    'amount' => $tax,
                ]);
            }

            if ($coupon !== null && !Money::isZero($discount)) {
                $this->coupons->recordApplied((int) $coupon['id'], $orderId, $auth->id, $discount);
            }

            $this->orders->addHistory($orderId, $auth->id, null, 'pending', 'Order placed');
            $this->carts->markConverted($cartId);
            $this->carts->clear($cartId);

            return $orderId;
        });

        $this->audit->record($auth, 'order.created', 'order', $orderId, $request);

        $payment = null;
        if (!empty($data['payment_provider'])) {
            $payment = $this->payments->initiate($orderId, (string) $data['payment_provider'], $data['payment_method'] ?? null, $request);
        }

        $order = $this->orders->findById($orderId);
        if ($order === null) {
            throw new ConflictException('The order could not be created.');
        }

        return ['order' => $this->orderService->present($order), 'payment' => $payment];
    }

    /**
     * @param array<string,mixed> $data
     * @return array<string,string|null>
     */
    private function resolveShipping(AuthenticatedUser $auth, array $data): array
    {
        if (!empty($data['address_id'])) {
            $address = $this->addresses->findOwned((int) $data['address_id'], $auth->id);
            if ($address === null) {
                throw new ValidationException(['address_id' => ['The selected address does not exist.']]);
            }

            return [
                'customer_name' => (string) $address['recipient_name'],
                'customer_email' => $auth->email(),
                'customer_phone' => (string) $address['phone'],
                'shipping_address_line' => (string) $address['street_address'],
                'shipping_district' => $address['district'] !== null ? (string) $address['district'] : null,
                'shipping_city' => (string) $address['city_name'],
                'shipping_region' => (string) $address['region_name'],
                'shipping_country_code' => (string) ($address['country_code'] ?? 'TZ'),
                'shipping_postal_code' => $address['postal_code'] !== null ? (string) $address['postal_code'] : null,
                'shipping_instructions' => $address['delivery_instructions'] !== null ? (string) $address['delivery_instructions'] : null,
            ];
        }

        $name = trim((string) ($data['customer_name'] ?? $auth->fullName()));
        $email = trim((string) ($data['customer_email'] ?? $auth->email()));
        $phone = Str::normalisePhone($data['customer_phone'] ?? null);

        if ($name === '' || $email === '') {
            throw new ValidationException(['customer_name' => ['A customer name and email are required.']]);
        }

        if ($phone === null) {
            throw new ValidationException(['customer_phone' => ['A contact phone number is required.']]);
        }

        return [
            'customer_name' => $name,
            'customer_email' => $email,
            'customer_phone' => $phone,
            'shipping_address_line' => (string) ($data['shipping_address_line'] ?? ''),
            'shipping_district' => $data['shipping_district'] ?? null,
            'shipping_city' => (string) ($data['shipping_city'] ?? ''),
            'shipping_region' => (string) ($data['shipping_region'] ?? ''),
            'shipping_country_code' => strtoupper((string) ($data['shipping_country_code'] ?? 'TZ')),
            'shipping_postal_code' => $data['shipping_postal_code'] ?? null,
            'shipping_instructions' => $data['shipping_instructions'] ?? null,
        ];
    }

    private function primaryImage(int $productId): ?string
    {
        $images = $this->products->images($productId);

        return $images === [] ? null : (string) $images[0]['image_url'];
    }
}
