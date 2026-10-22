<?php

declare(strict_types=1);

namespace Shopio\Validators;

/**
 * Customer profile and address validators.
 */
final class ProfileValidator
{
    /**
     * @param array<string,mixed> $data
     * @return array<string,mixed>
     */
    public static function update(array $data): array
    {
        $rules = [
            'full_name' => 'sometimes|required|safe_text|string|min:2|max:150',
            'phone' => 'sometimes|nullable|phone|max:32',
            'phone_verified_code' => 'sometimes|nullable|string|max:10',
        ];

        $validated = Validator::check($data, $rules);

        // `phone_verified_code` is consumed by the service, never persisted here.
        unset($validated['phone_verified_code']);

        return $validated;
    }

    /**
     * @param array<string,mixed> $data
     * @return array<string,mixed>
     */
    public static function addressCreate(array $data): array
    {
        return Validator::check($data, [
            'label' => 'nullable|safe_text|string|max:60',
            'recipient_name' => 'required|safe_text|string|min:2|max:150',
            'phone' => 'required|phone|max:32',
            'city_id' => 'required|integer|min:1',
            'district' => 'nullable|safe_text|string|max:100',
            'street_address' => 'required|safe_text|string|min:3|max:255',
            'postal_code' => 'nullable|safe_text|string|max:24',
            'delivery_instructions' => 'nullable|safe_text|string|max:500',
            'is_default' => 'sometimes|boolean',
        ]);
    }

    /**
     * @param array<string,mixed> $data
     * @return array<string,mixed>
     */
    public static function addressUpdate(array $data): array
    {
        return Validator::check($data, [
            'label' => 'sometimes|nullable|safe_text|string|max:60',
            'recipient_name' => 'sometimes|required|safe_text|string|min:2|max:150',
            'phone' => 'sometimes|required|phone|max:32',
            'city_id' => 'sometimes|required|integer|min:1',
            'district' => 'sometimes|nullable|safe_text|string|max:100',
            'street_address' => 'sometimes|required|safe_text|string|min:3|max:255',
            'postal_code' => 'sometimes|nullable|safe_text|string|max:24',
            'delivery_instructions' => 'sometimes|nullable|safe_text|string|max:500',
            'is_default' => 'sometimes|boolean',
        ]);
    }
}
