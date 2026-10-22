<?php

declare(strict_types=1);

namespace Shopio\Tests\Feature;

use Shopio\Database\Seeders\AdminSeeder;
use Shopio\Exceptions\ValidationException;
use Shopio\Repositories\UserRepository;
use Shopio\Services\PasswordHasher;
use Shopio\Tests\Support\Factory;
use Shopio\Tests\Support\TestApplication;
use Shopio\Tests\TestCase;

/**
 * Trusted administrator provisioning.
 *
 * These tests pin the only path that may grant the admin role, and confirm that
 * public registration still cannot reach it (asserted in {@see AuthTest}).
 */
final class AdminSeederTest extends TestCase
{
    private const STRONG = 'Str0ng-Passw0rd!';

    private function seeder(): AdminSeeder
    {
        return TestApplication::make(AdminSeeder::class);
    }

    private function users(): UserRepository
    {
        return TestApplication::make(UserRepository::class);
    }

    public function test_it_creates_an_active_verified_administrator(): void
    {
        $result = $this->seeder()->seed('owner@example.test', self::STRONG, 'Owner');

        $this->assertTrue($result['created']);
        $this->assertTrue($result['roleGranted']);

        $user = $this->users()->findByEmail('owner@example.test');
        $this->assertNotNull($user);
        $this->assertSame('active', $user['status']);
        $this->assertNotNull($user['email_verified_at']);
        $this->assertContains('admin', $this->users()->roleCodes((int) $user['id']));

        $this->assertTrue(TestApplication::make(PasswordHasher::class)->verify(self::STRONG, (string) $user['password_hash']));
    }

    public function test_it_is_idempotent(): void
    {
        $first = $this->seeder()->seed('owner@example.test', self::STRONG);
        $second = $this->seeder()->seed('owner@example.test', self::STRONG);

        $this->assertTrue($first['created']);
        $this->assertFalse($second['created']);
        $this->assertFalse($second['roleGranted']);
        $this->assertFalse($second['passwordUpdated']);
        $this->assertSame($first['id'], $second['id']);

        $this->assertSame(1, (int) TestApplication::make(\Shopio\Database\Database::class)
            ->scalar('SELECT COUNT(*) FROM users WHERE email = :email', ['email' => 'owner@example.test']));
        $this->assertSame(1, (int) TestApplication::make(\Shopio\Database\Database::class)
            ->scalar("SELECT COUNT(*) FROM user_roles ur JOIN users u ON u.id = ur.user_id WHERE u.email = :email", ['email' => 'owner@example.test']));
    }

    public function test_it_refuses_a_weak_password(): void
    {
        $this->expectException(ValidationException::class);
        $this->seeder()->seed('owner@example.test', 'password123');
    }

    public function test_it_refuses_a_password_without_a_symbol(): void
    {
        $this->expectException(ValidationException::class);
        $this->seeder()->seed('owner@example.test', 'LongPassword123');
    }

    public function test_it_refuses_an_invalid_email(): void
    {
        $this->expectException(ValidationException::class);
        $this->seeder()->seed('not-an-email', self::STRONG);
    }

    public function test_it_can_reset_the_password_of_an_existing_admin(): void
    {
        $this->seeder()->seed('owner@example.test', self::STRONG);

        $newPassword = 'Even-Str0nger-Pass!';
        $result = $this->seeder()->seed('owner@example.test', $newPassword, resetPassword: true);

        $this->assertFalse($result['created']);
        $this->assertTrue($result['passwordUpdated']);

        $user = $this->users()->findByEmail('owner@example.test');
        $this->assertNotNull($user);
        $this->assertTrue(TestApplication::make(PasswordHasher::class)->verify($newPassword, (string) $user['password_hash']));
    }

    public function test_it_promotes_an_existing_account_without_touching_the_password(): void
    {
        $existing = Factory::user(['email' => 'staff@example.test']);
        $originalHash = (string) $this->users()->findById((int) $existing['id'])['password_hash'];

        $result = $this->seeder()->seed('staff@example.test', self::STRONG);

        $this->assertFalse($result['created']);
        $this->assertTrue($result['roleGranted']);
        $this->assertFalse($result['passwordUpdated']);
        $this->assertContains('admin', $this->users()->roleCodes((int) $existing['id']));

        $after = $this->users()->findById((int) $existing['id']);
        $this->assertSame($originalHash, (string) $after['password_hash']);
    }

    public function test_it_refuses_to_promote_a_disabled_account(): void
    {
        $disabled = Factory::user(['email' => 'banned@example.test', 'status' => 'disabled']);

        $this->expectException(\RuntimeException::class);
        $this->seeder()->seed('banned@example.test', self::STRONG);

        $this->assertNotContains('admin', $this->users()->roleCodes((int) $disabled['id']));
    }
}
