<?php

declare(strict_types=1);

namespace Shopio\Validators;

use Shopio\Exceptions\ValidationException;

/**
 * Customer commerce validators: cart, checkout, coupons, reviews, refunds.
 */
final class CommerceValidator
{
    /**
     * @param array<string,mixed> $data
     * @return array<string,mixed>
     */
    public static function cartAdd(array $data): array
    {
        return Validator::check($data, [
            'variant_id' => 'required|integer|min:1',
            'quantity' => 'sometimes|integer|min:1|max:999',
        ]);
    }

    /**
     * @param array<string,mixed> $data
     * @return array<string,mixed>
     */
    public static function cartUpdate(array $data): array
    {
        return Validator::check($data, [
            'quantity' => 'required|integer|min:0|max:999',
        ]);
    }

    /**
     * Checkout accepts EITHER a saved `address_id` OR an inline shipping address.
     * The service enforces that at least one is present and valid.
     *
     * @param array<string,mixed> $data
     * @return array<string,mixed>
     */
    public static function checkout(array $data): array
    {
        return Validator::check($data, [
            'address_id' => 'nullable|integer|min:1',
            'customer_name' => 'nullable|safe_text|string|min:2|max:150',
            'customer_email' => 'nullable|email|max:254',
            'customer_phone' => 'nullable|phone|max:32',
            'shipping_address_line' => 'nullable|safe_text|string|min:3|max:255',
            'shipping_district' => 'nullable|safe_text|string|max:100',
            'shipping_city' => 'required_without:address_id|nullable|safe_text|string|max:100',
            'shipping_region' => 'required_without:address_id|nullable|safe_text|string|max:100',
            'shipping_country_code' => 'sometimes|string|min:2|max:2',
            'shipping_postal_code' => 'nullable|safe_text|string|max:24',
            'shipping_instructions' => 'nullable|safe_text|string|max:500',
            'customer_note' => 'nullable|safe_text|string|max:2000',
            'coupon_code' => 'nullable|safe_text|string|max:60',
            'payment_provider' => 'sometimes|safe_text|string|max:60',
            'payment_method' => 'sometimes|nullable|safe_text|string|max:60',
        ]);
    }

    /**
     * @param array<string,mixed> $data
     * @return array<string,mixed>
     */
    public static function couponValidate(array $data): array
    {
        return Validator::check($data, [
            'code' => 'required|safe_text|string|min:2|max:60',
        ]);
    }

    /**
     * @param array<string,mixed> $data
     * @return array<string,mixed>
     */
    public static function orderCancel(array $data): array
    {
        return Validator::check($data, [
            'reason' => 'nullable|safe_text|string|max:500',
        ]);
    }

    /**
     * @param array<string,mixed> $data
     * @return array<string,mixed>
     */
    public static function refundRequest(array $data): array
    {
        $validated = Validator::check($data, [
            'amount' => 'nullable|decimal|min:0.01|max:99999999999',
            'reason' => 'required|safe_text|string|min:5|max:500',
        ]);

        if (array_key_exists('amount', $validated) && $validated['amount'] === null) {
            unset($validated['amount']);
        }

        return $validated;
    }

    /**
     * @param array<string,mixed> $data
     * @return array<string,mixed>
     */
    public static function reviewCreate(array $data): array
    {
        return Validator::check($data, [
            'rating' => 'required|integer|min:1|max:5',
            'title' => 'nullable|safe_text|string|max:180',
            'review_text' => 'nullable|safe_text|string|max:5000',
            'order_item_id' => 'nullable|integer|min:1',
        ]);
    }

    /**
     * @param array<string,mixed> $data
     * @return array<string,mixed>
     */
    public static function reviewReply(array $data): array
    {
        return Validator::check($data, [
            'reply' => 'required|safe_text|string|min:2|max:2000',
        ]);
    }

    /**
     * @param array<string,mixed> $data
     * @return array<string,mixed>
     */
    public static function reviewReport(array $data): array
    {
        return Validator::check($data, [
            'reason' => 'required|safe_text|string|min:5|max:500',
        ]);
    }

    /**
     * @param array<string,mixed> $data
     * @return array<string,mixed>
     */
    public static function wishlistAdd(array $data): array
    {
        return Validator::check($data, [
            'product_id' => 'required|integer|min:1',
        ]);
    }

    /**
     * @param array<string,mixed> $data
     * @return array<string,mixed>
     */
    public static function supportMessage(array $data): array
    {
        return Validator::check($data, [
            'name' => 'required|safe_text|string|min:2|max:150',
            'email' => 'required|email|max:254',
            'subject' => 'required|safe_text|string|min:3|max:200',
            'message' => 'required|safe_text|string|min:10|max:5000',
        ]);
    }

    /**
     * Validates an idempotency key header value.
     */
    public static function idempotencyKey(?string $value): ?string
    {
        if ($value === null || $value === '') {
            return null;
        }

        $value = trim($value);
        if (preg_match('/^[A-Za-z0-9._:-]{8,190}$/', $value) !== 1) {
            throw new ValidationException([
                'Idempotency-Key' => ['Must be 8-190 characters of letters, numbers, dot, colon, dash or underscore.'],
            ]);
        }

        return $value;
    }
}
