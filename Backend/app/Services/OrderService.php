<?php

declare(strict_types=1);

namespace Shopio\Services;

use Shopio\Auth\AuthenticatedUser;
use Shopio\Config\Config;
use Shopio\Database\Database;
use Shopio\Exceptions\ConflictException;
use Shopio\Exceptions\NotFoundException;
use Shopio\Http\Request;
use Shopio\Repositories\InventoryRepository;
use Shopio\Repositories\OrderRepository;
use Shopio\Repositories\ShipmentRepository;
use Shopio\Services\Mail\MailService;
use Shopio\Support\Presenter;

/**
 * Order reads and status transitions.
 *
 * The order status machine is defined here (single source of truth) so that
 * customer, seller and admin pathways all obey the same rules.
 */
final class OrderService
{
    /** Allowed forward transitions for the order-level status. */
    private const TRANSITIONS = [
        'pending' => ['confirmed', 'cancelled'],
        'confirmed' => ['processing', 'shipped', 'partially_shipped', 'cancelled'],
        'processing' => ['shipped', 'partially_shipped', 'cancelled'],
        'partially_shipped' => ['shipped', 'delivered'],
        'shipped' => ['delivered'],
        'delivered' => ['refunded'],
        'cancelled' => [],
        'refunded' => [],
    ];

    private const FULFILLMENT_TRANSITIONS = [
        'unfulfilled' => ['processing', 'shipped', 'cancelled'],
        'processing' => ['shipped', 'cancelled'],
        'shipped' => ['delivered'],
        'delivered' => ['returned'],
        'cancelled' => [],
        'returned' => [],
    ];

    public function __construct(
        private readonly Database $db,
        private readonly OrderRepository $orders,
        private readonly InventoryRepository $inventory,
        private readonly ShipmentRepository $shipments,
        private readonly MailService $mail,
        private readonly AuditService $audit,
    ) {
    }

    /**
     * @return array{items:list<array<string,mixed>>,total:int}
     */
    public function listForUser(AuthenticatedUser $auth, array $filters, int $page, int $perPage): array
    {
        $result = $this->orders->paginateForUser($auth->id, $filters, $page, $perPage);

        return [
            'items' => array_map(static fn (array $row): array => Presenter::orderSummary($row), $result['rows']),
            'total' => $result['total'],
        ];
    }

    /**
     * @return array{items:list<array<string,mixed>>,total:int}
     */
    public function listForSeller(AuthenticatedUser $auth, array $filters, int $page, int $perPage): array
    {
        $result = $this->orders->paginateForSeller($this->sellerId($auth), $filters, $page, $perPage);

        return [
            'items' => array_map(static function (array $row): array {
                $summary = Presenter::orderSummary($row);
                $summary['sellerSubtotal'] = (string) ($row['seller_subtotal'] ?? '0.00');
                $summary['sellerItemCount'] = (int) ($row['seller_item_count'] ?? 0);

                return $summary;
            }, $result['rows']),
            'total' => $result['total'],
        ];
    }

    /**
     * @return array{items:list<array<string,mixed>>,total:int}
     */
    public function listForAdmin(array $filters, int $page, int $perPage): array
    {
        $result = $this->orders->paginateForAdmin($filters, $page, $perPage);

        return [
            'items' => array_map(static fn (array $row): array => Presenter::orderSummary($row, true), $result['rows']),
            'total' => $result['total'],
        ];
    }

    /**
     * @return array<string,mixed>
     */
    public function detailForUser(AuthenticatedUser $auth, int $orderId): array
    {
        $order = $this->orders->findByIdForUser($orderId, $auth->id);
        if ($order === null) {
            throw new NotFoundException('The requested order does not exist.');
        }

        return $this->present($order);
    }

    /**
     * @return array<string,mixed>
     */
    public function detailForSeller(AuthenticatedUser $auth, int $orderId): array
    {
        $order = $this->orders->findForSeller($orderId, $this->sellerId($auth));
        if ($order === null) {
            throw new NotFoundException('The requested order does not exist.');
        }

        $presented = $this->present($order, items: $this->orders->itemsForSeller($orderId, $this->sellerId($auth)));
        $presented['shipments'] = $this->shipments->forOrder($orderId);

        return $presented;
    }

