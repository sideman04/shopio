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
use Shopio\Repositories\PayoutRepository;
use Shopio\Repositories\RoleRepository;
use Shopio\Repositories\SellerDocumentRepository;
use Shopio\Repositories\SellerRepository;
use Shopio\Repositories\UserRepository;
use Shopio\Support\Money;
use Shopio\Support\Presenter;
use Shopio\Support\Str;

/**
 * Seller store profile, registration and dashboard analytics.
 */
final class SellerService
{
    public function __construct(
        private readonly Database $db,
        private readonly SellerRepository $sellers,
        private readonly UserRepository $users,
        private readonly RoleRepository $roles,
        private readonly OrderRepository $orders,
        private readonly InventoryRepository $inventory,
        private readonly PayoutRepository $payouts,
        private readonly SellerDocumentRepository $documents,
        private readonly UploadService $uploads,
        private readonly NotificationService $notifications,
        private readonly AuditService $audit,
    ) {
    }

    /**
     * @return array<string,mixed>
     */
    public function store(AuthenticatedUser $auth): array
    {
        $seller = $this->sellers->findByIdWithPrivate($this->sellerId($auth));

        return Presenter::seller($seller ?? [], true);
    }

    /**
     * @param array<string,mixed> $data
     * @return array<string,mixed>
     */
    public function updateStore(AuthenticatedUser $auth, array $data, Request $request): array
    {
        $sellerId = $this->sellerId($auth);
        $this->sellers->updateProfile($sellerId, $data);
        $this->audit->record($auth, 'seller.store_updated', 'seller', $sellerId, $request);

        return $this->store($auth);
    }

    /**
     * @return list<array<string,mixed>>
     */
    public function documents(AuthenticatedUser $auth): array
    {
        $sellerId = $this->sellerId($auth);

        return array_map(
            [Presenter::class, 'sellerDocument'],
            $this->documents->forSeller($sellerId),
        );
    }

    /**
     * @param array<string,mixed> $data
     * @param array<string,mixed>|null $file
     * @return array<string,mixed>
     */
    public function addDocument(AuthenticatedUser $auth, array $data, ?array $file, Request $request): array
    {
        $sellerId = $this->sellerId($auth);

        if ($this->documents->countForSeller($sellerId) >= 10) {
            throw new ConflictException('You can upload up to 10 verification documents.');
        }

        $stored = $this->uploads->storeDocument($auth, $file, $request);

        $documentId = $this->documents->create($sellerId, [
            'document_type' => (string) $data['document_type'],
            'label' => $data['label'] ?? null,
            'file_url' => $stored['url'],
            'file_path' => $stored['path'],
            'original_name' => $stored['originalName'],
            'mime_type' => $stored['mimeType'],
            'size_bytes' => $stored['sizeBytes'],
        ]);

        $this->sellers->markVerificationPending($sellerId);
        $this->audit->record($auth, 'seller.document_uploaded', 'seller_document', $documentId, $request, [
            'document_type' => $data['document_type'],
        ]);

        $document = $this->documents->findByIdForSeller($documentId, $sellerId);

        return Presenter::sellerDocument($document ?? []);
    }

    /**
     * @return array{body:string,mime:string,size:int,filename:string}
     */
    public function downloadDocument(AuthenticatedUser $auth, int $documentId): array
    {
        $document = $this->documents->findByIdForSeller($documentId, $this->sellerId($auth));
        if ($document === null) {
            throw new NotFoundException('The requested document does not exist.');
        }

        return $this->uploads->readDocument((string) $document['file_path']);
    }

    public function removeDocument(AuthenticatedUser $auth, int $documentId, Request $request): void
    {
        $sellerId = $this->sellerId($auth);
        $document = $this->documents->findByIdForSeller($documentId, $sellerId);

        if ($document === null) {
            throw new NotFoundException('The requested document does not exist.');
        }

        $this->documents->delete($documentId, $sellerId);
        $this->uploads->deleteStored((string) $document['file_path']);
        $this->audit->record($auth, 'seller.document_deleted', 'seller_document', $documentId, $request);
    }

    /**
     * @return array<string,mixed>
     */
    public function preferences(AuthenticatedUser $auth): array
    {
        $seller = $this->sellers->findByIdWithPrivate($this->sellerId($auth));
        $preferences = $seller['preferences'] ?? null;

        if (is_string($preferences)) {
            $preferences = json_decode($preferences, true);
        }

        return is_array($preferences) ? $preferences : [];
    }

    /**
     * @param array<string,mixed> $preferences
     * @return array<string,mixed>
     */
    public function updatePreferences(AuthenticatedUser $auth, array $preferences, Request $request): array
    {
        $sellerId = $this->sellerId($auth);
        $this->sellers->setPreferences($sellerId, $preferences);
        $this->audit->record($auth, 'seller.preferences_updated', 'seller', $sellerId, $request, [
            'keys' => array_keys($preferences),
        ]);

        return $this->preferences($auth);
    }

