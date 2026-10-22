<?php

declare(strict_types=1);

namespace Shopio\Support;

/**
 * Turns database rows into client-facing payloads.
 *
 * Centralising this guarantees that internal-only columns (cost prices, provider
 * payloads, password hashes, private seller notes) are never serialised by
 * accident, and keeps field naming consistent (camelCase) for the React client.
 */
final class Presenter
{
    /**
     * @param array<string,mixed> $row
     * @param list<string>        $roles
     * @return array<string,mixed>
     */
    public static function user(array $row, array $roles = [], ?int $sellerId = null): array
    {
        $user = [
            'id' => (int) $row['id'],
            'fullName' => (string) $row['full_name'],
            'email' => (string) $row['email'],
            'phone' => $row['phone'] !== null ? (string) $row['phone'] : null,
            'roles' => $roles,
            'status' => (string) $row['status'],
            'emailVerifiedAt' => $row['email_verified_at'] ?? null,
            'phoneVerifiedAt' => $row['phone_verified_at'] ?? null,
            'lastLoginAt' => $row['last_login_at'] ?? null,
            'createdAt' => $row['created_at'] ?? null,
        ];

        if ($sellerId !== null) {
            $user['sellerId'] = $sellerId;
        }

        return $user;
    }

    /**
     * @param array<string,mixed>      $row
     * @param list<array<string,mixed>> $images
     * @param list<array<string,mixed>> $variants
     * @param list<array<string,mixed>> $optionTypes
     * @return array<string,mixed>
     */
    public static function product(array $row, array $images = [], array $variants = [], array $optionTypes = []): array
    {
        return [
            'id' => (int) $row['id'],
            'sellerId' => (int) $row['seller_id'],
            'categoryId' => $row['category_id'] !== null ? (int) $row['category_id'] : null,
            'name' => (string) $row['name'],
            'slug' => (string) $row['slug'],
            'shortDescription' => $row['short_description'] ?? null,
            'description' => $row['description'] ?? null,
            'brand' => $row['brand'] ?? null,
            'conditionType' => (string) $row['condition_type'],
            'status' => (string) ($row['status'] ?? 'active'),
            'currency' => (string) ($row['currency'] ?? 'TZS'),
            'createdAt' => $row['created_at'] ?? null,
            'updatedAt' => $row['updated_at'] ?? null,
            'categoryName' => $row['category_name'] ?? null,
            'categorySlug' => $row['category_slug'] ?? null,
            'sellerName' => $row['seller_name'] ?? null,
            'sellerSlug' => $row['seller_slug'] ?? null,
            'rating' => (float) ($row['rating'] ?? 0),
            'reviewCount' => (int) ($row['review_count'] ?? 0),
            'images' => array_map([self::class, 'productImage'], $images),
            'variants' => array_map([self::class, 'variant'], $variants),
            'optionTypes' => $optionTypes,
        ];
    }

    /**
     * Catalogue list row (no variants/images arrays).
     *
     * @param array<string,mixed> $row
     * @return array<string,mixed>
     */
    public static function productSummary(array $row): array
    {
        return [
            'id' => (int) $row['id'],
            'sellerId' => (int) $row['seller_id'],
            'categoryId' => $row['category_id'] !== null ? (int) $row['category_id'] : null,
            'name' => (string) $row['name'],
            'slug' => (string) $row['slug'],
            'shortDescription' => $row['short_description'] ?? null,
            'brand' => $row['brand'] ?? null,
            'conditionType' => (string) $row['condition_type'],
            'currency' => (string) ($row['currency'] ?? 'TZS'),
            'categoryName' => $row['category_name'] ?? null,
            'categorySlug' => $row['category_slug'] ?? null,
            'sellerName' => $row['seller_name'] ?? null,
            'sellerSlug' => $row['seller_slug'] ?? null,
            'rating' => (float) ($row['rating'] ?? 0),
            'reviewCount' => (int) ($row['review_count'] ?? 0),
            'minPrice' => isset($row['min_price']) ? (string) $row['min_price'] : null,
            'maxPrice' => isset($row['max_price']) ? (string) $row['max_price'] : null,
            'availableStock' => (int) ($row['available_stock'] ?? 0),
            'primaryImage' => $row['primary_image'] ?? null,
            'createdAt' => $row['created_at'] ?? null,
        ];
    }

