<?php

declare(strict_types=1);

namespace Shopio\Validators;

use Shopio\Exceptions\ValidationException;

/**
 * Seller catalogue validators: products, variants, images, options, inventory.
 */
final class CatalogValidator
{
    use ValidatesNested;

    /**
     * @param array<string,mixed> $data
     * @return array<string,mixed>
     */
    public static function productCreate(array $data): array
    {
        $validated = Validator::check($data, [
            'name' => 'required|safe_text|string|min:3|max:200',
            'slug' => 'sometimes|slug|max:230',
            'category_id' => 'nullable|integer|min:1',
            'short_description' => 'nullable|safe_text|string|max:500',
            'description' => 'nullable|safe_text|string|max:20000',
            'brand' => 'nullable|safe_text|string|max:120',
            'condition_type' => 'sometimes|in:new,used,refurbished',
            'variants' => 'array|min:1|max:50',
            'images' => 'array|max:20',
        ]);

        if (array_key_exists('variants', $validated)) {
            $validated['variants'] = self::validateItems(
                $validated['variants'],
                self::variantItemRules(),
                50,
                'variants',
            );
        }

        if (array_key_exists('images', $validated)) {
            $validated['images'] = self::validateItems(
                $validated['images'],
                self::imageItemRules(),
                20,
                'images',
            );
        }

        return $validated;
    }

    /**
     * @param array<string,mixed> $data
     * @return array<string,mixed>
     */
    public static function productUpdate(array $data): array
    {
        return Validator::check($data, [
            'name' => 'sometimes|required|safe_text|string|min:3|max:200',
            'slug' => 'sometimes|slug|max:230',
            'category_id' => 'sometimes|nullable|integer|min:1',
            'short_description' => 'sometimes|nullable|safe_text|string|max:500',
            'description' => 'sometimes|nullable|safe_text|string|max:20000',
            'brand' => 'sometimes|nullable|safe_text|string|max:120',
            'condition_type' => 'sometimes|in:new,used,refurbished',
        ]);
    }

    /**
     * @return array<string,string>
     */
    private static function variantItemRules(): array
    {
        return [
            'sku' => 'required|sku|max:100',
            'variant_name' => 'sometimes|safe_text|string|max:150',
            'price' => 'required|decimal|min:0|max:99999999999',
            'compare_at_price' => 'nullable|decimal|min:0',
            'cost_price' => 'nullable|decimal|min:0',
            'weight_grams' => 'nullable|integer|min:0|max:100000000',
            'is_default' => 'sometimes|boolean',
            'is_active' => 'sometimes|boolean',
            'options' => 'sometimes|array|max:20',
        ];
    }

    /**
     * @return array<string,string>
     */
    private static function imageItemRules(): array
    {
        return [
            'image_url' => 'required|url|max:2048',
            'alt_text' => 'nullable|safe_text|string|max:255',
            'sort_order' => 'sometimes|integer|min:0|max:65535',
            'is_primary' => 'sometimes|boolean',
        ];
    }

    /**
     * @param array<string,mixed> $data
     * @return array<string,mixed>
     */
    public static function variantCreate(array $data): array
    {
        $validated = Validator::check($data, self::variantItemRules());
        $validated['options'] = self::validateOptionMap($data['options'] ?? []);

        return $validated;
    }

    /**
     * @param array<string,mixed> $data
     * @return array<string,mixed>
     */
    public static function variantUpdate(array $data): array
    {
        return Validator::check($data, [
            'variant_name' => 'sometimes|safe_text|string|max:150',
            'price' => 'sometimes|required|decimal|min:0|max:99999999999',
            'compare_at_price' => 'sometimes|nullable|decimal|min:0',
            'cost_price' => 'sometimes|nullable|decimal|min:0',
            'weight_grams' => 'sometimes|nullable|integer|min:0|max:100000000',
            'is_active' => 'sometimes|boolean',
            'is_default' => 'sometimes|boolean',
            'options' => 'sometimes|array|max:20',
        ]);
    }

    /**
     * @param array<string,mixed> $data
     * @return array<string,mixed>
     */
    public static function imageAttach(array $data): array
    {
        return Validator::check($data, [
            'image_url' => 'required|url|max:2048',
            'alt_text' => 'nullable|safe_text|string|max:255',
            'sort_order' => 'sometimes|integer|min:0|max:65535',
            'is_primary' => 'sometimes|boolean',
        ]);
    }

    /**
     * @param array<string,mixed> $data
     * @return array<string,mixed>
     */
    public static function imageUpdate(array $data): array
    {
        return Validator::check($data, [
            'alt_text' => 'sometimes|nullable|safe_text|string|max:255',
            'sort_order' => 'sometimes|integer|min:0|max:65535',
            'is_primary' => 'sometimes|boolean',
        ]);
    }

    /**
     * @param array<string,mixed> $data
     * @return array<string,mixed>
     */
    public static function optionTypes(array $data): array
    {
        $validated = Validator::check($data, [
            'option_types' => 'required|array|max:10',
        ]);

        $validated['option_types'] = self::validateItems(
            $validated['option_types'],
            [
                'name' => 'required|safe_text|string|min:1|max:60',
                'values' => 'required|array|min:1|max:50',
            ],
            10,
            'option_types',
        );

        foreach ($validated['option_types'] as $index => $type) {
            foreach ($type['values'] as $value) {
                if (!is_string($value) || trim($value) === '' || mb_strlen((string) $value) > 100) {
                    throw new ValidationException([
                        "option_types.{$index}.values" => ['Each value must be a non-empty string up to 100 characters.'],
                    ]);
                }
            }
        }

        return $validated;
    }

    /**
     * @param array<string,mixed> $data
     * @return array<string,mixed>
     */
    public static function inventoryAdjust(array $data): array
    {
        return Validator::check($data, [
            'variant_id' => 'required|integer|min:1',
            'movement_type' => 'required|in:restock,adjustment',
            'quantity' => 'required|integer|min:-1000000|max:1000000',
            'note' => 'nullable|safe_text|string|max:500',
            'low_stock_threshold' => 'sometimes|integer|min:0|max:1000000',
        ]);
    }

    /**
     * @param array<string,mixed> $data
     * @return array<string,mixed>
     */
    public static function inventoryThreshold(array $data): array
    {
        return Validator::check($data, [
            'variant_id' => 'required|integer|min:1',
            'low_stock_threshold' => 'required|integer|min:0|max:1000000',
        ]);
    }

    /**
     * @param array<string,mixed> $data
     * @return array<string,mixed>
     */
    public static function submitForReview(array $data): array
    {
        return Validator::check($data, [
            'note' => 'nullable|safe_text|string|max:500',
        ]);
    }

    /**
     * Validates an option name => value map (e.g. {"Color":"Black"}).
     *
     * @param mixed $options
     * @return array<string,string>
     */
    public static function validateOptionMap(mixed $options): array
    {
        if ($options === null || $options === [] || $options === '') {
            return [];
        }

        if (!is_array($options) || array_is_list($options)) {
            throw new ValidationException(['options' => ['Must be an object mapping option names to values.']]);
        }

        if (count($options) > 20) {
            throw new ValidationException(['options' => ['Must not contain more than 20 options.']]);
        }

        $clean = [];
        foreach ($options as $name => $value) {
            $name = trim((string) $name);
            $value = trim((string) $value);
            if ($name === '' || $value === '' || mb_strlen($name) > 60 || mb_strlen($value) > 100) {
                throw new ValidationException(['options' => ['Option names and values must be non-empty and reasonably short.']]);
            }
            $clean[$name] = $value;
        }

        return $clean;
    }
}
