<?php

declare(strict_types=1);

namespace Shopio\Services;

use Shopio\Auth\AuthenticatedUser;
use Shopio\Database\Database;
use Shopio\Exceptions\ConflictException;
use Shopio\Exceptions\NotFoundException;
use Shopio\Http\Request;
use Shopio\Repositories\OrderRepository;
use Shopio\Repositories\PayoutRepository;
use Shopio\Repositories\SellerRepository;
use Shopio\Support\Money;
use Shopio\Support\Presenter;

/**
 * Seller payouts.
 *
 * A payout is created from the seller's delivered, paid, not-yet-paid items.
 * Those items are locked `FOR UPDATE` and the resulting net amounts are
 * snapshotted into `payout_items`, so an item can never be paid out twice even
 * if two requests race.
 */
final class PayoutService
{
    public function __construct(
        private readonly Database $db,
        private readonly PayoutRepository $payouts,
        private readonly OrderRepository $orders,
        private readonly SellerRepository $sellers,
        private readonly NotificationService $notifications,
        private readonly AuditService $audit,
    ) {
    }

    /**
     * @return array<string,mixed>
     */
    public function summary(AuthenticatedUser $auth): array
    {
        $sellerId = $this->sellerId($auth);
        $earnings = $this->orders->sellerEarningsSummary($sellerId);

        return [
            'earnedNet' => $earnings['earned_net'],
            'commissionTotal' => $earnings['commission_total'],
            'availableForPayout' => $earnings['available_for_payout'],
            'unitsSold' => $earnings['units_sold'],
            'requestedTotal' => $this->payouts->requestedTotal($sellerId),
            'paidTotal' => $this->payouts->paidTotal($sellerId),
            'recent' => array_map([Presenter::class, 'payout'], $this->payouts->recentForSeller($sellerId, 5)),
        ];
    }

    /**
     * @param array<string,mixed> $data
     * @return array<string,mixed>
     */
    public function request(AuthenticatedUser $auth, array $data, Request $request): array
    {
        $sellerId = $this->sellerId($auth);

        $payoutId = $this->db->transaction(function () use ($sellerId, $data): int {
            $items = $this->orders->lockPayoutEligibleItems($sellerId);
            if ($items === []) {
                throw new ConflictException('There are no settled earnings available for payout.');
            }

            $total = '0.00';
            $breakdown = [];
            foreach ($items as $item) {
                $gross = Money::sub(Money::mul((string) $item['unit_price'], (int) $item['quantity']), (string) $item['discount_amount']);
                $commission = Money::percent($gross, (string) $item['seller_commission_rate']);
                $net = Money::sub($gross, $commission);

                if (Money::compare($net, '0') <= 0) {
                    continue;
                }

                $total = Money::add($total, $net);
                $breakdown[] = ['order_item_id' => (int) $item['order_item_id'], 'amount' => $net];
            }

            if (Money::isZero($total)) {
                throw new ConflictException('There are no settled earnings available for payout.');
            }

            $currency = \Shopio\Config\Config::get('DEFAULT_CURRENCY', 'TZS') ?? 'TZS';

            $payoutId = $this->payouts->create(
                $sellerId,
                $this->payouts->generateReference(),
                $total,
                $currency,
                $data['payout_method'] ?? null,
                $data['destination_label'] ?? null,
            );

            foreach ($breakdown as $entry) {
                $this->payouts->addItem($payoutId, $entry['order_item_id'], $entry['amount']);
            }

            return $payoutId;
        });

        $this->audit->record($auth, 'payout.requested', 'payout', $payoutId, $request);
        $this->notifications->notify($auth->id, 'payout', 'Payout requested', 'Your payout request has been received and is being reviewed.', '/seller/payouts');

        return Presenter::payout($this->payouts->findById($payoutId) ?? []);
    }

    /**
     * @return array{items:list<array<string,mixed>>,total:int}
     */
    public function listForSeller(AuthenticatedUser $auth, int $page, int $perPage): array
    {
        $result = $this->payouts->paginateForSeller($this->sellerId($auth), $page, $perPage);

        return ['items' => array_map([Presenter::class, 'payout'], $result['rows']), 'total' => $result['total']];
    }

    /**
     * @return array{items:list<array<string,mixed>>,total:int}
     */
    public function listForAdmin(array $filters, int $page, int $perPage): array
    {
        $result = $this->payouts->paginateForAdmin($filters, $page, $perPage);

        return ['items' => array_map([Presenter::class, 'payout'], $result['rows']), 'total' => $result['total']];
    }

    /**
     * @param array<string,mixed> $data
     * @return array<string,mixed>
     */
    public function decide(AuthenticatedUser $auth, int $payoutId, array $data, Request $request): array
    {
        $payout = $this->db->transaction(function () use ($auth, $payoutId, $data): array {
            $payout = $this->payouts->lockById($payoutId);
            if ($payout === null) {
                throw new NotFoundException('The requested payout does not exist.');
            }

            if (!in_array($payout['status'], ['requested', 'pending', 'processing'], true)) {
                throw new ConflictException('This payout has already been finalised.');
            }

            $target = (string) $data['status'];
            if (!in_array($target, ['processing', 'paid', 'rejected', 'failed'], true)) {
                throw new ConflictException('Unsupported payout decision.');
            }

            $this->payouts->updateStatus($payoutId, $target, $auth->id, $data['provider_reference'] ?? null, $data['admin_note'] ?? null);

            return $this->payouts->findById($payoutId) ?? $payout;
        });

        $this->audit->record($auth, 'payout.decided', 'payout', $payoutId, $request, ['status' => $data['status']]);

        $owner = $this->sellers->findById((int) $payout['seller_id']);
        if ($owner !== null && isset($owner['user_id'])) {
            $this->notifications->notify(
                (int) $owner['user_id'],
                'payout',
                'Payout ' . (string) $data['status'],
                'Your payout request ' . $payout['payout_reference'] . ' is now ' . (string) $data['status'] . '.',
                '/seller/payouts',
            );
        }

        return Presenter::payout($payout);
    }

    private function sellerId(AuthenticatedUser $auth): int
    {
        if ($auth->sellerId === null) {
            throw new NotFoundException('No store is associated with this account.');
        }

        return $auth->sellerId;
    }
}