    /**
     * @param array<string,mixed> $row
     * @return array<string,mixed>
     */
    public static function productImage(array $row): array
    {
        return [
            'id' => (int) $row['id'],
            'productId' => (int) $row['product_id'],
            'imageUrl' => (string) $row['image_url'],
            'altText' => $row['alt_text'] ?? null,
            'sortOrder' => (int) $row['sort_order'],
            'isPrimary' => (bool) $row['is_primary'],
        ];
    }

    /**
     * PUBLIC variant shape: `costPrice` is deliberately omitted so internal cost
     * data never reaches catalogue consumers.
     *
     * @param array<string,mixed> $row
     * @return array<string,mixed>
     */
    public static function variant(array $row): array
    {
        return [
            'id' => (int) $row['id'],
            'productId' => (int) $row['product_id'],
            'sku' => (string) $row['sku'],
            'variantName' => (string) $row['variant_name'],
            'price' => (string) $row['price'],
            'compareAtPrice' => $row['compare_at_price'] !== null ? (string) $row['compare_at_price'] : null,
            'weightGrams' => $row['weight_grams'] !== null ? (int) $row['weight_grams'] : null,
            'isDefault' => (bool) $row['is_default'],
            'isActive' => (bool) $row['is_active'],
            'stock' => (int) ($row['available_stock'] ?? $row['quantity_on_hand'] ?? 0),
            'lowStockThreshold' => (int) ($row['low_stock_threshold'] ?? 5),
        ];
    }

    /**
     * SELLER variant shape: includes cost price and reservation detail.
     *
     * @param array<string,mixed> $row
     * @return array<string,mixed>
     */
    public static function sellerVariant(array $row): array
    {
        return self::variant($row) + [
            'costPrice' => $row['cost_price'] !== null ? (string) $row['cost_price'] : null,
            'quantityOnHand' => (int) ($row['quantity_on_hand'] ?? 0),
            'quantityReserved' => (int) ($row['quantity_reserved'] ?? 0),
            'availableStock' => (int) ($row['available_stock'] ?? 0),
        ];
    }

    /**
     * @param array<string,mixed> $row
     * @return array<string,mixed>
     */
    public static function category(array $row): array
    {
        return [
            'id' => (int) $row['id'],
            'parentId' => $row['parent_id'] !== null ? (int) $row['parent_id'] : null,
            'name' => (string) $row['name'],
            'slug' => (string) $row['slug'],
            'description' => $row['description'] ?? null,
            'imageUrl' => $row['image_url'] ?? null,
            'sortOrder' => (int) $row['sort_order'],
            'status' => (string) $row['status'],
            'productCount' => isset($row['product_count']) ? (int) $row['product_count'] : null,
        ];
    }

    /**
     * @param array<string,mixed> $row
     * @return array<string,mixed>
     */
    public static function seller(array $row, bool $includeOwner = false): array
    {
        $seller = [
            'id' => (int) $row['id'],
            'storeName' => (string) $row['store_name'],
            'storeSlug' => (string) $row['store_slug'],
            'storeDescription' => $row['store_description'] ?? null,
            'logoUrl' => $row['logo_url'] ?? null,
            'bannerUrl' => $row['banner_url'] ?? null,
            'businessCategory' => $row['business_category'] ?? null,
            'contactPhone' => $row['contact_phone'] ?? null,
            'regionId' => ($row['region_id'] ?? null) !== null ? (int) $row['region_id'] : null,
            'cityId' => ($row['city_id'] ?? null) !== null ? (int) $row['city_id'] : null,
            'address' => $row['address'] ?? null,
            'verificationStatus' => (string) $row['verification_status'],
            'commissionRate' => (string) $row['commission_rate'],
            'status' => (string) $row['status'],
            'createdAt' => $row['created_at'] ?? null,
        ];

        if ($includeOwner) {
            $seller['userId'] = (int) $row['user_id'];
            $seller['verificationNotes'] = $row['verification_notes'] ?? null;
            $seller['verifiedAt'] = $row['verified_at'] ?? null;
        }

        foreach (['owner_name', 'owner_email', 'owner_phone', 'owner_status', 'product_count'] as $hydrated) {
            if (!array_key_exists($hydrated, $row)) {
                continue;
            }
            $seller[match ($hydrated) {
                'owner_name' => 'ownerName',
                'owner_email' => 'ownerEmail',
                'owner_phone' => 'ownerPhone',
                'owner_status' => 'ownerStatus',
                default => 'productCount',
            }] = $row[$hydrated];
        }

        return $seller;
    }

