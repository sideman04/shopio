<?php

declare(strict_types=1);

namespace Shopio\Repositories;

/**
 * Product reviews, seller replies and review reports.
 *
 * Purchase eligibility is established by the caller (delivered, paid order item)
 * and re-checked by the supplied `trg_review_before_insert` trigger, which
 * verifies the order item belongs to the reviewer and matches the product.
 */
final class ReviewRepository extends Repository
{
    public function create(
        int $productId,
        int $userId,
        ?int $orderItemId,
        int $rating,
        ?string $title,
        ?string $reviewText,
        string $status,
    ): int {
        $this->db->execute(
            'INSERT INTO product_reviews (product_id, user_id, order_item_id, rating, title, review_text, status)
             VALUES (:product_id, :user_id, :order_item_id, :rating, :title, :text, :status)',
            [
                'product_id' => $productId,
                'user_id' => $userId,
                'order_item_id' => $orderItemId,
                'rating' => $rating,
                'title' => $title,
                'text' => $reviewText,
                'status' => $status,
            ],
        );

        return $this->db->lastInsertId();
    }

    /**
     * @return array<string,mixed>|null
     */
    public function findById(int $id): ?array
    {
        return $this->db->selectOne(
            'SELECT r.*, u.full_name AS customer_name, p.name AS product_name, p.seller_id
             FROM product_reviews r
             JOIN users u ON u.id = r.user_id
             JOIN products p ON p.id = r.product_id
             WHERE r.id = :id LIMIT 1',
            ['id' => $id],
        );
    }

    public function existsForOrderItem(int $orderItemId, int $userId): bool
    {
        return $this->db->scalar(
            'SELECT 1 FROM product_reviews WHERE order_item_id = :order_item_id AND user_id = :user_id LIMIT 1',
            ['order_item_id' => $orderItemId, 'user_id' => $userId],
        ) !== null;
    }

    /**
     * Finds a delivered, paid order item the user bought for this product and
     * has not yet reviewed. Returns null when the user is not eligible.
     *
     * @return array<string,mixed>|null
     */
    public function eligibleOrderItem(int $userId, int $productId): ?array
    {
        return $this->db->selectOne(
            "SELECT oi.id AS order_item_id, oi.order_id, oi.variant_id, oi.fulfillment_status
             FROM order_items oi
             JOIN orders o ON o.id = oi.order_id
             JOIN product_variants v ON v.id = oi.variant_id
             WHERE oi.variant_id IS NOT NULL
               AND v.product_id = :product_id
               AND o.user_id = :user_id
               AND oi.fulfillment_status = 'delivered'
               AND o.payment_status IN ('paid', 'partially_refunded')
               AND o.status NOT IN ('cancelled', 'refunded')
               AND NOT EXISTS (
                     SELECT 1 FROM product_reviews pr
                     WHERE pr.order_item_id = oi.id AND pr.user_id = o.user_id
               )
             ORDER BY oi.id ASC
             LIMIT 1",
            ['product_id' => $productId, 'user_id' => $userId],
        );
    }

    /**
     * Reviews for a product as shown publicly (published only).
     *
     * @return array{rows:list<array<string,mixed>>,total:int}
     */
    public function paginatePublishedForProduct(int $productId, int $page, int $perPage, ?int $ratingFilter = null): array
    {
        $where = ["r.product_id = :product_id", "r.status = 'published'"];
        $params = ['product_id' => $productId];

        if ($ratingFilter !== null) {
            $where[] = 'r.rating = :rating';
            $params['rating'] = $ratingFilter;
        }

        $whereSql = implode(' AND ', $where);
        [$limit, $offset] = $this->window($page, $perPage);

        $total = (int) $this->db->scalar("SELECT COUNT(*) FROM product_reviews r WHERE {$whereSql}", $params);

        $rows = $this->db->select(
            "SELECT r.id, r.product_id, r.user_id, r.rating, r.title, r.review_text, r.status,
                    r.seller_reply, r.seller_replied_at, r.created_at,
                    CONCAT(SUBSTRING(u.full_name, 1, 1), REPEAT('*', GREATEST(LENGTH(u.full_name) - 1, 1))) AS customer_name
             FROM product_reviews r
             JOIN users u ON u.id = r.user_id
             WHERE {$whereSql}
             ORDER BY r.created_at DESC, r.id DESC
             LIMIT {$limit} OFFSET {$offset}",
            $params,
        );

        return ['rows' => $rows, 'total' => $total];
    }

