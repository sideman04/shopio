<?php

declare(strict_types=1);

namespace Shopio\Services;

use Shopio\Auth\AuthenticatedUser;
use Shopio\Database\Database;
use Shopio\Exceptions\ConflictException;
use Shopio\Exceptions\NotFoundException;
use Shopio\Exceptions\ValidationException;
use Shopio\Http\Request;
use Shopio\Repositories\AddressRepository;
use Shopio\Repositories\GeoRepository;
use Shopio\Repositories\UserRepository;
use Shopio\Support\Presenter;
use Shopio\Support\Str;

/**
 * Customer profile and delivery address book. Every mutation is scoped to the
 * authenticated user id at the repository layer.
 */
final class ProfileService
{
    public function __construct(
        private readonly UserRepository $users,
        private readonly AddressRepository $addresses,
        private readonly GeoRepository $geo,
        private readonly AuthService $auth,
        private readonly AuditService $audit,
        private readonly Database $db,
    ) {
    }

    /**
     * @return array<string,mixed>
     */
    public function profile(AuthenticatedUser $auth): array
    {
        return $this->auth->me($auth);
    }

    /**
     * @param array<string,mixed> $data
     * @return array<string,mixed>
     */
    public function updateProfile(AuthenticatedUser $auth, array $data, Request $request): array
    {
        $fields = [];

        if (array_key_exists('full_name', $data)) {
            $fields['full_name'] = (string) $data['full_name'];
        }

        if (array_key_exists('phone', $data)) {
            $phone = Str::normalisePhone($data['phone']);
            if ($phone !== null && $this->users->phoneExists($phone)) {
                $existing = $this->users->findById($auth->id);
                if (($existing['phone'] ?? null) !== $phone) {
                    throw new ConflictException('This phone number is already in use.');
                }
            }
            $fields['phone'] = $phone;
        }

        if ($fields !== []) {
            $this->users->updateProfile($auth->id, $fields);
            $this->audit->record($auth, 'profile.updated', 'user', $auth->id, $request, ['fields' => array_keys($fields)]);
        }

        return $this->auth->me($auth);
    }

    /**
     * @return list<array<string,mixed>>
     */
    public function addresses(AuthenticatedUser $auth): array
    {
        return array_map(
            [Presenter::class, 'address'],
            $this->addresses->listForUser($auth->id),
        );
    }

    /**
     * @param array<string,mixed> $data
     * @return array<string,mixed>
     */
    public function createAddress(AuthenticatedUser $auth, array $data, Request $request): array
    {
        $this->assertCityExists((int) $data['city_id']);

        $addressId = $this->db->transaction(function () use ($auth, $data): int {
            $isDefault = !empty($data['is_default']) || $this->addresses->countForUser($auth->id) === 0;
            if ($isDefault) {
                $this->addresses->clearDefault($auth->id);
            }

            return $this->addresses->create($auth->id, $data + ['is_default' => $isDefault]);
        });

        $this->audit->record($auth, 'address.created', 'address', $addressId, $request);

        return Presenter::address($this->addresses->findOwned($addressId, $auth->id) ?? []);
    }

    /**
     * @param array<string,mixed> $data
     * @return array<string,mixed>
     */
    public function updateAddress(AuthenticatedUser $auth, int $addressId, array $data, Request $request): array
    {
        $existing = $this->addresses->findOwned($addressId, $auth->id);
        if ($existing === null) {
            throw new NotFoundException('The requested address does not exist.');
        }

        if (array_key_exists('city_id', $data)) {
            $this->assertCityExists((int) $data['city_id']);
        }

        $this->db->transaction(function () use ($auth, $addressId, $data): void {
            if (!empty($data['is_default'])) {
                $this->addresses->clearDefault($auth->id, $addressId);
            }
            $this->addresses->update($addressId, $auth->id, $data);
        });

        $this->audit->record($auth, 'address.updated', 'address', $addressId, $request);

        return Presenter::address($this->addresses->findOwned($addressId, $auth->id) ?? []);
    }

    public function deleteAddress(AuthenticatedUser $auth, int $addressId, Request $request): void
    {
        $deleted = $this->addresses->delete($addressId, $auth->id);
        if (!$deleted) {
            throw new NotFoundException('The requested address does not exist.');
        }

        $this->audit->record($auth, 'address.deleted', 'address', $addressId, $request);
    }

    private function assertCityExists(int $cityId): void
    {
        if ($this->geo->cityWithRegion($cityId) === null) {
            throw new ValidationException(['city_id' => ['The selected city does not exist.']]);
        }
    }
}