    /**
     * @param array<string,mixed> $row
     * @return array<string,mixed>
     */
    public static function address(array $row): array
    {
        return [
            'id' => (int) $row['id'],
            'userId' => isset($row['user_id']) ? (int) $row['user_id'] : 0,
            'label' => $row['label'] ?? null,
            'recipientName' => (string) $row['recipient_name'],
            'phone' => (string) $row['phone'],
            'cityId' => (int) $row['city_id'],
            'cityName' => $row['city_name'] ?? null,
            'regionName' => $row['region_name'] ?? null,
            'countryCode' => $row['country_code'] ?? null,
            'district' => $row['district'] ?? null,
            'streetAddress' => (string) $row['street_address'],
            'postalCode' => $row['postal_code'] ?? null,
            'deliveryInstructions' => $row['delivery_instructions'] ?? null,
            'isDefault' => (bool) $row['is_default'],
        ];
    }

    /**
     * @param array<string,mixed> $row
     * @return array<string,mixed>
     */
    public static function cartItem(array $row): array
    {
        $unitPrice = (string) $row['price'];
        $quantity = (int) $row['quantity'];

        return [
            'id' => (int) $row['id'],
            'variantId' => (int) $row['variant_id'],
            'productId' => (int) $row['product_id'],
            'name' => (string) $row['product_name'],
            'slug' => (string) $row['product_slug'],
            'variantName' => (string) $row['variant_name'],
            'sku' => (string) $row['sku'],
            'unitPrice' => $unitPrice,
            'compareAtPrice' => $row['compare_at_price'] !== null ? (string) $row['compare_at_price'] : null,
            'quantity' => $quantity,
            'lineTotal' => Money::mul($unitPrice, $quantity),
            'stock' => (int) $row['available_stock'],
            'imageUrl' => $row['primary_image'] ?? null,
            'sellerId' => (int) $row['seller_id'],
            'sellerName' => $row['seller_name'] ?? null,
            'currency' => (string) ($row['currency'] ?? 'TZS'),
            'available' => self::cartItemAvailable($row),
            'unavailableReason' => self::cartItemUnavailableReason($row),
        ];
    }

    /**
     * @param array<string,mixed> $row
     */
    public static function cartItemAvailable(array $row): bool
    {
        return self::cartItemUnavailableReason($row) === null;
    }

    /**
     * @param array<string,mixed> $row
     */
    public static function cartItemUnavailableReason(array $row): ?string
    {
        if (($row['product_status'] ?? '') !== 'active' || ($row['product_deleted_at'] ?? null) !== null) {
            return 'This product is no longer available.';
        }

        if ((int) ($row['variant_is_active'] ?? 1) !== 1) {
            return 'This variant is no longer available.';
        }

        if (($row['seller_status'] ?? 'active') !== 'active') {
            return 'This seller is currently unavailable.';
        }

        if ((int) ($row['available_stock'] ?? 0) <= 0) {
            return 'Out of stock.';
        }

        if ((int) ($row['available_stock'] ?? 0) < (int) $row['quantity']) {
            return 'Only ' . (int) $row['available_stock'] . ' left in stock.';
        }

        return null;
    }

