<?php

declare(strict_types=1);

namespace Shopio\Repositories;

/**
 * Product categories (self-referencing tree).
 */
final class CategoryRepository extends Repository
{
    /**
     * @return list<array<string,mixed>>
     */
    public function publicList(): array
    {
        return $this->db->select(
            "SELECT c.id, c.parent_id, c.name, c.slug, c.description, c.image_url, c.sort_order, c.status,
                    (SELECT COUNT(*) FROM products p
                      WHERE p.category_id = c.id AND p.status = 'active' AND p.deleted_at IS NULL) AS product_count
             FROM categories c
             WHERE c.status = 'active'
             ORDER BY c.sort_order, c.name",
        );
    }

    /**
     * @return list<array<string,mixed>>
     */
    public function allForAdmin(): array
    {
        return $this->db->select(
            "SELECT c.id, c.parent_id, c.name, c.slug, c.description, c.image_url, c.sort_order, c.status,
                    c.created_at, c.updated_at,
                    (SELECT COUNT(*) FROM products p WHERE p.category_id = c.id AND p.deleted_at IS NULL) AS product_count
             FROM categories c
             ORDER BY c.sort_order, c.name",
        );
    }

    /**
     * @return array<string,mixed>|null
     */
    public function findById(int $id): ?array
    {
        return $this->db->selectOne(
            'SELECT id, parent_id, name, slug, description, image_url, sort_order, status, created_at, updated_at
             FROM categories WHERE id = :id LIMIT 1',
            ['id' => $id],
        );
    }

    /**
     * @return array<string,mixed>|null
     */
    public function findActiveBySlug(string $slug): ?array
    {
        return $this->db->selectOne(
            "SELECT id, parent_id, name, slug, description, image_url, sort_order, status
             FROM categories WHERE slug = :slug AND status = 'active' LIMIT 1",
            ['slug' => $slug],
        );
    }

    public function slugExists(string $slug, ?int $exceptId = null): bool
    {
        $sql = 'SELECT 1 FROM categories WHERE slug = :slug';
        $params = ['slug' => $slug];

        if ($exceptId !== null) {
            $sql .= ' AND id <> :except';
            $params['except'] = $exceptId;
        }

        return $this->db->scalar($sql . ' LIMIT 1', $params) !== null;
    }

    public function exists(int $id): bool
    {
        return $this->db->scalar('SELECT 1 FROM categories WHERE id = :id LIMIT 1', ['id' => $id]) !== null;
    }

    public function create(array $data): int
    {
        $this->db->execute(
            'INSERT INTO categories (parent_id, name, slug, description, image_url, sort_order, status)
             VALUES (:parent_id, :name, :slug, :description, :image_url, :sort_order, :status)',
            [
                'parent_id' => $data['parent_id'] ?? null,
                'name' => $data['name'],
                'slug' => $data['slug'],
                'description' => $data['description'] ?? null,
                'image_url' => $data['image_url'] ?? null,
                'sort_order' => (int) ($data['sort_order'] ?? 0),
                'status' => $data['status'] ?? 'active',
            ],
        );

        return $this->db->lastInsertId();
    }

    /**
     * @param array<string,mixed> $data
     */
    public function update(int $id, array $data): void
    {
        $allowed = ['parent_id', 'name', 'slug', 'description', 'image_url', 'sort_order', 'status'];
        $sets = [];
        $params = ['id' => $id];

        foreach ($allowed as $column) {
            if (!array_key_exists($column, $data)) {
                continue;
            }
            $sets[] = "{$column} = :{$column}";
            $params[$column] = $data[$column];
        }

        if ($sets === []) {
            return;
        }

        $this->db->execute('UPDATE categories SET ' . implode(', ', $sets) . ' WHERE id = :id', $params);
    }

    public function delete(int $id): void
    {
        $this->db->execute('DELETE FROM categories WHERE id = :id', ['id' => $id]);
    }

    public function hasChildren(int $id): bool
    {
        return $this->db->scalar('SELECT 1 FROM categories WHERE parent_id = :id LIMIT 1', ['id' => $id]) !== null;
    }

    public function childIds(int $id): array
    {
        $rows = $this->db->select('SELECT id FROM categories WHERE parent_id = :id', ['id' => $id]);

        return array_map(static fn (array $row): int => (int) $row['id'], $rows);
    }
}