    /**
     * @return array<string,mixed>
     */
    public function detailForAdmin(int $orderId): array
    {
        $order = $this->orders->findById($orderId);
        if ($order === null) {
            throw new NotFoundException('The requested order does not exist.');
        }

        $presented = $this->present($order);
        $presented['payments'] = array_map([Presenter::class, 'payment'], $this->paymentsFor($orderId));
        $presented['shipments'] = $this->shipments->forOrder($orderId);

        return $presented;
    }

    /**
     * @param list<array<string,mixed>>|null $items
     * @return array<string,mixed>
     */
    public function present(array $order, ?array $items = null, array $extra = []): array
    {
        $orderId = (int) $order['id'];

        return Presenter::order(
            $order,
            $items ?? $this->orders->items($orderId),
            $this->orders->adjustments($orderId),
            $this->orders->history($orderId),
            $this->orders->totals($orderId),
        ) + $extra;
    }

    public function cancelByCustomer(AuthenticatedUser $auth, int $orderId, ?string $reason, Request $request): array
    {
        return $this->db->transaction(function () use ($auth, $orderId, $reason, $request): array {
            $order = $this->orders->lockById($orderId);
            if ($order === null || (int) $order['user_id'] !== $auth->id) {
                throw new NotFoundException('The requested order does not exist.');
            }

            $this->assertTransition((string) $order['status'], 'cancelled');

            $this->releaseHolds($orderId);
            $this->orders->markCancelled($orderId);
            $this->orders->addHistory($orderId, $auth->id, (string) $order['status'], 'cancelled', $reason);

            $this->audit->record($auth, 'order.cancelled', 'order', $orderId, $request, ['reason' => $reason]);

            return $this->present($this->orders->findById($orderId) ?? $order);
        });
    }

    /**
     * @param array<string,mixed> $data
     */
    public function updateStatusByAdmin(AuthenticatedUser $auth, int $orderId, array $data, Request $request): array
    {
        return $this->db->transaction(function () use ($auth, $orderId, $data, $request): array {
            $order = $this->orders->lockById($orderId);
            if ($order === null) {
                throw new NotFoundException('The requested order does not exist.');
            }

            if (isset($data['payment_status'])) {
                $this->orders->setPaymentStatus($orderId, (string) $data['payment_status']);
                $this->audit->record($auth, 'order.payment_status_changed', 'order', $orderId, $request, [
                    'payment_status' => $data['payment_status'],
                ]);
            }

            if (isset($data['status'])) {
                $target = (string) $data['status'];
                $this->assertTransition((string) $order['status'], $target);

                if ($target === 'cancelled') {
                    $this->releaseHolds($orderId);
                }
                if ($target === 'delivered') {
                    $this->orders->markDelivered($orderId);
                } elseif ($target === 'confirmed') {
                    $this->orders->markConfirmed($orderId);
                } elseif ($target === 'cancelled') {
                    $this->orders->markCancelled($orderId);
                } else {
                    $this->orders->setStatus($orderId, $target);
                }

                $this->orders->addHistory($orderId, $auth->id, (string) $order['status'], $target, $data['note'] ?? null);
                $this->audit->record($auth, 'order.status_changed', 'order', $orderId, $request, ['status' => $target]);

                if (!empty($order['customer_email'])) {
                    $this->mail->sendOrderStatusChanged((string) $order['customer_email'], (string) $order['customer_name'], (string) $order['order_number'], $target);
                }
            }

            return $this->present($this->orders->findById($orderId) ?? $order);
        });
    }