    /**
     * @param array<string,mixed>       $row
     * @param list<array<string,mixed>> $items
     * @param list<array<string,mixed>> $adjustments
     * @param list<array<string,mixed>> $history
     * @param array<string,mixed>|null  $totals
     * @return array<string,mixed>
     */
    public static function order(array $row, array $items, array $adjustments, array $history, ?array $totals): array
    {
        return [
            'id' => (int) $row['id'],
            'orderNumber' => (string) $row['order_number'],
            'userId' => $row['user_id'] !== null ? (int) $row['user_id'] : null,
            'customerName' => (string) $row['customer_name'],
            'customerEmail' => (string) $row['customer_email'],
            'customerPhone' => (string) $row['customer_phone'],
            'currency' => (string) $row['currency'],
            'status' => (string) $row['status'],
            'paymentStatus' => (string) $row['payment_status'],
            'fulfillmentStatus' => (string) $row['fulfillment_status'],
            'shippingAddressLine' => (string) $row['shipping_address_line'],
            'shippingDistrict' => $row['shipping_district'] ?? null,
            'shippingCity' => (string) $row['shipping_city'],
            'shippingRegion' => (string) $row['shipping_region'],
            'shippingCountryCode' => (string) $row['shipping_country_code'],
            'shippingPostalCode' => $row['shipping_postal_code'] ?? null,
            'shippingInstructions' => $row['shipping_instructions'] ?? null,
            'customerNote' => $row['customer_note'] ?? null,
            'placedAt' => $row['placed_at'] ?? null,
            'confirmedAt' => $row['confirmed_at'] ?? null,
            'deliveredAt' => $row['delivered_at'] ?? null,
            'cancelledAt' => $row['cancelled_at'] ?? null,
            'items' => array_map([self::class, 'orderItem'], $items),
            'adjustments' => array_map([self::class, 'orderAdjustment'], $adjustments),
            'history' => array_map([self::class, 'orderHistory'], $history),
            'itemsSubtotal' => (string) ($totals['items_subtotal'] ?? '0.00'),
            'itemsDiscount' => (string) ($totals['items_discount'] ?? '0.00'),
            'shippingTotal' => (string) ($totals['shipping_total'] ?? '0.00'),
            'taxTotal' => (string) ($totals['tax_total'] ?? '0.00'),
            'grandTotal' => (string) ($totals['grand_total'] ?? '0.00'),
        ];
    }

    /**
     * @param array<string,mixed> $row
     * @return array<string,mixed>
     */
    public static function orderItem(array $row): array
    {
        return [
            'id' => (int) $row['id'],
            'orderId' => (int) $row['order_id'],
            'productId' => isset($row['product_id']) ? (int) $row['product_id'] : null,
            'variantId' => $row['variant_id'] !== null ? (int) $row['variant_id'] : null,
            'sellerId' => $row['seller_id'] !== null ? (int) $row['seller_id'] : null,
            'sellerName' => $row['seller_name'] ?? null,
            'productSlug' => $row['product_slug'] ?? null,
            'productName' => (string) $row['product_name_snapshot'],
            'sku' => (string) $row['sku_snapshot'],
            'variantName' => (string) $row['variant_snapshot'],
            'imageUrl' => $row['image_url_snapshot'] ?? null,
            'quantity' => (int) $row['quantity'],
            'unitPrice' => (string) $row['unit_price'],
            'lineTotal' => Money::mul((string) $row['unit_price'], (int) $row['quantity']),
            'discountAmount' => (string) $row['discount_amount'],
            'sellerCommissionRate' => (string) $row['seller_commission_rate'],
            'fulfillmentStatus' => (string) $row['fulfillment_status'],
        ];
    }

    /**
     * @param array<string,mixed> $row
     * @return array<string,mixed>
     */
    public static function orderAdjustment(array $row): array
    {
        return [
            'id' => (int) $row['id'],
            'orderId' => (int) $row['order_id'],
            'adjustmentType' => (string) $row['adjustment_type'],
            'label' => (string) $row['label'],
            'amount' => (string) $row['amount'],
        ];
    }

    /**
     * @param array<string,mixed> $row
     * @return array<string,mixed>
     */
    public static function orderHistory(array $row): array
    {
        return [
            'id' => (int) $row['id'],
            'orderId' => (int) $row['order_id'],
            'oldStatus' => $row['old_status'] ?? null,
            'newStatus' => (string) $row['new_status'],
            'note' => $row['note'] ?? null,
            'changedBy' => $row['changed_by_name'] ?? null,
            'createdAt' => $row['created_at'] ?? null,
        ];
    }

