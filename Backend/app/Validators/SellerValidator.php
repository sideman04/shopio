<?php

declare(strict_types=1);

namespace Shopio\Validators;

/**
 * Seller-side validators (store profile, fulfilment, payouts).
 */
final class SellerValidator
{
    use ValidatesNested;

    /**
     * @param array<string,mixed> $data
     * @return array<string,mixed>
     */
    public static function profileUpdate(array $data): array
    {
        return Validator::check($data, [
            'store_name' => 'sometimes|required|safe_text|string|min:2|max:150',
            'store_description' => 'sometimes|nullable|safe_text|string|max:5000',
            'business_category' => 'sometimes|nullable|safe_text|string|max:120',
            'contact_phone' => 'sometimes|nullable|phone|max:32',
            'region_id' => 'sometimes|nullable|integer|min:1',
            'city_id' => 'sometimes|nullable|integer|min:1',
            'address' => 'sometimes|nullable|safe_text|string|max:255',
            'logo_url' => 'sometimes|nullable|url|max:2048',
            'banner_url' => 'sometimes|nullable|url|max:2048',
            'status' => 'sometimes|in:active,paused,closed',
        ]);
    }

    /**
     * @param array<string,mixed> $data
     * @return array<string,mixed>
     */
    public static function register(array $data): array
    {
        return Validator::check($data, [
            'store_name' => 'required|safe_text|string|min:2|max:150',
            'store_description' => 'nullable|safe_text|string|max:5000',
            'business_category' => 'nullable|safe_text|string|max:120',
            'contact_phone' => 'nullable|phone|max:32',
            'region_id' => 'nullable|integer|min:1',
            'city_id' => 'nullable|integer|min:1',
            'address' => 'nullable|safe_text|string|max:255',
        ]);
    }

    /**
     * @param array<string,mixed> $data
     * @return array<string,mixed>
     */
    public static function fulfillmentUpdate(array $data): array
    {
        return Validator::check($data, [
            'item_id' => 'required|integer|min:1',
            'status' => 'required|in:processing,shipped,delivered,cancelled',
            'carrier' => 'nullable|safe_text|string|max:100',
            'tracking_number' => 'nullable|safe_text|string|max:150',
            'tracking_url' => 'nullable|url|max:2048',
            'shipping_cost' => 'nullable|decimal|min:0|max:99999999999',
            'note' => 'nullable|safe_text|string|max:500',
        ]);
    }

    /**
     * @param array<string,mixed> $data
     * @return array<string,mixed>
     */
    public static function payoutRequest(array $data): array
    {
        return Validator::check($data, [
            'amount' => 'nullable|decimal|min:0.01|max:99999999999',
            'payout_method' => 'required|safe_text|string|max:60',
            'destination_label' => 'required|safe_text|string|max:150',
        ]);
    }

    /**
     * @param array<string,mixed> $data
     * @return array<string,mixed>
     */
    public static function documentUpload(array $data): array
    {
        return Validator::check($data, [
            'document_type' => 'required|in:business_licence,tax_certificate,id_document,address_proof,bank_statement,other',
            'label' => 'nullable|safe_text|string|max:120',
        ]);
    }

    /**
     * Seller notification/shipping/payment preferences are a JSON bag.
     *
     * @param array<string,mixed> $data
     * @return array<string,mixed>
     */
    public static function preferences(array $data): array
    {
        $validated = Validator::check($data, [
            'preferences' => 'required|array|min:1|max:50',
        ]);

        $clean = [];
        foreach ($validated['preferences'] as $key => $value) {
            if (preg_match('/^[a-z0-9_.]{2,80}$/', (string) $key) !== 1) {
                throw new \Shopio\Exceptions\ValidationException(['preferences' => ["Invalid preference key: {$key}."]]);
            }

            if (!is_scalar($value) && $value !== null && !is_array($value)) {
                throw new \Shopio\Exceptions\ValidationException(['preferences' => ["Preference '{$key}' must be a scalar or array."]]);
            }

            $clean[(string) $key] = $value;
        }

        return ['preferences' => $clean];
    }
}