    /**
     * @return array<string,array{count:int,average:float}> rating => stats
     */
    public function ratingBreakdown(int $productId): array
    {
        $rows = $this->db->select(
            "SELECT rating, COUNT(*) AS count FROM product_reviews
             WHERE product_id = :product_id AND status = 'published'
             GROUP BY rating",
            ['product_id' => $productId],
        );

        $breakdown = [];
        foreach ($rows as $row) {
            $breakdown[(string) $row['rating']] = ['count' => (int) $row['count'], 'average' => (float) $row['rating']];
        }

        return $breakdown;
    }

    /**
     * @return array{rows:list<array<string,mixed>>,total:int}
     */
    public function paginateForSeller(int $sellerId, array $filters, int $page, int $perPage): array
    {
        $where = ['p.seller_id = :seller_id'];
        $params = ['seller_id' => $sellerId];

        if (!empty($filters['status'])) {
            $where[] = 'r.status = :status';
            $params['status'] = (string) $filters['status'];
        }

        if (!empty($filters['rating'])) {
            $where[] = 'r.rating = :rating';
            $params['rating'] = (int) $filters['rating'];
        }

        $whereSql = implode(' AND ', $where);
        [$limit, $offset] = $this->window($page, $perPage);

        $total = (int) $this->db->scalar(
            "SELECT COUNT(*) FROM product_reviews r JOIN products p ON p.id = r.product_id WHERE {$whereSql}",
            $params,
        );

        $rows = $this->db->select(
            "SELECT r.id, r.product_id, r.rating, r.title, r.review_text, r.status, r.seller_reply,
                    r.seller_replied_at, r.created_at, p.name AS product_name, u.full_name AS customer_name
             FROM product_reviews r
             JOIN products p ON p.id = r.product_id
             JOIN users u ON u.id = r.user_id
             WHERE {$whereSql}
             ORDER BY r.created_at DESC, r.id DESC
             LIMIT {$limit} OFFSET {$offset}",
            $params,
        );

        return ['rows' => $rows, 'total' => $total];
    }

    /**
     * @return array{rows:list<array<string,mixed>>,total:int}
     */
    public function paginateForAdmin(array $filters, int $page, int $perPage): array
    {
        $where = ['1=1'];
        $params = [];

        if (!empty($filters['status'])) {
            $where[] = 'r.status = :status';
            $params['status'] = (string) $filters['status'];
        }

        if (!empty($filters['product_id'])) {
            $where[] = 'r.product_id = :product_id';
            $params['product_id'] = (int) $filters['product_id'];
        }

        if (!empty($filters['seller_id'])) {
            $where[] = 'p.seller_id = :seller_id';
            $params['seller_id'] = (int) $filters['seller_id'];
        }

        if (!empty($filters['reported'])) {
            $where[] = 'EXISTS (SELECT 1 FROM review_reports rr WHERE rr.review_id = r.id AND rr.status IN (\'open\',\'reviewing\'))';
        }

        if (!empty($filters['q'])) {
            $where[] = '(r.title LIKE :q ESCAPE \'\\\\\' OR r.review_text LIKE :q ESCAPE \'\\\\\')';
            $params['q'] = '%' . str_replace(['\\', '%', '_'], ['\\\\', '\\%', '\\_'], (string) $filters['q']) . '%';
        }

        $whereSql = implode(' AND ', $where);
        [$limit, $offset] = $this->window($page, $perPage);

        $total = (int) $this->db->scalar(
            "SELECT COUNT(*) FROM product_reviews r JOIN products p ON p.id = r.product_id WHERE {$whereSql}",
            $params,
        );

        $rows = $this->db->select(
            "SELECT r.id, r.product_id, r.user_id, r.rating, r.title, r.review_text, r.status,
                    r.seller_reply, r.created_at, r.moderated_at, p.name AS product_name, s.store_name AS seller_name,
                    u.full_name AS customer_name, u.email AS customer_email,
                    EXISTS (SELECT 1 FROM review_reports rr WHERE rr.review_id = r.id AND rr.status IN ('open','reviewing')) AS reported
             FROM product_reviews r
             JOIN products p ON p.id = r.product_id
             JOIN seller_profiles s ON s.id = p.seller_id
             JOIN users u ON u.id = r.user_id
             WHERE {$whereSql}
             ORDER BY r.created_at DESC, r.id DESC
             LIMIT {$limit} OFFSET {$offset}",
            $params,
        );

        return ['rows' => $rows, 'total' => $total];
    }