    /**
     * @param array<string,mixed> $row
     * @return array<string,mixed>
     */
    public static function orderSummary(array $row, bool $admin = false): array
    {
        $summary = [
            'id' => (int) $row['id'],
            'orderNumber' => (string) $row['order_number'],
            'status' => (string) $row['status'],
            'paymentStatus' => (string) $row['payment_status'],
            'fulfillmentStatus' => (string) $row['fulfillment_status'],
            'currency' => (string) $row['currency'],
            'customerName' => (string) $row['customer_name'],
            'placedAt' => $row['placed_at'] ?? null,
            'grandTotal' => (string) ($row['grand_total'] ?? '0.00'),
            'itemCount' => isset($row['item_count']) ? (int) $row['item_count'] : null,
            'sellerSubtotal' => isset($row['seller_subtotal']) ? (string) $row['seller_subtotal'] : null,
        ];

        if (!$admin) {
            $summary['customerEmail'] = (string) $row['customer_email'];
        } else {
            $summary['customerEmail'] = (string) $row['customer_email'];
        }

        if (isset($row['customer_phone'])) {
            $summary['customerPhone'] = (string) $row['customer_phone'];
        }

        if (isset($row['shipping_city'])) {
            $summary['shippingCity'] = (string) $row['shipping_city'];
            $summary['shippingRegion'] = (string) $row['shipping_region'];
            $summary['shippingAddressLine'] = (string) $row['shipping_address_line'];
        }

        if (isset($row['seller_count'])) {
            $summary['sellerCount'] = (int) $row['seller_count'];
        }

        return $summary;
    }

    /**
     * @param array<string,mixed> $row
     * @return array<string,mixed>
     */
    public static function review(array $row, bool $internal = false): array
    {
        $review = [
            'id' => (int) $row['id'],
            'productId' => (int) $row['product_id'],
            'rating' => (int) $row['rating'],
            'title' => $row['title'] ?? null,
            'reviewText' => $row['review_text'] ?? null,
            'status' => (string) $row['status'],
            'sellerReply' => $row['seller_reply'] ?? null,
            'sellerRepliedAt' => $row['seller_replied_at'] ?? null,
            'customerName' => $row['customer_name'] ?? null,
            'createdAt' => $row['created_at'] ?? null,
        ];

        if ($internal) {
            $review['userId'] = isset($row['user_id']) ? (int) $row['user_id'] : null;
            $review['productName'] = $row['product_name'] ?? null;
            $review['sellerName'] = $row['seller_name'] ?? null;
            $review['customerEmail'] = $row['customer_email'] ?? null;
            $review['reported'] = isset($row['reported']) ? (bool) $row['reported'] : false;
        }

        return $review;
    }

    /**
     * @param array<string,mixed> $row
     * @return array<string,mixed>
     */
    public static function notification(array $row): array
    {
        $data = $row['data'] ?? null;
        if (is_string($data)) {
            $data = json_decode($data, true);
        }

        return [
            'id' => (int) $row['id'],
            'type' => (string) $row['type'],
            'title' => (string) $row['title'],
            'message' => (string) $row['message'],
            'targetUrl' => $row['target_url'] ?? null,
            'data' => $data,
            'readAt' => $row['read_at'] ?? null,
            'createdAt' => $row['created_at'] ?? null,
        ];
    }

    /**
     * @param array<string,mixed> $row
     * @return array<string,mixed>
     */
    public static function auditLog(array $row): array
    {
        $details = $row['details'] ?? null;
        if (is_string($details)) {
            $details = json_decode($details, true);
        }

        return [
            'id' => (int) $row['id'],
            'actorUserId' => $row['actor_user_id'] !== null ? (int) $row['actor_user_id'] : null,
            'actorName' => $row['actor_name'] ?? null,
            'actorEmail' => $row['actor_email'] ?? null,
            'action' => (string) $row['action'],
            'entityType' => (string) $row['entity_type'],
            'entityId' => $row['entity_id'] !== null ? (int) $row['entity_id'] : null,
            'ipAddress' => $row['ip_address'] ?? null,
            'details' => $details,
            'createdAt' => $row['created_at'] ?? null,
        ];
    }

