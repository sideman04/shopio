<?php

declare(strict_types=1);

namespace Shopio\Repositories;

/**
 * Role lookups (the `roles` lookup table).
 */
final class RoleRepository extends Repository
{
    /**
     * @return list<array<string,mixed>>
     */
    public function all(): array
    {
        return $this->db->select('SELECT id, code, label FROM roles ORDER BY id');
    }

    public function idByCode(string $code): ?int
    {
        $id = $this->db->scalar('SELECT id FROM roles WHERE code = :code LIMIT 1', ['code' => $code]);

        return $id === null ? null : (int) $id;
    }

    /**
     * Resolves role codes to ids, ignoring unknown codes.
     *
     * @param list<string> $codes
     * @return array<string,int>
     */
    public function idsByCodes(array $codes): array
    {
        $map = [];
        $rows = $this->db->select('SELECT id, code FROM roles');
        foreach ($rows as $row) {
            $map[(string) $row['code']] = (int) $row['id'];
        }

        $resolved = [];
        foreach ($codes as $code) {
            if (isset($map[$code])) {
                $resolved[$code] = $map[$code];
            }
        }

        return $resolved;
    }
}
