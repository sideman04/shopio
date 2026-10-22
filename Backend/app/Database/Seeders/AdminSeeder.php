<?php

declare(strict_types=1);

namespace Shopio\Database\Seeders;

use Shopio\Database\Database;
use Shopio\Exceptions\ValidationException;
use Shopio\Repositories\RoleRepository;
use Shopio\Repositories\UserRepository;
use Shopio\Services\PasswordHasher;
use Shopio\Support\Str;

/**
 * Trusted administrator provisioning.
 *
 * Public registration can never grant the `admin` role; the only supported way
 * to obtain the first administrator is to run this seeder with deployment-held
 * credentials. It is idempotent: re-running it reconciles the account (ensuring
 * the role and, when asked, the password) rather than creating duplicates.
 */
final class AdminSeeder
{
    /** Rejected outright, regardless of length. */
    private const BANNED_PASSWORDS = [
        'password', 'password123', 'admin', 'admin123', 'administrator',
        'changeme', 'letmein', 'welcome', 'shopio', 'qwerty123', '123456789012',
    ];

    public function __construct(
        private readonly Database $db,
        private readonly UserRepository $users,
        private readonly RoleRepository $roles,
        private readonly PasswordHasher $hasher,
    ) {
    }

    /**
     * @return array{id:int,email:string,created:bool,passwordUpdated:bool,roleGranted:bool}
     */
    public function seed(
        string $email,
        string $password,
        string $fullName = 'Shopio Administrator',
        bool $resetPassword = false,
    ): array {
        $email = Str::normaliseEmail($email);
        if (filter_var($email, FILTER_VALIDATE_EMAIL) === false) {
            throw new ValidationException(['email' => ['A valid email address is required.']]);
        }

        $this->assertStrongPassword($password);

        $roleId = $this->roles->idByCode('admin');
        if ($roleId === null) {
            throw new \RuntimeException("Reference role 'admin' is missing; run the base schema seed first.");
        }

        return $this->db->transaction(function () use ($email, $password, $fullName, $resetPassword, $roleId): array {
            $existing = $this->users->findByEmail($email);

            if ($existing === null) {
                $userId = $this->users->create([
                    'full_name' => $fullName,
                    'email' => $email,
                    'phone' => null,
                    'password_hash' => $this->hasher->hash($password),
                    'status' => 'active',
                    'email_verified_at' => gmdate('Y-m-d H:i:s'),
                ]);

                $this->users->assignRole($userId, $roleId);

                return [
                    'id' => $userId,
                    'email' => $email,
                    'created' => true,
                    'passwordUpdated' => true,
                    'roleGranted' => true,
                ];
            }

            $userId = (int) $existing['id'];

            // Never silently take over a locked-out account.
            if ((string) ($existing['status'] ?? '') === 'disabled') {
                throw new \RuntimeException('Refusing to promote a disabled account; re-enable it first.');
            }

            $roleGranted = false;
            if (!$this->users->hasRole($userId, 'admin')) {
                $this->users->assignRole($userId, $roleId);
                $roleGranted = true;
            }

            $passwordUpdated = false;
            if ($resetPassword) {
                $this->users->updatePassword($userId, $this->hasher->hash($password));
                $passwordUpdated = true;
            }

            return [
                'id' => $userId,
                'email' => $email,
                'created' => false,
                'passwordUpdated' => $passwordUpdated,
                'roleGranted' => $roleGranted,
            ];
        });
    }

    private function assertStrongPassword(string $password): void
    {
        if (strlen($password) < 12) {
            throw new ValidationException(['password' => ['Must be at least 12 characters.']]);
        }

        if (strlen($password) > 200) {
            throw new ValidationException(['password' => ['Must not exceed 200 characters.']]);
        }

        $hasLetter = preg_match('/[A-Za-z]/', $password) === 1;
        $hasDigit = preg_match('/\d/', $password) === 1;
        $hasSymbol = preg_match('/[^A-Za-z0-9]/', $password) === 1;
        if (!$hasLetter || !$hasDigit || !$hasSymbol) {
            throw new ValidationException(['password' => ['Must contain letters, numbers and at least one symbol.']]);
        }

        if (in_array(strtolower($password), self::BANNED_PASSWORDS, true)) {
            throw new ValidationException(['password' => ['This password is too common.']]);
        }
    }
}
