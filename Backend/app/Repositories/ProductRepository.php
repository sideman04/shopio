<?php

declare(strict_types=1);

namespace Shopio\Repositories;

use Shopio\Config\Config;

/**
 * Catalogue data access: products, variants, images and variant options.
 *
 * Public queries only ever see products that are `active`, not soft-deleted and
 * (configurably) owned by an approved, non-suspended seller.
 */
final class ProductRepository extends Repository
{
    /** Sort allowlist — client values never reach the SQL text directly. */
    private const SORT_MAP = [
        'newest' => 'p.created_at',
        'oldest' => 'p.created_at',
        'price-asc' => 'min_price',
        'price-desc' => 'min_price',
        'rating' => 'rating',
        'name-asc' => 'p.name',
        'popularity' => 'review_count',
    ];

    /**
     * Columns shared by public list/detail queries.
     */
    private function publicSelect(): string
    {
        return 'p.id, p.seller_id, p.category_id, p.name, p.slug, p.short_description, p.brand,
                p.condition_type, p.status, p.currency, p.created_at, p.updated_at,
                c.name AS category_name, c.slug AS category_slug,
                s.store_name AS seller_name, s.store_slug AS seller_slug,
                COALESCE(r.average_rating, 0.00) AS rating,
                COALESCE(r.review_count, 0) AS review_count,
                (SELECT MIN(v.price) FROM product_variants v
                  WHERE v.product_id = p.id AND v.is_active = 1) AS min_price,
                (SELECT MAX(v.price) FROM product_variants v
                  WHERE v.product_id = p.id AND v.is_active = 1) AS max_price,
                (SELECT COALESCE(SUM(GREATEST(i.quantity_on_hand - i.quantity_reserved, 0)), 0)
                   FROM product_variants v JOIN inventory i ON i.variant_id = v.id
                  WHERE v.product_id = p.id AND v.is_active = 1) AS available_stock,
                (SELECT pi.image_url FROM product_images pi
                  WHERE pi.product_id = p.id
                  ORDER BY pi.is_primary DESC, pi.sort_order ASC, pi.id ASC LIMIT 1) AS primary_image';
    }

    private function publicFrom(): string
    {
        return 'FROM products p
                JOIN seller_profiles s ON s.id = p.seller_id
                LEFT JOIN categories c ON c.id = p.category_id
                LEFT JOIN v_product_rating_summary r ON r.product_id = p.id';
    }

    private function publicEligibility(): string
    {
        $sql = "p.status = 'active' AND p.deleted_at IS NULL AND s.status = 'active'";

        if (Config::bool('CATALOG_REQUIRE_APPROVED_SELLER', true)) {
            $sql .= " AND s.verification_status = 'approved'";
        }

        return $sql;
    }

    /**
     * Public catalogue search.
     *
     * @param array<string,mixed> $filters
     * @return array{rows:list<array<string,mixed>>,total:int}
     */
    public function publicSearch(array $filters, int $page, int $perPage): array
    {
        $where = [$this->publicEligibility()];
        $params = [];
        $isPriceSort = in_array($filters['sort'] ?? 'newest', ['price-asc', 'price-desc'], true);

        if (!empty($filters['q'])) {
            $like = '%' . $this->escapeLike((string) $filters['q']) . '%';
            $where[] = '(p.name LIKE :q ESCAPE \'\\\\\' OR p.brand LIKE :q ESCAPE \'\\\\\' OR p.short_description LIKE :q ESCAPE \'\\\\\')';
            $params['q'] = $like;
        }

        if (!empty($filters['seller_id'])) {
            $where[] = 'p.seller_id = :seller_id';
            $params['seller_id'] = (int) $filters['seller_id'];
        }

        if (!empty($filters['brand'])) {
            $where[] = 'p.brand = :brand';
            $params['brand'] = (string) $filters['brand'];
        }

        if (!empty($filters['condition'])) {
            $conditions = array_values(array_intersect(
                (array) $filters['condition'],
                ['new', 'used', 'refurbished'],
            ));
            if ($conditions !== []) {
                $placeholders = [];
                foreach ($conditions as $index => $condition) {
                    $key = 'cond' . $index;
                    $placeholders[] = ':' . $key;
                    $params[$key] = $condition;
                }
                $where[] = 'p.condition_type IN (' . implode(', ', $placeholders) . ')';
            }
        }

        if (!empty($filters['category_id'])) {
            $ids = array_merge([(int) $filters['category_id']], $this->descendantCategoryIds((int) $filters['category_id']));
            $placeholders = [];
            foreach ($ids as $index => $id) {
                $key = 'cat' . $index;
                $placeholders[] = ':' . $key;
                $params[$key] = $id;
            }
            $where[] = 'p.category_id IN (' . implode(', ', $placeholders) . ')';
        }

        if (isset($filters['min_price']) && $filters['min_price'] !== '') {
            $where[] = 'EXISTS (SELECT 1 FROM product_variants v2 WHERE v2.product_id = p.id
                               AND v2.is_active = 1 AND v2.price >= :min_price)';
            $params['min_price'] = (string) $filters['min_price'];
        }