    /**
     * Seller advances the fulfillment status of one of their items.
     *
     * @param array<string,mixed> $data
     */
    public function updateItemFulfillment(AuthenticatedUser $auth, int $orderId, int $itemId, array $data, Request $request): array
    {
        $sellerId = $this->sellerId($auth);

        return $this->db->transaction(function () use ($auth, $orderId, $itemId, $sellerId, $data, $request): array {
            $order = $this->orders->findForSeller($orderId, $sellerId);
            if ($order === null) {
                throw new NotFoundException('The requested order does not exist.');
            }

            $item = $this->orders->itemByIdForSeller($itemId, $sellerId);
            if ($item === null) {
                throw new NotFoundException('The requested order item does not exist.');
            }

            $target = (string) $data['status'];
            $current = (string) $item['fulfillment_status'];
            $allowed = self::FULFILLMENT_TRANSITIONS[$current] ?? [];
            if (!in_array($target, $allowed, true)) {
                throw new ConflictException('This fulfillment transition is not permitted.');
            }

            $this->orders->setItemFulfillmentForSeller($itemId, $sellerId, $target);
            $this->synchroniseOrderFulfillment($orderId, $target);
            $this->orders->addHistory($orderId, $auth->id, null, (string) $order['status'], 'Item #' . $itemId . ' -> ' . $target);
            $this->audit->record($auth, 'order.item_fulfillment', 'order_item', $itemId, $request, ['status' => $target]);

            return $this->present($this->orders->findById($orderId) ?? $order, items: $this->orders->itemsForSeller($orderId, $sellerId));
        });
    }

    public function sellerId(AuthenticatedUser $auth): int
    {
        if ($auth->sellerId === null) {
            throw new NotFoundException('No store is associated with this account.');
        }

        return $auth->sellerId;
    }

    /**
     * Releases every held reservation for an order (used on cancellation).
     */
    public function releaseHolds(int $orderId): void
    {
        foreach ($this->inventory->heldReservationsForOrder($orderId) as $reservation) {
            $this->inventory->release((int) $reservation['variant_id'], (int) $reservation['quantity']);
            $this->inventory->markReservation((int) $reservation['id'], 'released');
        }
    }

    /**
     * Settles every held reservation for an order (used on payment success).
     */
    public function settleHolds(int $orderId, ?int $actorId = null): void
    {
        foreach ($this->inventory->heldReservationsForOrder($orderId) as $reservation) {
            $this->inventory->settleHold((int) $reservation['variant_id'], (int) $reservation['quantity'], $orderId, $actorId);
            $this->inventory->markReservation((int) $reservation['id'], 'consumed');
        }
    }

    public function assertTransition(string $from, string $to): void
    {
        if ($from === $to) {
            return;
        }

        $allowed = self::TRANSITIONS[$from] ?? [];
        if (!in_array($to, $allowed, true)) {
            throw new ConflictException('This order status transition is not permitted.');
        }
    }

    /**
     * @return list<array<string,mixed>>
     */
    private function paymentsFor(int $orderId): array
    {
        $sql = 'SELECT pay.*, o.order_number FROM payments pay
                JOIN orders o ON o.id = pay.order_id
                WHERE pay.order_id = :order_id ORDER BY pay.id ASC';

        return $this->db->select($sql, ['order_id' => $orderId]);
    }

    private function synchroniseOrderFulfillment(int $orderId, string $lastStatus): void
    {
        $counts = $this->db->selectOne(
            "SELECT COUNT(*) AS total,
                    SUM(CASE WHEN fulfillment_status = 'delivered' THEN 1 ELSE 0 END) AS delivered,
                    SUM(CASE WHEN fulfillment_status = 'shipped' THEN 1 ELSE 0 END) AS shipped
             FROM order_items WHERE order_id = :order_id",
            ['order_id' => $orderId],
        );

        $total = (int) ($counts['total'] ?? 0);
        $delivered = (int) ($counts['delivered'] ?? 0);
        $shipped = (int) ($counts['shipped'] ?? 0);

        if ($total > 0 && $delivered === $total) {
            $this->orders->markDelivered($orderId);
        } elseif ($shipped > 0) {
            $this->orders->setFulfillmentStatus($orderId, $shipped === $total ? 'fulfilled' : 'partial');
            $this->orders->setStatus($orderId, $shipped === $total ? 'shipped' : 'partially_shipped');
        } else {
            $this->orders->setFulfillmentStatus($orderId, $lastStatus === 'processing' ? 'partial' : 'unfulfilled');
        }
    }
}
