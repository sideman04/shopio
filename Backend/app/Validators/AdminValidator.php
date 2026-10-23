<?php

declare(strict_types=1);

namespace Shopio\Validators;

use Shopio\Exceptions\ValidationException;

/**
 * Administrator request validators.
 *
 * Every status field is constrained to the enum values actually defined in the
 * schema, so an invalid transition can never be smuggled in as a status string.
 */
final class AdminValidator
{
    /**
     * @param array<string,mixed> $data
     * @return array<string,mixed>
     */
    public static function userStatus(array $data): array
    {
        return Validator::check($data, [
            'status' => 'required|in:pending,active,suspended,disabled',
            'reason' => 'nullable|safe_text|string|max:500',
        ]);
    }

    /**
     * @param array<string,mixed> $data
     * @return array<string,mixed>
     */
    public static function userRoles(array $data): array
    {
        return Validator::check($data, [
            'roles' => 'required|list_of:string|min:1|max:3',
        ]);
    }

    /**
     * @param array<string,mixed> $data
     * @return array<string,mixed>
     */
    public static function sellerVerification(array $data): array
    {
        return Validator::check($data, [
            'verification_status' => 'sometimes|in:not_submitted,pending,approved,rejected',
            'status' => 'sometimes|in:active,paused,suspended,closed',
            'notes' => 'sometimes|nullable|safe_text|string|max:2000',
            'commission_rate' => 'sometimes|decimal|min:0|max:100',
        ]);
    }

    /**
     * @param array<string,mixed> $data
     * @return array<string,mixed>
     */
    public static function productModeration(array $data): array
    {
        $validated = Validator::check($data, [
            'status' => 'sometimes|in:draft,pending_review,active,rejected,archived',
            'rejection_reason' => 'nullable|safe_text|string|max:2000',
            'name' => 'sometimes|required|safe_text|string|min:3|max:200',
            'brand' => 'sometimes|nullable|safe_text|string|max:120',
            'category_id' => 'sometimes|nullable|integer|min:1',
            'price' => 'sometimes|decimal|min:0.01|max:99999999999',
        ]);

        if (array_intersect(array_keys($validated), ['status', 'name', 'brand', 'category_id', 'price']) === []) {
            throw new ValidationException(['product' => ['Provide a status or product field to update.']]);
        }

        return $validated;
    }

    /**
     * @param array<string,mixed> $data
     * @return array<string,mixed>
     */
    public static function orderStatus(array $data): array
    {
        return Validator::check($data, [
            'status' => 'sometimes|in:pending,confirmed,processing,partially_shipped,shipped,delivered,cancelled,refunded',
            'payment_status' => 'sometimes|in:unpaid,pending,paid,partially_refunded,refunded,failed',
            'fulfillment_status' => 'sometimes|in:unfulfilled,partial,fulfilled,returned',
            'note' => 'nullable|safe_text|string|max:500',
        ]);
    }

    /**
     * @param array<string,mixed> $data
     * @return array<string,mixed>
     */
    public static function refundDecision(array $data): array
    {
        return Validator::check($data, [
            'status' => 'required|in:approved,rejected,processing,succeeded,failed',
            'amount' => 'sometimes|nullable|decimal|min:0.01|max:99999999999',
            'note' => 'nullable|safe_text|string|max:500',
            'provider_reference' => 'nullable|safe_text|string|max:190',
        ]);
    }

    /**
     * @param array<string,mixed> $data
     * @return array<string,mixed>
     */
    public static function payoutDecision(array $data): array
    {
        return Validator::check($data, [
            'status' => 'required|in:requested,pending,processing,paid,rejected,failed',
            'admin_note' => 'nullable|safe_text|string|max:500',
            'provider_reference' => 'nullable|safe_text|string|max:190',
        ]);
    }

    /**
     * @param array<string,mixed> $data
     * @return array<string,mixed>
     */
    public static function categoryCreate(array $data): array
    {
        return Validator::check($data, [
            'name' => 'required|safe_text|string|min:2|max:120',
            'slug' => 'sometimes|slug|max:150',
            'parent_id' => 'nullable|integer|min:1',
            'description' => 'nullable|safe_text|string|max:5000',
            'image_url' => 'nullable|url|max:2048',
            'sort_order' => 'sometimes|integer|min:0|max:100000',
            'status' => 'sometimes|in:active,inactive',
        ]);
    }

    /**
     * @param array<string,mixed> $data
     * @return array<string,mixed>
     */
    public static function categoryUpdate(array $data): array
    {
        return Validator::check($data, [
            'name' => 'sometimes|required|safe_text|string|min:2|max:120',
            'slug' => 'sometimes|slug|max:150',
            'parent_id' => 'sometimes|nullable|integer|min:1',
            'description' => 'sometimes|nullable|safe_text|string|max:5000',
            'image_url' => 'sometimes|nullable|url|max:2048',
            'sort_order' => 'sometimes|integer|min:0|max:100000',
            'status' => 'sometimes|in:active,inactive',
        ]);
    }

