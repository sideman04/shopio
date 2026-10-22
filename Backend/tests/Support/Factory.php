<?php

declare(strict_types=1);

namespace Shopio\Tests\Support;

use Shopio\Database\Database;
use Shopio\Repositories\InventoryRepository;
use Shopio\Repositories\RoleRepository;
use Shopio\Repositories\SellerRepository;
use Shopio\Repositories\UserRepository;
use Shopio\Services\PasswordHasher;
use Shopio\Services\SessionService;

/**
 * Deterministic fixture builder.
 *
 * Inserts rows directly through the repositories (and the trusted seeder path
 * for privileged roles) so tests exercise the same data shapes the application
 * uses without going through HTTP for setup.
 */
final class Factory
{
    public const PASSWORD = 'Password123!';

    public static function db(): Database
    {
        return TestApplication::make(Database::class);
    }

    public static function roleId(string $code): int
    {
        $id = TestApplication::make(RoleRepository::class)->idByCode($code);
        if ($id === null) {
            throw new \RuntimeException("Missing role '{$code}'. Did reference data seed?");
        }

        return $id;
    }

    /**
     * @param array<string,mixed> $attributes
     * @param list<string>        $roles
     * @return array<string,mixed>
     */
    public static function user(array $attributes = [], array $roles = ['customer']): array
    {
        $users = TestApplication::make(UserRepository::class);
        $hasher = TestApplication::make(PasswordHasher::class);

        $email = (string) ($attributes['email'] ?? self::uniqueEmail());
        $userId = $users->create([
            'full_name' => (string) ($attributes['full_name'] ?? 'Test User'),
            'email' => $email,
            'phone' => $attributes['phone'] ?? null,
            'password_hash' => $hasher->hash((string) ($attributes['password'] ?? self::PASSWORD)),
            'status' => (string) ($attributes['status'] ?? 'active'),
            'email_verified_at' => $attributes['email_verified_at'] ?? gmdate('Y-m-d H:i:s'),
        ]);

        foreach ($roles as $role) {
            $users->assignRole($userId, self::roleId($role));
        }

        $row = $users->findById($userId);
        if ($row === null) {
            throw new \RuntimeException('Failed to create fixture user.');
        }

        $row['password'] = (string) ($attributes['password'] ?? self::PASSWORD);

        return $row;
    }

    /**
     * @param array<string,mixed> $attributes
     * @return array<string,mixed>
     */
    public static function admin(array $attributes = []): array
    {
        return self::user($attributes, ['admin']);
    }

    /**
     * Creates a seller user plus store profile. By default the store is approved
     * so it is eligible for the public catalogue.
     *
     * @param array<string,mixed> $attributes
     * @return array<string,mixed>
     */
    public static function seller(array $attributes = [], bool $approved = true): array
    {
        $user = self::user($attributes, ['customer', 'seller']);
        $sellers = TestApplication::make(SellerRepository::class);

        $storeName = (string) ($attributes['store_name'] ?? 'Test Store');
        $slug = (string) ($attributes['store_slug'] ?? self::uniqueSlug($storeName));

        $sellerId = $sellers->create(
            (int) $user['id'],
            $storeName,
            $slug,
            $attributes['store_description'] ?? null,
            $attributes['business_category'] ?? null,
            (string) ($attributes['commission_rate'] ?? '10.00'),
        );

        $sellers->updateVerification($sellerId, $approved ? 'approved' : 'pending', null, (int) $user['id']);
        if (($attributes['store_status'] ?? 'active') !== 'active') {
            $sellers->setStatus($sellerId, (string) $attributes['store_status']);
        }

        $seller = $sellers->findByUserId((int) $user['id']);
        if ($seller === null) {
            throw new \RuntimeException('Failed to create fixture seller.');
        }

        $seller['user'] = $user;

        return $seller;
    }

    /**
     * @param array<string,mixed> $attributes
     * @return array<string,mixed>
     */
    public static function product(int $sellerId, array $attributes = []): array
    {
        $db = self::db();
        $categoryId = $attributes['category_id'] ?? self::firstCategoryId();
        $name = (string) ($attributes['name'] ?? 'Test Product');
        $slug = (string) ($attributes['slug'] ?? self::uniqueSlug($name));

        $db->execute(
            'INSERT INTO products
                (seller_id, category_id, name, slug, short_description, description, brand,
                 condition_type, status, currency)
             VALUES
                (:seller_id, :category_id, :name, :slug, :short_description, :description, :brand,
                 :condition_type, :status, :currency)',
            [
                'seller_id' => $sellerId,
                'category_id' => $categoryId,
                'name' => $name,
                'slug' => $slug,
                'short_description' => $attributes['short_description'] ?? 'A test product',
                'description' => $attributes['description'] ?? 'A test product description',
                'brand' => $attributes['brand'] ?? 'Shopio',
                'condition_type' => $attributes['condition_type'] ?? 'new',
                'status' => $attributes['status'] ?? 'active',
                'currency' => $attributes['currency'] ?? 'TZS',
            ],
        );

        $id = $db->lastInsertId();
        $product = $db->selectOne('SELECT * FROM products WHERE id = :id', ['id' => $id]);

        return $product ?? [];
    }