    /**
     * @param array<string,mixed> $row
     * @return array<string,mixed>
     */
    public static function coupon(array $row): array
    {
        return [
            'id' => (int) $row['id'],
            'code' => (string) $row['code'],
            'description' => $row['description'] ?? null,
            'discountType' => (string) $row['discount_type'],
            'discountValue' => (string) $row['discount_value'],
            'minimumOrderAmount' => (string) $row['minimum_order_amount'],
            'maximumDiscountAmount' => $row['maximum_discount_amount'] !== null ? (string) $row['maximum_discount_amount'] : null,
            'usageLimit' => $row['usage_limit'] !== null ? (int) $row['usage_limit'] : null,
            'perUserLimit' => $row['per_user_limit'] !== null ? (int) $row['per_user_limit'] : null,
            'usedCount' => isset($row['used_count']) ? (int) $row['used_count'] : null,
            'startsAt' => $row['starts_at'] ?? null,
            'expiresAt' => $row['expires_at'] ?? null,
            'status' => (string) $row['status'],
        ];
    }

    /**
     * @param array<string,mixed> $row
     * @return array<string,mixed>
     */
    public static function banner(array $row): array
    {
        return [
            'id' => (int) $row['id'],
            'title' => (string) $row['title'],
            'subtitle' => $row['subtitle'] ?? null,
            'imageUrl' => $row['image_url'] ?? null,
            'buttonText' => $row['button_text'] ?? null,
            'targetUrl' => $row['target_url'] ?? null,
            'placement' => (string) $row['placement'],
            'startsAt' => $row['starts_at'] ?? null,
            'endsAt' => $row['ends_at'] ?? null,
            'sortOrder' => (int) $row['sort_order'],
            'status' => (string) $row['status'],
        ];
    }

    /**
     * @param array<string,mixed> $row
     * @return array<string,mixed>
     */
    public static function payout(array $row): array
    {
        $payout = [
            'id' => (int) $row['id'],
            'sellerId' => (int) $row['seller_id'],
            'payoutReference' => (string) $row['payout_reference'],
            'amount' => (string) $row['amount'],
            'currency' => (string) $row['currency'],
            'payoutMethod' => $row['payout_method'] ?? null,
            'destinationLabel' => $row['destination_label'] ?? null,
            'status' => (string) $row['status'],
            'requestedAt' => $row['requested_at'] ?? null,
            'processedAt' => $row['processed_at'] ?? null,
            'adminNote' => $row['admin_note'] ?? null,
        ];

        if (isset($row['seller_name'])) {
            $payout['sellerName'] = $row['seller_name'];
        }

        if (isset($row['item_count'])) {
            $payout['itemCount'] = (int) $row['item_count'];
        }

        return $payout;
    }

    /**
     * @param array<string,mixed> $row
     * @return array<string,mixed>
     */
    public static function refund(array $row): array
    {
        return [
            'id' => (int) $row['id'],
            'orderId' => (int) $row['order_id'],
            'orderNumber' => $row['order_number'] ?? null,
            'paymentId' => (int) $row['payment_id'],
            'amount' => (string) $row['amount'],
            'reason' => $row['reason'] ?? null,
            'status' => (string) $row['status'],
            'providerReference' => $row['provider_reference'] ?? null,
            'processedAt' => $row['processed_at'] ?? null,
            'createdAt' => $row['created_at'] ?? null,
            'customerName' => $row['customer_name'] ?? null,
            'requestedByName' => $row['requested_by_name'] ?? null,
            'processedByName' => $row['processed_by_name'] ?? null,
        ];
    }

    /**
     * @param array<string,mixed> $row
     * @return array<string,mixed>
     */
    public static function payment(array $row): array
    {
        return [
            'id' => (int) $row['id'],
            'orderId' => (int) $row['order_id'],
            'orderNumber' => $row['order_number'] ?? null,
            'provider' => (string) $row['provider'],
            'providerReference' => $row['provider_reference'] ?? null,
            'amount' => (string) $row['amount'],
            'currency' => (string) $row['currency'],
            'status' => (string) $row['status'],
            'paymentMethod' => $row['payment_method'] ?? null,
            'paidAt' => $row['paid_at'] ?? null,
            'createdAt' => $row['created_at'] ?? null,
        ];
    }
}
