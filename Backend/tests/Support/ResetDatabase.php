<?php

declare(strict_types=1);

namespace Shopio\Tests\Support;

use Shopio\Database\Database;

/**
 * Wipes every domain table between tests and re-seeds the immutable reference
 * data (roles, countries, categories) that the base schema ships with.
 *
 * Uses `DELETE` (not `TRUNCATE`) so the least-privilege application account —
 * which deliberately has no DDL privileges — can reset its own test database.
 */
trait ResetDatabase
{
    protected function resetDatabase(): void
    {
        $db = TestApplication::make(Database::class);
        $pdo = $db->pdo();

        $pdo->exec('SET FOREIGN_KEY_CHECKS=0');

        $tables = $db->select(
            "SELECT TABLE_NAME AS name
             FROM information_schema.TABLES
             WHERE TABLE_SCHEMA = DATABASE() AND TABLE_TYPE = 'BASE TABLE'",
        );

        foreach ($tables as $row) {
            $table = (string) ($row['name'] ?? '');
            if ($table === '' || $table === 'schema_migrations') {
                continue;
            }

            $db->execute('DELETE FROM `' . str_replace('`', '', $table) . '`');
        }

        $pdo->exec('SET FOREIGN_KEY_CHECKS=1');

        $this->seedReferenceData($db);
    }

    private function seedReferenceData(Database $db): void
    {
        $db->execute(
            "INSERT INTO roles (code, label) VALUES
                ('customer', 'Customer'), ('seller', 'Seller'), ('admin', 'Administrator')",
        );

        $db->execute(
            "INSERT INTO countries (code, name) VALUES
                ('TZ', 'Tanzania'), ('KE', 'Kenya'), ('UG', 'Uganda')",
        );

        $db->execute(
            "INSERT INTO categories (name, slug, description, sort_order, status) VALUES
                ('Furniture', 'furniture', 'Furniture for homes and offices', 1, 'active'),
                ('Electronics', 'electronics', 'Electronic devices and accessories', 2, 'active'),
                ('Fashion', 'fashion', 'Clothing and fashion accessories', 3, 'active'),
                ('Home Decor', 'home-decor', 'Decor for living spaces', 4, 'active'),
                ('Accessories', 'accessories', 'Lifestyle accessories', 5, 'active')",
        );
    }
}
