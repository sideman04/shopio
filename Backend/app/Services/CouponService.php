<?php

declare(strict_types=1);

namespace Shopio\Services;

use Shopio\Exceptions\ValidationException;
use Shopio\Repositories\CouponRepository;
use Shopio\Support\Money;

/**
 * Coupon eligibility and discount computation.
 *
 * All checks are read-only here; usage limits are enforced transactionally at
 * checkout (the coupon row is locked) so two concurrent checkouts cannot exceed
 * a limited coupon.
 */
final class CouponService
{
    public function __construct(private readonly CouponRepository $coupons)
    {
    }

    /**
     * @return array{code:string,discount:string,free_shipping:bool}
     */
    public function preview(string $code, string $subtotal, ?int $userId): array
    {
        $coupon = $this->coupons->findByCode($code);
        if ($coupon === null) {
            throw new ValidationException(['code' => ['This coupon code is not valid.']]);
        }

        $this->assertUsable($coupon, $subtotal, $userId);

        return [
            'code' => (string) $coupon['code'],
            'discount' => $this->discountFor($coupon, $subtotal),
            'free_shipping' => false,
        ];
    }

    /**
     * @param array<string,mixed> $coupon
     */
    public function assertUsable(array $coupon, string $subtotal, ?int $userId, bool $lockUsage = false): void
    {
        if (($coupon['status'] ?? '') !== 'active') {
            throw new ValidationException(['code' => ['This coupon is no longer active.']]);
        }

        $now = time();
        if (!empty($coupon['starts_at']) && strtotime((string) $coupon['starts_at']) > $now) {
            throw new ValidationException(['code' => ['This coupon is not yet valid.']]);
        }

        if (!empty($coupon['expires_at']) && strtotime((string) $coupon['expires_at']) < $now) {
            throw new ValidationException(['code' => ['This coupon has expired.']]);
        }

        if (Money::compare($subtotal, (string) $coupon['minimum_order_amount']) < 0) {
            throw new ValidationException([
                'code' => ['This coupon requires a minimum order of ' . Money::format((string) $coupon['minimum_order_amount']) . '.'],
            ]);
        }

        $usageLimit = $coupon['usage_limit'];
        if ($usageLimit !== null && $this->coupons->usageCount((int) $coupon['id']) >= (int) $usageLimit) {
            throw new ValidationException(['code' => ['This coupon has reached its usage limit.']]);
        }

        $perUserLimit = $coupon['per_user_limit'];
        if ($userId !== null && $perUserLimit !== null
            && $this->coupons->userUsageCount((int) $coupon['id'], $userId) >= (int) $perUserLimit) {
            throw new ValidationException(['code' => ['You have already used this coupon the maximum number of times.']]);
        }
    }

    /**
     * @param array<string,mixed> $coupon
     */
    public function discountFor(array $coupon, string $subtotal): string
    {
        $discount = ($coupon['discount_type'] === 'percentage')
            ? Money::percent($subtotal, (string) $coupon['discount_value'])
            : Money::format((string) $coupon['discount_value']);

        if ($coupon['maximum_discount_amount'] !== null) {
            $discount = Money::min($discount, (string) $coupon['maximum_discount_amount']);
        }

        // A discount can never exceed the subtotal.
        return Money::min($discount, $subtotal);
    }
}