    /**
     * @param array<string,mixed> $attributes
     * @return array<string,mixed>
     */
    public static function variant(int $productId, array $attributes = []): array
    {
        $db = self::db();

        $db->execute(
            'INSERT INTO product_variants (product_id, sku, variant_name, price, is_default, is_active)
             VALUES (:product_id, :sku, :variant_name, :price, :is_default, :is_active)',
            [
                'product_id' => $productId,
                'sku' => (string) ($attributes['sku'] ?? 'SKU-' . strtoupper(bin2hex(random_bytes(4)))),
                'variant_name' => (string) ($attributes['variant_name'] ?? 'Default'),
                'price' => (string) ($attributes['price'] ?? '100.00'),
                'is_default' => $attributes['is_default'] ?? 1,
                'is_active' => $attributes['is_active'] ?? 1,
            ],
        );

        $id = $db->lastInsertId();
        $variant = $db->selectOne('SELECT * FROM product_variants WHERE id = :id', ['id' => $id]);

        return $variant ?? [];
    }

    /**
     * Adds stock through the movement ledger (the only legal way to change
     * `quantity_on_hand`).
     */
    public static function stock(int $variantId, int $quantity, ?int $actorId = null): void
    {
        TestApplication::make(InventoryRepository::class)
            ->recordMovement($variantId, 'opening', $quantity, $actorId, 'manual', null, 'fixture');
    }

    /**
     * @return array<string,mixed>|null
     */
    public static function inventory(int $variantId): ?array
    {
        return TestApplication::make(InventoryRepository::class)->forVariant($variantId);
    }

    /**
     * Convenience bundle: an approved seller with one active product and variant.
     *
     * @return array{seller:array<string,mixed>,user:array<string,mixed>,product:array<string,mixed>,variant:array<string,mixed>}
     */
    public static function sellerWithProduct(int $stock = 10, string $price = '100.00'): array
    {
        $seller = self::seller();
        $product = self::product((int) $seller['id']);
        $variant = self::variant((int) $product['id'], ['price' => $price]);
        self::stock((int) $variant['id'], $stock, (int) $seller['user']['id']);

        return [
            'seller' => $seller,
            'user' => $seller['user'],
            'product' => $product,
            'variant' => $variant,
        ];
    }

    public static function firstCategoryId(): int
    {
        return (int) self::db()->scalar('SELECT id FROM categories ORDER BY id LIMIT 1');
    }

    /**
     * Returns an existing city id (creating a region + city if the reference
     * data is empty, which it is in the reset test database).
     */
    public static function cityId(): int
    {
        $db = self::db();

        $existing = (int) $db->scalar('SELECT id FROM cities ORDER BY id LIMIT 1');
        if ($existing > 0) {
            return $existing;
        }

        $db->execute(
            "INSERT INTO regions (country_code, name) VALUES ('TZ', 'Dar es Salaam')",
        );
        $regionId = $db->lastInsertId();

        $db->execute(
            'INSERT INTO cities (region_id, name) VALUES (:region_id, :name)',
            ['region_id' => $regionId, 'name' => 'Dar es Salaam'],
        );

        return $db->lastInsertId();
    }

    /**
     * Creates a delivery address owned by the given user.
     *
     * @param array<string,mixed> $attributes
     */
    public static function address(int $userId, array $attributes = []): int
    {
        return TestApplication::make(\Shopio\Repositories\AddressRepository::class)->create($userId, [
            'label' => $attributes['label'] ?? 'Home',
            'recipient_name' => $attributes['recipient_name'] ?? 'Test Recipient',
            'phone' => $attributes['phone'] ?? '+255700000000',
            'city_id' => $attributes['city_id'] ?? self::cityId(),
            'district' => $attributes['district'] ?? null,
            'street_address' => $attributes['street_address'] ?? '123 Test Street',
            'postal_code' => $attributes['postal_code'] ?? null,
            'delivery_instructions' => $attributes['delivery_instructions'] ?? null,
            'is_default' => $attributes['is_default'] ?? true,
        ]);
    }

    /**
     * Starts a real server-managed session and returns the raw bearer token.
     */
    public static function token(int $userId): string
    {
        $session = TestApplication::make(SessionService::class)->start($userId, '127.0.0.1', 'phpunit');

        return (string) $session['token'];
    }

    public static function uniqueEmail(): string
    {
        return 'user_' . bin2hex(random_bytes(6)) . '@example.test';
    }

    public static function uniqueSlug(string $base): string
    {
        $slug = strtolower(trim(preg_replace('/[^a-z0-9]+/i', '-', $base) ?? '', '-'));

        return ($slug === '' ? 'item' : $slug) . '-' . strtolower(bin2hex(random_bytes(3)));
    }
}
