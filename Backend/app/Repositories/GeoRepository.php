<?php

declare(strict_types=1);

namespace Shopio\Repositories;

/**
 * Reference geography: countries -> regions -> cities.
 */
final class GeoRepository extends Repository
{
    /**
     * @return list<array<string,mixed>>
     */
    public function countries(): array
    {
        return $this->db->select('SELECT code, name FROM countries ORDER BY name');
    }

    /**
     * @return list<array<string,mixed>>
     */
    public function regions(?string $countryCode = null): array
    {
        if ($countryCode === null) {
            return $this->db->select(
                'SELECT r.id, r.country_code, r.name FROM regions r ORDER BY r.name',
            );
        }

        return $this->db->select(
            'SELECT r.id, r.country_code, r.name FROM regions r
             WHERE r.country_code = :code ORDER BY r.name',
            ['code' => strtoupper($countryCode)],
        );
    }

    /**
     * @return list<array<string,mixed>>
     */
    public function cities(?int $regionId = null): array
    {
        if ($regionId === null) {
            return $this->db->select(
                'SELECT c.id, c.region_id, c.name, r.name AS region_name, r.country_code
                 FROM cities c JOIN regions r ON r.id = c.region_id ORDER BY c.name',
            );
        }

        return $this->db->select(
            'SELECT c.id, c.region_id, c.name, r.name AS region_name, r.country_code
             FROM cities c JOIN regions r ON r.id = c.region_id
             WHERE c.region_id = :id ORDER BY c.name',
            ['id' => $regionId],
        );
    }

    /**
     * @return array<string,mixed>|null
     */
    public function cityWithRegion(int $cityId): ?array
    {
        return $this->db->selectOne(
            'SELECT c.id, c.name AS city_name, r.id AS region_id, r.name AS region_name, r.country_code
             FROM cities c JOIN regions r ON r.id = c.region_id
             WHERE c.id = :id LIMIT 1',
            ['id' => $cityId],
        );
    }

    public function findOrCreateRegion(string $countryCode, string $name): int
    {
        $countryCode = strtoupper($countryCode);
        $existing = $this->db->scalar(
            'SELECT id FROM regions WHERE country_code = :code AND name = :name LIMIT 1',
            ['code' => $countryCode, 'name' => $name],
        );

        if ($existing !== null) {
            return (int) $existing;
        }

        $this->db->execute(
            'INSERT INTO regions (country_code, name) VALUES (:code, :name)',
            ['code' => $countryCode, 'name' => $name],
        );

        return $this->db->lastInsertId();
    }

    public function findOrCreateCity(int $regionId, string $name): int
    {
        $existing = $this->db->scalar(
            'SELECT id FROM cities WHERE region_id = :region AND name = :name LIMIT 1',
            ['region' => $regionId, 'name' => $name],
        );

        if ($existing !== null) {
            return (int) $existing;
        }

        $this->db->execute(
            'INSERT INTO cities (region_id, name) VALUES (:region, :name)',
            ['region' => $regionId, 'name' => $name],
        );

        return $this->db->lastInsertId();
    }
}