    /**
     * @param array<string,mixed> $data
     * @return array<string,mixed>
     */
    public static function couponCreate(array $data): array
    {
        $validated = Validator::check($data, [
            'code' => 'required|safe_text|string|min:3|max:60',
            'description' => 'nullable|safe_text|string|max:255',
            'discount_type' => 'required|in:percentage,fixed',
            'discount_value' => 'required|decimal|min:0.01|max:99999999999',
            'minimum_order_amount' => 'sometimes|decimal|min:0|max:99999999999',
            'maximum_discount_amount' => 'nullable|decimal|min:0|max:99999999999',
            'usage_limit' => 'nullable|integer|min:1|max:1000000',
            'per_user_limit' => 'nullable|integer|min:1|max:1000',
            'starts_at' => 'nullable|date',
            'expires_at' => 'nullable|date',
            'status' => 'sometimes|in:active,inactive,expired',
        ]);

        if (($validated['discount_type'] ?? null) === 'percentage' && (float) $validated['discount_value'] > 100) {
            throw new ValidationException(['discount_value' => ['A percentage discount cannot exceed 100.']]);
        }

        if (!empty($validated['starts_at']) && !empty($validated['expires_at'])
            && strtotime((string) $validated['expires_at']) <= strtotime((string) $validated['starts_at'])) {
            throw new ValidationException(['expires_at' => ['Must be after the start date.']]);
        }

        return $validated;
    }

    /**
     * @param array<string,mixed> $data
     * @return array<string,mixed>
     */
    public static function couponUpdate(array $data): array
    {
        $validated = Validator::check($data, [
            'description' => 'sometimes|nullable|safe_text|string|max:255',
            'discount_type' => 'sometimes|in:percentage,fixed',
            'discount_value' => 'sometimes|decimal|min:0.01|max:99999999999',
            'minimum_order_amount' => 'sometimes|decimal|min:0|max:99999999999',
            'maximum_discount_amount' => 'sometimes|nullable|decimal|min:0|max:99999999999',
            'usage_limit' => 'sometimes|nullable|integer|min:1|max:1000000',
            'per_user_limit' => 'sometimes|nullable|integer|min:1|max:1000',
            'starts_at' => 'sometimes|nullable|date',
            'expires_at' => 'sometimes|nullable|date',
            'status' => 'sometimes|in:active,inactive,expired',
        ]);

        if (($validated['discount_type'] ?? null) === 'percentage' && (float) ($validated['discount_value'] ?? 0) > 100) {
            throw new ValidationException(['discount_value' => ['A percentage discount cannot exceed 100.']]);
        }

        return $validated;
    }

    /**
     * @param array<string,mixed> $data
     * @return array<string,mixed>
     */
    public static function bannerCreate(array $data): array
    {
        return Validator::check($data, [
            'title' => 'required|safe_text|string|min:2|max:180',
            'subtitle' => 'nullable|safe_text|string|max:255',
            'image_url' => 'nullable|url|max:2048',
            'button_text' => 'nullable|safe_text|string|max:60',
            'target_url' => 'nullable|url_or_path|max:2048',
            'placement' => 'sometimes|in:home_hero,home_promo,category,other',
            'starts_at' => 'nullable|date',
            'ends_at' => 'nullable|date',
            'sort_order' => 'sometimes|integer|min:0|max:100000',
            'status' => 'sometimes|in:draft,active,inactive',
        ]);
    }

    /**
     * @param array<string,mixed> $data
     * @return array<string,mixed>
     */
    public static function bannerUpdate(array $data): array
    {
        return Validator::check($data, [
            'title' => 'sometimes|required|safe_text|string|min:2|max:180',
            'subtitle' => 'sometimes|nullable|safe_text|string|max:255',
            'image_url' => 'sometimes|nullable|url|max:2048',
            'button_text' => 'sometimes|nullable|safe_text|string|max:60',
            'target_url' => 'sometimes|nullable|url_or_path|max:2048',
            'placement' => 'sometimes|in:home_hero,home_promo,category,other',
            'starts_at' => 'sometimes|nullable|date',
            'ends_at' => 'sometimes|nullable|date',
            'sort_order' => 'sometimes|integer|min:0|max:100000',
            'status' => 'sometimes|in:draft,active,inactive',
        ]);
    }

    /**
     * Settings are a JSON key/value bag. Keys are validated by pattern and
     * values restricted to scalars/arrays to keep the JSON column well-formed.
     *
     * @param array<string,mixed> $data
     * @return array<string,mixed>
     */
    public static function settings(array $data): array
    {
        $validated = Validator::check($data, [
            'settings' => 'required|array|min:1|max:100',
        ]);

        $clean = [];
        foreach ($validated['settings'] as $key => $value) {
            if (preg_match('/^[a-z0-9_.]{2,120}$/', (string) $key) !== 1) {
                throw new ValidationException(['settings' => ["Invalid setting key: {$key}."]]);
            }

            if (!is_scalar($value) && $value !== null && !is_array($value)) {
                throw new ValidationException(['settings' => ["Setting '{$key}' must be a scalar or array."]]);
            }

            if (is_string($value) && mb_strlen($value) > 5000) {
                throw new ValidationException(['settings' => ["Setting '{$key}' is too long."]]);
            }

            $clean[(string) $key] = $value;
        }

        return ['settings' => $clean];
    }

    /**
     * @param array<string,mixed> $data
     * @return array<string,mixed>
     */
    public static function reviewModeration(array $data): array
    {
        return Validator::check($data, [
            'status' => 'required|in:pending,published,hidden,rejected',
            'note' => 'nullable|safe_text|string|max:500',
        ]);
    }

    /**
     * @param array<string,mixed> $data
     * @return array<string,mixed>
     */
    public static function reportResolve(array $data): array
    {
        return Validator::check($data, [
            'status' => 'required|in:open,reviewing,dismissed,action_taken',
        ]);
    }

    /**
     * @param array<string,mixed> $data
     * @return array<string,mixed>
     */
    public static function supportStatus(array $data): array
    {
        return Validator::check($data, [
            'status' => 'required|in:new,in_progress,resolved,closed',
            'assigned_to' => 'nullable|integer|min:1',
        ]);
    }
}
