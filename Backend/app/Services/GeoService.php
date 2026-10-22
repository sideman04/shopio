<?php

declare(strict_types=1);

namespace Shopio\Services;

use Shopio\Exceptions\NotFoundException;
use Shopio\Repositories\GeoRepository;

/**
 * Reference geography reads (countries, regions, cities).
 */
final class GeoService
{
    public function __construct(private readonly GeoRepository $geo)
    {
    }

    /**
     * @return list<array<string,mixed>>
     */
    public function countries(): array
    {
        return array_map(
            static fn (array $row): array => ['code' => (string) $row['code'], 'name' => (string) $row['name']],
            $this->geo->countries(),
        );
    }

    /**
     * @return list<array<string,mixed>>
     */
    public function regions(?string $countryCode): array
    {
        return array_map(
            static fn (array $row): array => [
                'id' => (int) $row['id'],
                'countryCode' => (string) $row['country_code'],
                'name' => (string) $row['name'],
            ],
            $this->geo->regions($countryCode),
        );
    }

    /**
     * @return list<array<string,mixed>>
     */
    public function cities(?int $regionId): array
    {
        return array_map(
            static fn (array $row): array => [
                'id' => (int) $row['id'],
                'regionId' => (int) $row['region_id'],
                'name' => (string) $row['name'],
                'regionName' => $row['region_name'] ?? null,
                'countryCode' => $row['country_code'] ?? null,
            ],
            $this->geo->cities($regionId),
        );
    }

    /**
     * @return array<string,mixed>
     */
    public function city(int $cityId): array
    {
        $city = $this->geo->cityWithRegion($cityId);
        if ($city === null) {
            throw new NotFoundException('The requested city does not exist.');
        }

        return [
            'id' => (int) $city['id'],
            'name' => (string) $city['city_name'],
            'regionId' => (int) $city['region_id'],
            'regionName' => (string) $city['region_name'],
            'countryCode' => (string) $city['country_code'],
        ];
    }
}