        if (isset($filters['max_price']) && $filters['max_price'] !== '') {
            $where[] = 'EXISTS (SELECT 1 FROM product_variants v3 WHERE v3.product_id = p.id
                               AND v3.is_active = 1 AND v3.price <= :max_price)';
            $params['max_price'] = (string) $filters['max_price'];
        }

        if (!empty($filters['in_stock'])) {
            $where[] = 'EXISTS (SELECT 1 FROM product_variants v4 JOIN inventory i4 ON i4.variant_id = v4.id
                               WHERE v4.product_id = p.id AND v4.is_active = 1
                                 AND i4.quantity_on_hand > i4.quantity_reserved)';
        }

        if (isset($filters['rating_min']) && $filters['rating_min'] !== '') {
            $where[] = 'COALESCE(r.average_rating, 0) >= :rating_min';
            $params['rating_min'] = (string) $filters['rating_min'];
        }

        $whereSql = implode(' AND ', $where);
        [$limit, $offset] = $this->window($page, $perPage);

        $total = (int) $this->db->scalar(
            "SELECT COUNT(*) FROM products p
             JOIN seller_profiles s ON s.id = p.seller_id
             LEFT JOIN v_product_rating_summary r ON r.product_id = p.id
             WHERE {$whereSql}",
            $params,
        );

        $orderBy = $this->orderBy(
            isset($filters['sort']) ? (string) $filters['sort'] : null,
            str_contains((string) ($filters['sort'] ?? ''), 'asc') ? 'ASC' : 'DESC',
            self::SORT_MAP,
            'newest',
        );

        // Reverse the default direction for ascending price sorts.
        if (($filters['sort'] ?? '') === 'price-asc' || ($filters['sort'] ?? '') === 'name-asc' || ($filters['sort'] ?? '') === 'oldest') {
            $orderBy = preg_replace('/\s+(ASC|DESC)$/', ' ASC', $orderBy) ?? $orderBy;
        } elseif ($isPriceSort) {
            $orderBy = preg_replace('/\s+(ASC|DESC)$/', ' DESC', $orderBy) ?? $orderBy;
        }

        $rows = $this->db->select(
            'SELECT ' . $this->publicSelect() . ' ' . $this->publicFrom() . "
             WHERE {$whereSql}
             ORDER BY {$orderBy}, p.id DESC
             LIMIT {$limit} OFFSET {$offset}",
            $params,
        );

        return ['rows' => $rows, 'total' => $total];
    }

    /**
     * @return array<string,mixed>|null
     */
    public function findPublicById(int $id): ?array
    {
        return $this->db->selectOne(
            'SELECT ' . $this->publicSelect() . ' ' . $this->publicFrom() . '
             WHERE p.id = :id AND ' . $this->publicEligibility() . ' LIMIT 1',
            ['id' => $id],
        );
    }

    /**
     * @return array<string,mixed>|null
     */
    public function findPublicBySlug(string $slug): ?array
    {
        return $this->db->selectOne(
            'SELECT ' . $this->publicSelect() . ' ' . $this->publicFrom() . '
             WHERE p.slug = :slug AND ' . $this->publicEligibility() . ' LIMIT 1',
            ['slug' => $slug],
        );
    }

    /**
     * Seller-scoped lookup: returns the row only when the seller owns it.
     *
     * @return array<string,mixed>|null
     */
    public function findForSeller(int $id, int $sellerId): ?array
    {
        return $this->db->selectOne(
            'SELECT p.*, COALESCE(r.average_rating, 0.00) AS rating, COALESCE(r.review_count, 0) AS review_count
             FROM products p
             LEFT JOIN v_product_rating_summary r ON r.product_id = p.id
             WHERE p.id = :id AND p.seller_id = :seller_id AND p.deleted_at IS NULL
             LIMIT 1',
            ['id' => $id, 'seller_id' => $sellerId],
        );
    }

    /**
     * Admin lookup (any seller, including soft-deleted).
     *
     * @return array<string,mixed>|null
     */
    public function findForAdmin(int $id): ?array
    {
        return $this->db->selectOne(
            'SELECT p.*, s.store_name AS seller_name, COALESCE(r.average_rating, 0.00) AS rating,
                    COALESCE(r.review_count, 0) AS review_count
             FROM products p
             JOIN seller_profiles s ON s.id = p.seller_id
             LEFT JOIN v_product_rating_summary r ON r.product_id = p.id
             WHERE p.id = :id LIMIT 1',
            ['id' => $id],
        );
    }

    /**
     * @return array<string,mixed>|null
     */
    public function lockById(int $id): ?array
    {
        return $this->db->selectOne(
            'SELECT p.id, p.seller_id, p.status, p.deleted_at, p.name, p.category_id
             FROM products p WHERE p.id = :id LIMIT 1 FOR UPDATE',
            ['id' => $id],
        );
    }

    public function slugExists(string $slug, ?int $exceptId = null): bool
    {
        $sql = 'SELECT 1 FROM products WHERE slug = :slug';
        $params = ['slug' => $slug];

        if ($exceptId !== null) {
            $sql .= ' AND id <> :except';
            $params['except'] = $exceptId;
        }

        return $this->db->scalar($sql . ' LIMIT 1', $params) !== null;
    }

    /**
     * @param array<string,mixed> $data
     */
    public function create(array $data): int
    {
        $this->db->execute(
            'INSERT INTO products
                (seller_id, category_id, name, slug, short_description, description, brand, condition_type,
                 status, currency)
             VALUES
                (:seller_id, :category_id, :name, :slug, :short_description, :description, :brand, :condition_type,
                 :status, :currency)',
            [
                'seller_id' => (int) $data['seller_id'],
                'category_id' => $data['category_id'] !== null && $data['category_id'] !== '' ? (int) $data['category_id'] : null,
                'name' => $data['name'],
                'slug' => $data['slug'],
                'short_description' => $data['short_description'] ?? null,
                'description' => $data['description'] ?? null,
                'brand' => $data['brand'] ?? null,
                'condition_type' => $data['condition_type'] ?? 'new',
                'status' => $data['status'] ?? 'draft',
                'currency' => $data['currency'] ?? Config::get('DEFAULT_CURRENCY', 'TZS'),
            ],
        );

        return $this->db->lastInsertId();
    }

    /**
     * Explicit column allowlist: `seller_id`, `status`, `approved_by` and
     * `slug` are not settable through a generic update.
     *
     * @param array<string,mixed> $data
     */
    public function update(int $id, array $data): void
    {
        $allowed = ['category_id', 'name', 'short_description', 'description', 'brand', 'condition_type'];
        $sets = [];
        $params = ['id' => $id];

        foreach ($allowed as $column) {
            if (!array_key_exists($column, $data)) {
                continue;
            }
            $sets[] = "{$column} = :{$column}";
            $params[$column] = $column === 'category_id' && ($data[$column] === null || $data[$column] === '')
                ? null
                : $data[$column];
        }

        if ($sets === []) {
            return;
        }

        $this->db->execute('UPDATE products SET ' . implode(', ', $sets) . ' WHERE id = :id', $params);
    }

    public function updateSlug(int $id, string $slug): void
    {
        $this->db->execute('UPDATE products SET slug = :slug WHERE id = :id', ['slug' => $slug, 'id' => $id]);
    }

    public function setStatus(int $id, string $status, ?string $rejectionReason = null): void
    {
        $this->db->execute(
            'UPDATE products SET status = :status, rejection_reason = :reason WHERE id = :id',
            ['status' => $status, 'reason' => $rejectionReason, 'id' => $id],
        );
    }

    public function markApproved(int $id, int $approvedBy): void
    {
        $this->db->execute(
            "UPDATE products SET status = 'active', approved_by = :approved_by, approved_at = UTC_TIMESTAMP(),
                    rejection_reason = NULL
             WHERE id = :id",
            ['approved_by' => $approvedBy, 'id' => $id],
        );
    }

    public function softDelete(int $id): void
    {
        $this->db->execute(
            'UPDATE products SET deleted_at = UTC_TIMESTAMP(), status = \'archived\' WHERE id = :id',
            ['id' => $id],
        );
    }

    /**
     * @param array<string,mixed> $filters
     * @return array{rows:list<array<string,mixed>>,total:int}
     */
    public function paginateForSeller(int $sellerId, array $filters, int $page, int $perPage): array
    {
        $where = ['p.seller_id = :seller_id', 'p.deleted_at IS NULL'];
        $params = ['seller_id' => $sellerId];

        if (!empty($filters['q'])) {
            $where[] = 'p.name LIKE :q ESCAPE \'\\\\\'';
            $params['q'] = '%' . $this->escapeLike((string) $filters['q']) . '%';
        }

        if (!empty($filters['status'])) {
            $where[] = 'p.status = :status';
            $params['status'] = (string) $filters['status'];
        }

        if (!empty($filters['category_id'])) {
            $where[] = 'p.category_id = :category_id';
            $params['category_id'] = (int) $filters['category_id'];
        }

        $whereSql = implode(' AND ', $where);
        [$limit, $offset] = $this->window($page, $perPage);

        $total = (int) $this->db->scalar("SELECT COUNT(*) FROM products p WHERE {$whereSql}", $params);

        $rows = $this->db->select(
            "SELECT p.id, p.category_id, p.name, p.slug, p.brand, p.condition_type, p.status,
                    p.rejection_reason, p.created_at, p.updated_at, c.name AS category_name,
                    (SELECT COUNT(*) FROM product_variants v WHERE v.product_id = p.id) AS variant_count,
                    (SELECT COALESCE(MIN(v.price), 0) FROM product_variants v WHERE v.product_id = p.id AND v.is_active = 1) AS min_price,
                    (SELECT COALESCE(SUM(GREATEST(i.quantity_on_hand - i.quantity_reserved, 0)), 0)
                       FROM product_variants v JOIN inventory i ON i.variant_id = v.id
                      WHERE v.product_id = p.id) AS available_stock,
                    (SELECT pi.image_url FROM product_images pi WHERE pi.product_id = p.id
                      ORDER BY pi.is_primary DESC, pi.sort_order ASC, pi.id ASC LIMIT 1) AS primary_image
             FROM products p
             LEFT JOIN categories c ON c.id = p.category_id
             WHERE {$whereSql}
             ORDER BY p.updated_at DESC, p.id DESC
             LIMIT {$limit} OFFSET {$offset}",
            $params,
        );

        return ['rows' => $rows, 'total' => $total];
    }

    /**
     * @param array<string,mixed> $filters
     * @return array{rows:list<array<string,mixed>>,total:int}
     */
    public function paginateForAdmin(array $filters, int $page, int $perPage): array
    {
        $where = ['1=1'];
        $params = [];

        if (!empty($filters['q'])) {
            $where[] = '(p.name LIKE :q ESCAPE \'\\\\\' OR p.slug LIKE :q ESCAPE \'\\\\\')';
            $params['q'] = '%' . $this->escapeLike((string) $filters['q']) . '%';
        }

        if (!empty($filters['status'])) {
            $where[] = 'p.status = :status';
            $params['status'] = (string) $filters['status'];
        }

        if (!empty($filters['seller_id'])) {
            $where[] = 'p.seller_id = :seller_id';
            $params['seller_id'] = (int) $filters['seller_id'];
        }

        if (!empty($filters['category_id'])) {
            $where[] = 'p.category_id = :category_id';
            $params['category_id'] = (int) $filters['category_id'];
        }

        if (empty($filters['include_deleted'])) {
            $where[] = 'p.deleted_at IS NULL';
        }

        $whereSql = implode(' AND ', $where);
        [$limit, $offset] = $this->window($page, $perPage);

        $total = (int) $this->db->scalar("SELECT COUNT(*) FROM products p WHERE {$whereSql}", $params);

        $rows = $this->db->select(
            "SELECT p.id, p.seller_id, p.category_id, p.name, p.slug, p.short_description, p.brand, p.status,
                    p.rejection_reason, p.condition_type, p.currency,
                    p.created_at, p.updated_at, p.deleted_at, s.store_name AS seller_name,
                    c.name AS category_name, c.slug AS category_slug,
                    (SELECT COUNT(*) FROM product_variants v WHERE v.product_id = p.id) AS variant_count
             FROM products p
             JOIN seller_profiles s ON s.id = p.seller_id
             LEFT JOIN categories c ON c.id = p.category_id
             WHERE {$whereSql}
             ORDER BY p.updated_at DESC, p.id DESC
             LIMIT {$limit} OFFSET {$offset}",
            $params,
        );

        return ['rows' => $rows, 'total' => $total];
    }

    public function countByStatus(string $status): int
    {
        return (int) $this->db->scalar(
            'SELECT COUNT(*) FROM products WHERE status = :status AND deleted_at IS NULL',
            ['status' => $status],
        );
    }

    public function countCreatedSince(string $sinceUtc): int
    {
        return (int) $this->db->scalar(
            'SELECT COUNT(*) FROM products WHERE created_at >= :since AND deleted_at IS NULL',
            ['since' => $sinceUtc],
        );
    }

    /**
     * @return list<array<string,mixed>>
     */
    public function images(int $productId): array
    {
        return $this->db->select(
            'SELECT id, product_id, image_url, alt_text, sort_order, is_primary
             FROM product_images WHERE product_id = :product_id
             ORDER BY is_primary DESC, sort_order ASC, id ASC',
            ['product_id' => $productId],
        );
    }

    /**
     * @return array<string,mixed>|null
     */
    public function findImage(int $imageId): ?array
    {
        return $this->db->selectOne(
            'SELECT id, product_id, image_url, alt_text, sort_order, is_primary
             FROM product_images WHERE id = :id LIMIT 1',
            ['id' => $imageId],
        );
    }

    public function addImage(int $productId, string $imageUrl, ?string $altText, int $sortOrder, bool $isPrimary): int
    {
        $this->db->execute(
            'INSERT INTO product_images (product_id, image_url, alt_text, sort_order, is_primary)
             VALUES (:product_id, :image_url, :alt_text, :sort_order, :is_primary)',
            [
                'product_id' => $productId,
                'image_url' => $imageUrl,
                'alt_text' => $altText,
                'sort_order' => $sortOrder,
                'is_primary' => $isPrimary ? 1 : 0,
            ],
        );

        return $this->db->lastInsertId();
    }

    public function clearPrimaryImages(int $productId): void
    {
        $this->db->execute('UPDATE product_images SET is_primary = 0 WHERE product_id = :product_id', ['product_id' => $productId]);
    }

    public function setPrimaryImage(int $productId, int $imageId): bool
    {
        $statement = $this->db->execute(
            'UPDATE product_images SET is_primary = 1 WHERE id = :id AND product_id = :product_id',
            ['id' => $imageId, 'product_id' => $productId],
        );

        return $this->db->affectedRows($statement) > 0;
    }

    public function deleteImage(int $productId, int $imageId): bool
    {
        $statement = $this->db->execute(
            'DELETE FROM product_images WHERE id = :id AND product_id = :product_id',
            ['id' => $imageId, 'product_id' => $productId],
        );

        return $this->db->affectedRows($statement) > 0;
    }

    public function countImages(int $productId): int
    {
        return (int) $this->db->scalar('SELECT COUNT(*) FROM product_images WHERE product_id = :id', ['id' => $productId]);
    }

    /**
     * @return list<array<string,mixed>>
     */
    public function variants(int $productId, bool $onlyActive = false): array
    {
        $sql = 'SELECT v.id, v.product_id, v.sku, v.variant_name, v.price, v.compare_at_price, v.cost_price,
                       v.weight_grams, v.is_default, v.is_active, v.created_at, v.updated_at,
                       COALESCE(i.quantity_on_hand, 0) AS quantity_on_hand,
                       COALESCE(i.quantity_reserved, 0) AS quantity_reserved,
                       COALESCE(i.quantity_on_hand - i.quantity_reserved, 0) AS available_stock,
                       COALESCE(i.low_stock_threshold, 5) AS low_stock_threshold
                FROM product_variants v
                LEFT JOIN inventory i ON i.variant_id = v.id
                WHERE v.product_id = :product_id';

        if ($onlyActive) {
            $sql .= ' AND v.is_active = 1';
        }

        $sql .= ' ORDER BY v.is_default DESC, v.id ASC';

        return $this->db->select($sql, ['product_id' => $productId]);
    }

    /**
     * @return array<string,mixed>|null
     */
    public function findVariant(int $variantId): ?array
    {
        return $this->db->selectOne(
            'SELECT v.id, v.product_id, v.sku, v.variant_name, v.price, v.compare_at_price, v.cost_price,
                    v.weight_grams, v.is_default, v.is_active,
                    COALESCE(i.quantity_on_hand, 0) AS quantity_on_hand,
                    COALESCE(i.quantity_reserved, 0) AS quantity_reserved,
                    COALESCE(i.quantity_on_hand - i.quantity_reserved, 0) AS available_stock,
                    COALESCE(i.low_stock_threshold, 5) AS low_stock_threshold
             FROM product_variants v
             LEFT JOIN inventory i ON i.variant_id = v.id
             WHERE v.id = :id LIMIT 1',
            ['id' => $variantId],
        );
    }

    /**
     * Variant lookup joined to its product so ownership can be verified in the
     * same query (never trust a variant id posted by a client).
     *
     * @return array<string,mixed>|null
     */
    public function findVariantWithProduct(int $variantId): ?array
    {
        return $this->db->selectOne(
            'SELECT v.id AS variant_id, v.product_id, v.sku, v.variant_name, v.price, v.compare_at_price,
                    v.cost_price, v.is_active AS variant_is_active, v.is_default,
                    p.seller_id, p.name AS product_name, p.slug AS product_slug, p.status AS product_status,
                    p.deleted_at AS product_deleted_at, p.currency,
                    s.user_id AS seller_user_id, s.status AS seller_status,
                    s.verification_status AS seller_verification_status, s.commission_rate,
                    s.store_name AS seller_name,
                    COALESCE(i.quantity_on_hand, 0) AS quantity_on_hand,
                    COALESCE(i.quantity_reserved, 0) AS quantity_reserved,
                    COALESCE(i.quantity_on_hand - i.quantity_reserved, 0) AS available_stock
             FROM product_variants v
             JOIN products p ON p.id = v.product_id
             JOIN seller_profiles s ON s.id = p.seller_id
             LEFT JOIN inventory i ON i.variant_id = v.id
             WHERE v.id = :id LIMIT 1',
            ['id' => $variantId],
        );
    }

    public function skuExists(string $sku): bool
    {
        return $this->db->scalar('SELECT 1 FROM product_variants WHERE sku = :sku LIMIT 1', ['sku' => $sku]) !== null;
    }

    /**
     * Locks the variant + inventory rows for checkout. Requires an open
     * transaction; the caller must have already joined `inventory`.
     *
     * @return array<string,mixed>|null
     */
    public function lockVariantForCheckout(int $variantId): ?array
    {
        return $this->db->selectOne(
            'SELECT v.id AS variant_id, v.product_id, v.sku, v.variant_name, v.price, v.is_active AS variant_is_active,
                    p.seller_id, p.name AS product_name, p.slug AS product_slug, p.status AS product_status,
                    p.deleted_at AS product_deleted_at,
                    s.status AS seller_status, s.verification_status AS seller_verification_status,
                    s.commission_rate,
                    i.quantity_on_hand, i.quantity_reserved
             FROM product_variants v
             JOIN products p ON p.id = v.product_id
             JOIN seller_profiles s ON s.id = p.seller_id
             LEFT JOIN inventory i ON i.variant_id = v.id
             WHERE v.id = :id LIMIT 1 FOR UPDATE',
            ['id' => $variantId],
        );
    }

    /**
     * @param array<string,mixed> $data
     */
    public function createVariant(array $data): int
    {
        $this->db->execute(
            'INSERT INTO product_variants
                (product_id, sku, variant_name, price, compare_at_price, cost_price, weight_grams, is_default, is_active)
             VALUES
                (:product_id, :sku, :variant_name, :price, :compare_at_price, :cost_price, :weight_grams, :is_default, :is_active)',
            [
                'product_id' => (int) $data['product_id'],
                'sku' => $data['sku'],
                'variant_name' => $data['variant_name'] ?? 'Default',
                'price' => (string) $data['price'],
                'compare_at_price' => $data['compare_at_price'] ?? null,
                'cost_price' => $data['cost_price'] ?? null,
                'weight_grams' => $data['weight_grams'] ?? null,
                'is_default' => !empty($data['is_default']) ? 1 : 0,
                'is_active' => array_key_exists('is_active', $data) ? (!empty($data['is_active']) ? 1 : 0) : 1,
            ],
        );

        return $this->db->lastInsertId();
    }

    /**
     * @param array<string,mixed> $data
     */
    public function updateVariant(int $variantId, array $data): void
    {
        $allowed = ['variant_name', 'price', 'compare_at_price', 'cost_price', 'weight_grams', 'is_active', 'is_default'];
        $sets = [];
        $params = ['id' => $variantId];

        foreach ($allowed as $column) {
            if (!array_key_exists($column, $data)) {
                continue;
            }

            $sets[] = "{$column} = :{$column}";
            $params[$column] = match ($column) {
                'is_active', 'is_default' => !empty($data[$column]) ? 1 : 0,
                'weight_grams' => $data[$column] === null || $data[$column] === '' ? null : (int) $data[$column],
                'price', 'compare_at_price', 'cost_price' => $data[$column] === null || $data[$column] === ''
                    ? null
                    : (string) $data[$column],
                default => $data[$column],
            };
        }

        if ($sets === []) {
            return;
        }

        $this->db->execute('UPDATE product_variants SET ' . implode(', ', $sets) . ' WHERE id = :id', $params);
    }

    public function deleteVariant(int $variantId): void
    {
        $this->db->execute('DELETE FROM product_variants WHERE id = :id', ['id' => $variantId]);
    }

    public function countVariants(int $productId): int
    {
        return (int) $this->db->scalar('SELECT COUNT(*) FROM product_variants WHERE product_id = :id', ['id' => $productId]);
    }

    /**
     * Option types + values for a product, with the values grouped per type.
     *
     * @return list<array{name:string,values:list<string>}>
     */
    public function optionTypes(int $productId): array
    {
        $rows = $this->db->select(
            'SELECT ot.id AS option_type_id, ot.name, ov.id AS option_value_id, ov.value
             FROM product_option_types ot
             LEFT JOIN product_option_values ov ON ov.option_type_id = ot.id
             WHERE ot.product_id = :product_id
             ORDER BY ot.id ASC, ov.id ASC',
            ['product_id' => $productId],
        );

        $grouped = [];
        foreach ($rows as $row) {
            $name = (string) $row['name'];
            if (!isset($grouped[$name])) {
                $grouped[$name] = ['name' => $name, 'values' => []];
            }
            if ($row['value'] !== null) {
                $grouped[$name]['values'][] = (string) $row['value'];
            }
        }

        return array_values($grouped);
    }

    /**
     * @return array<string,string> option name => value for a variant
     */
    public function variantOptions(int $variantId): array
    {
        $rows = $this->db->select(
            'SELECT ot.name, ov.value
             FROM variant_option_values vov
             JOIN product_option_values ov ON ov.id = vov.option_value_id
             JOIN product_option_types ot ON ot.id = ov.option_type_id
             WHERE vov.variant_id = :variant_id
             ORDER BY ot.name',
            ['variant_id' => $variantId],
        );

        $options = [];
        foreach ($rows as $row) {
            $options[(string) $row['name']] = (string) $row['value'];
        }

        return $options;
    }

    public function findOptionTypeId(int $productId, string $name): ?int
    {
        $id = $this->db->scalar(
            'SELECT id FROM product_option_types WHERE product_id = :product_id AND name = :name LIMIT 1',
            ['product_id' => $productId, 'name' => $name],
        );

        return $id === null ? null : (int) $id;
    }

    public function createOptionType(int $productId, string $name): int
    {
        $this->db->execute(
            'INSERT INTO product_option_types (product_id, name) VALUES (:product_id, :name)',
            ['product_id' => $productId, 'name' => $name],
        );

        return $this->db->lastInsertId();
    }

    public function findOptionValueId(int $optionTypeId, string $value): ?int
    {
        $id = $this->db->scalar(
            'SELECT id FROM product_option_values WHERE option_type_id = :type AND value = :value LIMIT 1',
            ['type' => $optionTypeId, 'value' => $value],
        );

        return $id === null ? null : (int) $id;
    }

    public function createOptionValue(int $optionTypeId, string $value): int
    {
        $this->db->execute(
            'INSERT INTO product_option_values (option_type_id, value) VALUES (:type, :value)',
            ['type' => $optionTypeId, 'value' => $value],
        );

        return $this->db->lastInsertId();
    }

    public function linkVariantOption(int $variantId, int $optionValueId): void
    {
        $this->db->execute(
            'INSERT INTO variant_option_values (variant_id, option_value_id) VALUES (:variant_id, :value_id)
             ON DUPLICATE KEY UPDATE variant_id = variant_id',
            ['variant_id' => $variantId, 'value_id' => $optionValueId],
        );
    }

    public function clearVariantOptions(int $variantId): void
    {
        $this->db->execute('DELETE FROM variant_option_values WHERE variant_id = :id', ['id' => $variantId]);
    }

    /**
     * @return list<int>
     */
    private function descendantCategoryIds(int $categoryId): array
    {
        $ids = [];
        $frontier = [$categoryId];
        $guard = 0;

        while ($frontier !== [] && $guard < 25) {
            $guard++;
            $placeholders = implode(', ', array_fill(0, count($frontier), '?'));
            $rows = $this->db->select(
                "SELECT id FROM categories WHERE parent_id IN ({$placeholders})",
                $frontier,
            );
            $next = [];
            foreach ($rows as $row) {
                $id = (int) $row['id'];
                if (!in_array($id, $ids, true)) {
                    $ids[] = $id;
                    $next[] = $id;
                }
            }
            $frontier = $next;
        }

        return $ids;
    }

    private function escapeLike(string $value): string
    {
        return str_replace(['\\', '%', '_'], ['\\\\', '\\%', '\\_'], $value);
    }
}