    /**
     * Upgrades an existing customer account into a seller. The seller role is
     * granted only here (never through public registration for an existing
     * account) and the store starts unverified.
     *
     * @param array<string,mixed> $data
     * @return array<string,mixed>
     */
    public function register(AuthenticatedUser $auth, array $data, Request $request): array
    {
        if ($auth->sellerId !== null) {
            throw new ConflictException('This account already has a store.');
        }

        $sellerId = $this->db->transaction(function () use ($auth, $data): int {
            $slug = $this->uniqueSlug((string) $data['store_name']);

            $sellerId = $this->sellers->create(
                $auth->id,
                (string) $data['store_name'],
                $slug,
                $data['store_description'] ?? null,
                $data['business_category'] ?? null,
                Money::format(Config::get('DEFAULT_COMMISSION_RATE', '10.00') ?? '10.00'),
            );

            $location = array_intersect_key($data, array_flip([
                'contact_phone',
                'region_id',
                'city_id',
                'address',
            ]));
            if ($location !== []) {
                $this->sellers->updateProfile($sellerId, $location);
            }

            $roleId = $this->roles->idByCode('seller');
            if ($roleId !== null) {
                $this->users->assignRole($auth->id, $roleId, $auth->id);
            }

            return $sellerId;
        });

        $this->audit->record($auth, 'seller.registered', 'seller', $sellerId, $request);
        $this->notifications->notify($auth->id, 'seller', 'Store created', 'Your store has been created and is awaiting verification.', '/seller');

        return Presenter::seller($this->sellers->findByIdWithPrivate($sellerId) ?? [], true);
    }

    /**
     * @return array<string,mixed>
     */
    public function dashboard(AuthenticatedUser $auth): array
    {
        $sellerId = $this->sellerId($auth);
        $since = gmdate('Y-m-d H:i:s', time() - 30 * 86400);

        $earnings = $this->orders->sellerEarningsSummary($sellerId);
        $inventory = $this->inventory->summaryForSeller($sellerId);

        $recentOrders = $this->orders->paginateForSeller($sellerId, [], 1, 5);

        return [
            'revenue' => [
                'total' => $this->orders->sellerRevenue($sellerId),
                'last30Days' => $this->orders->sellerRevenue($sellerId, $since),
                'net' => $earnings['earned_net'],
                'commission' => $earnings['commission_total'],
                'availableForPayout' => $earnings['available_for_payout'],
            ],
            'orders' => [
                'total' => $this->orders->sellerOrderCount($sellerId),
            ],
            'products' => [
                'total' => $this->productCount($sellerId),
            ],
            'inventory' => [
                'variants' => $inventory['variants'],
                'lowStock' => $inventory['low_stock'],
                'outOfStock' => $inventory['out_of_stock'],
            ],
            'payouts' => [
                'requested' => $this->payouts->requestedTotal($sellerId),
                'paid' => $this->payouts->paidTotal($sellerId),
            ],
            'recentOrders' => array_map(static fn (array $row): array => Presenter::orderSummary($row), $recentOrders['rows']),
        ];
    }

    /**
     * @return array<string,mixed>
     */
    public function analytics(AuthenticatedUser $auth, int $days = 30): array
    {
        $sellerId = $this->sellerId($auth);
        $days = max(7, min(90, $days));
        $since = gmdate('Y-m-d H:i:s', time() - $days * 86400);

        $rows = $this->db->select(
            "SELECT DATE(o.placed_at) AS day,
                    COALESCE(SUM(oi.quantity * oi.unit_price - oi.discount_amount), 0) AS revenue,
                    COUNT(DISTINCT o.id) AS orders
             FROM order_items oi
             JOIN orders o ON o.id = oi.order_id
             WHERE oi.seller_id = :seller_id
               AND o.placed_at >= :since
               AND o.status NOT IN ('cancelled', 'refunded')
             GROUP BY DATE(o.placed_at)
             ORDER BY day ASC",
            ['seller_id' => $sellerId, 'since' => $since],
        );

        $series = array_map(static fn (array $row): array => [
            'label' => (string) $row['day'],
            'revenue' => (float) $row['revenue'],
            'orders' => (int) $row['orders'],
        ], $rows);

        $topProducts = $this->db->select(
            "SELECT oi.product_name_snapshot AS name, oi.sku_snapshot AS sku,
                    SUM(oi.quantity) AS units, SUM(oi.quantity * oi.unit_price) AS revenue
             FROM order_items oi
             JOIN orders o ON o.id = oi.order_id
             WHERE oi.seller_id = :seller_id AND o.status NOT IN ('cancelled', 'refunded')
             GROUP BY oi.product_name_snapshot, oi.sku_snapshot
             ORDER BY revenue DESC
             LIMIT 10",
            ['seller_id' => $sellerId],
        );

        return [
            'series' => $series,
            'topProducts' => array_map(static fn (array $row): array => [
                'name' => (string) $row['name'],
                'sku' => (string) $row['sku'],
                'units' => (int) $row['units'],
                'revenue' => (string) $row['revenue'],
            ], $topProducts),
            'totals' => $this->orders->sellerEarningsSummary($sellerId),
        ];
    }

    private function sellerId(AuthenticatedUser $auth): int
    {
        if ($auth->sellerId === null) {
            throw new NotFoundException('No store is associated with this account.');
        }

        return $auth->sellerId;
    }

    private function productCount(int $sellerId): int
    {
        return (int) $this->db->scalar(
            'SELECT COUNT(*) FROM products WHERE seller_id = :seller_id AND deleted_at IS NULL',
            ['seller_id' => $sellerId],
        );
    }

    private function uniqueSlug(string $storeName): string
    {
        $base = Str::slug($storeName) ?: 'store';
        $slug = $base;
        $attempt = 0;

        while ($this->sellers->slugExists($slug)) {
            $attempt++;
            $slug = $base . '-' . strtolower(bin2hex(random_bytes(3)));
            if ($attempt > 10) {
                $slug = $base . '-' . time();
                break;
            }
        }

        return $slug;
    }
}
