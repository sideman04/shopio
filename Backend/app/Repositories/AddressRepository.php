<?php

declare(strict_types=1);

namespace Shopio\Repositories;

/**
 * Customer delivery addresses. Every read/write is scoped by `user_id` so a
 * customer can never address another customer's rows (IDOR/BOLA defence is in
 * the SQL itself, not only in the service layer).
 */
final class AddressRepository extends Repository
{
    private const SELECT = 'SELECT a.id, a.user_id, a.label, a.recipient_name, a.phone, a.city_id,
                                   a.district, a.street_address, a.postal_code, a.delivery_instructions,
                                   a.is_default, a.created_at, a.updated_at,
                                   c.name AS city_name, r.name AS region_name, r.country_code
                            FROM addresses a
                            JOIN cities c ON c.id = a.city_id
                            JOIN regions r ON r.id = c.region_id';

    /**
     * @return list<array<string,mixed>>
     */
    public function listForUser(int $userId): array
    {
        return $this->db->select(
            self::SELECT . ' WHERE a.user_id = :user_id ORDER BY a.is_default DESC, a.id DESC',
            ['user_id' => $userId],
        );
    }

    /**
     * @return array<string,mixed>|null
     */
    public function findOwned(int $id, int $userId): ?array
    {
        return $this->db->selectOne(
            self::SELECT . ' WHERE a.id = :id AND a.user_id = :user_id LIMIT 1',
            ['id' => $id, 'user_id' => $userId],
        );
    }

    /**
     * @return array<string,mixed>|null
     */
    public function findOwnedForUpdate(int $id, int $userId): ?array
    {
        return $this->db->selectOne(
            'SELECT id, user_id, is_default FROM addresses
             WHERE id = :id AND user_id = :user_id LIMIT 1 FOR UPDATE',
            ['id' => $id, 'user_id' => $userId],
        );
    }

    public function countForUser(int $userId): int
    {
        return (int) $this->db->scalar('SELECT COUNT(*) FROM addresses WHERE user_id = :user_id', ['user_id' => $userId]);
    }

    /**
     * @param array<string,mixed> $data
     */
    public function create(int $userId, array $data): int
    {
        $this->db->execute(
            'INSERT INTO addresses
                (user_id, label, recipient_name, phone, city_id, district, street_address,
                 postal_code, delivery_instructions, is_default)
             VALUES
                (:user_id, :label, :recipient_name, :phone, :city_id, :district, :street_address,
                 :postal_code, :delivery_instructions, :is_default)',
            [
                'user_id' => $userId,
                'label' => $data['label'] ?? null,
                'recipient_name' => $data['recipient_name'],
                'phone' => $data['phone'],
                'city_id' => (int) $data['city_id'],
                'district' => $data['district'] ?? null,
                'street_address' => $data['street_address'],
                'postal_code' => $data['postal_code'] ?? null,
                'delivery_instructions' => $data['delivery_instructions'] ?? null,
                'is_default' => !empty($data['is_default']) ? 1 : 0,
            ],
        );

        return $this->db->lastInsertId();
    }

    /**
     * Explicit allowlist of updatable columns.
     *
     * @param array<string,mixed> $data
     */
    public function update(int $id, int $userId, array $data): bool
    {
        $allowed = [
            'label', 'recipient_name', 'phone', 'city_id', 'district',
            'street_address', 'postal_code', 'delivery_instructions', 'is_default',
        ];

        $sets = [];
        $params = ['id' => $id, 'user_id' => $userId];

        foreach ($allowed as $column) {
            if (!array_key_exists($column, $data)) {
                continue;
            }

            $sets[] = "{$column} = :{$column}";
            $params[$column] = $column === 'city_id'
                ? (int) $data[$column]
                : ($column === 'is_default' ? (!empty($data[$column]) ? 1 : 0) : $data[$column]);
        }

        if ($sets === []) {
            return false;
        }

        $statement = $this->db->execute(
            'UPDATE addresses SET ' . implode(', ', $sets) . ' WHERE id = :id AND user_id = :user_id',
            $params,
        );

        return $this->db->affectedRows($statement) >= 0;
    }

    public function delete(int $id, int $userId): bool
    {
        $statement = $this->db->execute(
            'DELETE FROM addresses WHERE id = :id AND user_id = :user_id',
            ['id' => $id, 'user_id' => $userId],
        );

        return $this->db->affectedRows($statement) > 0;
    }

    public function clearDefault(int $userId, ?int $exceptId = null): void
    {
        $sql = 'UPDATE addresses SET is_default = 0 WHERE user_id = :user_id AND is_default = 1';
        $params = ['user_id' => $userId];

        if ($exceptId !== null) {
            $sql .= ' AND id <> :except';
            $params['except'] = $exceptId;
        }

        $this->db->execute($sql, $params);
    }

    public function setDefault(int $id, int $userId): void
    {
        $this->db->execute(
            'UPDATE addresses SET is_default = 1 WHERE id = :id AND user_id = :user_id',
            ['id' => $id, 'user_id' => $userId],
        );
    }

    public function defaultForUser(int $userId): ?array
    {
        return $this->db->selectOne(
            self::SELECT . ' WHERE a.user_id = :user_id ORDER BY a.is_default DESC, a.id ASC LIMIT 1',
            ['user_id' => $userId],
        );
    }
}