    public function moderate(int $id, string $status, int $moderatedBy): bool
    {
        $statement = $this->db->execute(
            'UPDATE product_reviews
             SET status = :status, moderated_by = :moderated_by, moderated_at = UTC_TIMESTAMP()
             WHERE id = :id',
            ['status' => $status, 'moderated_by' => $moderatedBy, 'id' => $id],
        );

        return $this->db->affectedRows($statement) > 0;
    }

    public function sellerReply(int $reviewId, string $reply): bool
    {
        $statement = $this->db->execute(
            'UPDATE product_reviews SET seller_reply = :reply, seller_replied_at = UTC_TIMESTAMP() WHERE id = :id',
            ['reply' => $reply, 'id' => $reviewId],
        );

        return $this->db->affectedRows($statement) > 0;
    }

    public function countByStatus(string $status): int
    {
        return (int) $this->db->scalar('SELECT COUNT(*) FROM product_reviews WHERE status = :status', ['status' => $status]);
    }

    public function addReport(int $reviewId, int $reportedBy, string $reason): int
    {
        $this->db->execute(
            'INSERT INTO review_reports (review_id, reported_by, reason) VALUES (:review_id, :reported_by, :reason)',
            ['review_id' => $reviewId, 'reported_by' => $reportedBy, 'reason' => $reason],
        );

        return $this->db->lastInsertId();
    }

    /**
     * @return array{rows:list<array<string,mixed>>,total:int}
     */
    public function paginateReports(array $filters, int $page, int $perPage): array
    {
        $where = ['1=1'];
        $params = [];

        if (!empty($filters['status'])) {
            $where[] = 'rr.status = :status';
            $params['status'] = (string) $filters['status'];
        }

        $whereSql = implode(' AND ', $where);
        [$limit, $offset] = $this->window($page, $perPage);

        $total = (int) $this->db->scalar("SELECT COUNT(*) FROM review_reports rr WHERE {$whereSql}", $params);

        $rows = $this->db->select(
            "SELECT rr.id, rr.review_id, rr.reason, rr.status, rr.created_at, rr.resolved_at,
                    r.rating, r.review_text, r.product_id, u.full_name AS reporter_name
             FROM review_reports rr
             JOIN product_reviews r ON r.id = rr.review_id
             JOIN users u ON u.id = rr.reported_by
             WHERE {$whereSql}
             ORDER BY rr.created_at DESC, rr.id DESC
             LIMIT {$limit} OFFSET {$offset}",
            $params,
        );

        return ['rows' => $rows, 'total' => $total];
    }

    public function resolveReport(int $reportId, string $status, int $resolvedBy): bool
    {
        $statement = $this->db->execute(
            'UPDATE review_reports
             SET status = :status, resolved_by = :resolved_by, resolved_at = UTC_TIMESTAMP()
             WHERE id = :id',
            ['status' => $status, 'resolved_by' => $resolvedBy, 'id' => $reportId],
        );

        return $this->db->affectedRows($statement) > 0;
    }

    /**
     * Uses the supplied stored function so the definition stays single-sourced.
     */
    public function averageRating(int $productId): string
    {
        return (string) $this->db->scalar('SELECT fn_product_average_rating(:id)', ['id' => $productId]);
    }
}
