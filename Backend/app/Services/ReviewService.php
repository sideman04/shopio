<?php

declare(strict_types=1);

namespace Shopio\Services;

use Shopio\Auth\AuthenticatedUser;
use Shopio\Config\Config;
use Shopio\Exceptions\ConflictException;
use Shopio\Exceptions\NotFoundException;
use Shopio\Http\Request;
use Shopio\Repositories\ProductRepository;
use Shopio\Repositories\ReviewRepository;
use Shopio\Support\Presenter;

/**
 * Product reviews owned by customers and answered by sellers.
 */
final class ReviewService
{
    public function __construct(
        private readonly ReviewRepository $reviews,
        private readonly ProductRepository $products,
        private readonly AuditService $audit,
    ) {
    }

    /**
     * @return array{eligible:bool,order_item_id:?int}
     */
    public function eligibility(AuthenticatedUser $auth, int $productId): array
    {
        $eligible = $this->reviews->eligibleOrderItem($auth->id, $productId);

        return [
            'eligible' => $eligible !== null,
            'order_item_id' => $eligible === null ? null : (int) $eligible['order_item_id'],
        ];
    }

    /**
     * @param array<string,mixed> $data
     * @return array<string,mixed>
     */
    public function create(AuthenticatedUser $auth, int $productId, array $data, Request $request): array
    {
        if ($this->products->findPublicById($productId) === null) {
            throw new NotFoundException('The requested product does not exist.');
        }

        $orderItemId = isset($data['order_item_id']) ? (int) $data['order_item_id'] : null;
        $eligible = $this->reviews->eligibleOrderItem($auth->id, $productId);

        if ($eligible === null) {
            throw new ConflictException('You can only review products you have purchased and received.');
        }

        if ($orderItemId !== null && $orderItemId !== (int) $eligible['order_item_id']) {
            throw new ConflictException('This order item is not eligible for review.');
        }

        $orderItemId = (int) $eligible['order_item_id'];

        if ($this->reviews->existsForOrderItem($orderItemId, $auth->id)) {
            throw new ConflictException('You have already reviewed this purchase.');
        }

        $status = Config::bool('REVIEWS_AUTO_PUBLISH', false) ? 'published' : 'pending';

        $reviewId = $this->reviews->create(
            $productId,
            $auth->id,
            $orderItemId,
            (int) $data['rating'],
            $data['title'] ?? null,
            $data['review_text'] ?? null,
            $status,
        );

        $this->audit->record($auth, 'review.created', 'review', $reviewId, $request);

        return Presenter::review($this->reviews->findById($reviewId) ?? [], true);
    }

    public function report(AuthenticatedUser $auth, int $reviewId, array $data, Request $request): void
    {
        if ($this->reviews->findById($reviewId) === null) {
            throw new NotFoundException('The requested review does not exist.');
        }

        $reportId = $this->reviews->addReport($reviewId, $auth->id, (string) $data['reason']);
        $this->audit->record($auth, 'review.reported', 'review_report', $reportId, $request);
    }

    /**
     * @return array{items:list<array<string,mixed>>,total:int}
     */
    public function listForSeller(AuthenticatedUser $auth, array $filters, int $page, int $perPage): array
    {
        $sellerId = $this->requireSeller($auth);
        $result = $this->reviews->paginateForSeller($sellerId, $filters, $page, $perPage);

        return ['items' => array_map(static fn (array $row): array => Presenter::review($row, true), $result['rows']), 'total' => $result['total']];
    }

    public function replyAsSeller(AuthenticatedUser $auth, int $reviewId, array $data, Request $request): array
    {
        $sellerId = $this->requireSeller($auth);
        $review = $this->reviews->findById($reviewId);

        if ($review === null || (int) ($review['seller_id'] ?? 0) !== $sellerId) {
            throw new NotFoundException('The requested review does not exist.');
        }

        $this->reviews->sellerReply($reviewId, (string) $data['reply']);
        $this->audit->record($auth, 'review.replied', 'review', $reviewId, $request);

        return Presenter::review($this->reviews->findById($reviewId) ?? [], true);
    }

    private function requireSeller(AuthenticatedUser $auth): int
    {
        if ($auth->sellerId === null) {
            throw new NotFoundException('No store is associated with this account.');
        }

        return $auth->sellerId;
    }
}
