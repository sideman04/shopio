<?php

declare(strict_types=1);

namespace Shopio\Repositories;

use Shopio\Support\Str;

/**
 * Users, user_roles and role lookups.
 */
final class UserRepository extends Repository
{
    /**
     * @return array<string,mixed>|null
     */
    public function findByEmail(string $email): ?array
    {
        return $this->db->selectOne(
            'SELECT id, full_name, email, phone, password_hash, status, email_verified_at,
                    phone_verified_at, last_login_at, created_at, updated_at, deleted_at
             FROM users WHERE email = :email LIMIT 1',
            ['email' => Str::normaliseEmail($email)],
        );
    }

    /**
     * @return array<string,mixed>|null
     */
    public function findById(int $id): ?array
    {
        return $this->db->selectOne(
            'SELECT id, full_name, email, phone, password_hash, status, email_verified_at,
                    phone_verified_at, last_login_at, created_at, updated_at, deleted_at
             FROM users WHERE id = :id LIMIT 1',
            ['id' => $id],
        );
    }

    public function emailExists(string $email): bool
    {
        return $this->db->scalar(
            'SELECT 1 FROM users WHERE email = :email LIMIT 1',
            ['email' => Str::normaliseEmail($email)],
        ) !== null;
    }

    public function phoneExists(string $phone): bool
    {
        return $this->db->scalar(
            'SELECT 1 FROM users WHERE phone = :phone LIMIT 1',
            ['phone' => $phone],
        ) !== null;
    }

    /**
     * @param array{full_name:string,email:string,phone:?string,password_hash:string,status:string,email_verified_at:?string} $data
     */
    public function create(array $data): int
    {
        $this->db->execute(
            'INSERT INTO users (full_name, email, phone, password_hash, status, email_verified_at)
             VALUES (:full_name, :email, :phone, :password_hash, :status, :email_verified_at)',
            [
                'full_name' => $data['full_name'],
                'email' => Str::normaliseEmail($data['email']),
                'phone' => $data['phone'],
                'password_hash' => $data['password_hash'],
                'status' => $data['status'],
                'email_verified_at' => $data['email_verified_at'],
            ],
        );

        return $this->db->lastInsertId();
    }

    /**
     * Explicit allowlist: prevents mass assignment of `status`, `password_hash`
     * or `email` through a profile update.
     *
     * @param array{full_name?:string,phone?:?string} $fields
     */
    public function updateProfile(int $userId, array $fields): void
    {
        $sets = [];
        $params = ['id' => $userId];

        if (array_key_exists('full_name', $fields)) {
            $sets[] = 'full_name = :full_name';
            $params['full_name'] = $fields['full_name'];
        }

        if (array_key_exists('phone', $fields)) {
            $sets[] = 'phone = :phone';
            $params['phone'] = $fields['phone'];
        }

        if ($sets === []) {
            return;
        }

        $this->db->execute('UPDATE users SET ' . implode(', ', $sets) . ' WHERE id = :id', $params);
    }

    public function updatePassword(int $userId, string $hash): void
    {
        $this->db->execute(
            'UPDATE users SET password_hash = :hash WHERE id = :id',
            ['hash' => $hash, 'id' => $userId],
        );
    }

    public function markEmailVerified(int $userId): void
    {
        $this->db->execute(
            'UPDATE users SET email_verified_at = UTC_TIMESTAMP(),
                    status = CASE WHEN status = \'pending\' THEN \'active\' ELSE status END
             WHERE id = :id AND email_verified_at IS NULL',
            ['id' => $userId],
        );
    }

    public function markPhoneVerified(int $userId, string $phone): void
    {
        $this->db->execute(
            'UPDATE users SET phone = :phone, phone_verified_at = UTC_TIMESTAMP() WHERE id = :id',
            ['phone' => $phone, 'id' => $userId],
        );
    }

    public function touchLastLogin(int $userId): void
    {
        $this->db->execute('UPDATE users SET last_login_at = UTC_TIMESTAMP() WHERE id = :id', ['id' => $userId]);
    }

    public function setStatus(int $userId, string $status): void
    {
        $this->db->execute('UPDATE users SET status = :status WHERE id = :id', ['status' => $status, 'id' => $userId]);
    }

    /**
     * @return list<string>
     */
    public function roleCodes(int $userId): array
    {
        $rows = $this->db->select(
            'SELECT r.code FROM user_roles ur JOIN roles r ON r.id = ur.role_id WHERE ur.user_id = :id ORDER BY r.id',
            ['id' => $userId],
        );

        return array_map(static fn (array $row): string => (string) $row['code'], $rows);
    }

    public function hasRole(int $userId, string $roleCode): bool
    {
        return $this->db->scalar(
            'SELECT 1 FROM user_roles ur JOIN roles r ON r.id = ur.role_id
             WHERE ur.user_id = :id AND r.code = :code LIMIT 1',
            ['id' => $userId, 'code' => $roleCode],
        ) !== null;
    }

    public function assignRole(int $userId, int $roleId, ?int $assignedBy = null): void
    {
        $this->db->execute(
            'INSERT INTO user_roles (user_id, role_id, assigned_by) VALUES (:user_id, :role_id, :assigned_by)
             ON DUPLICATE KEY UPDATE assigned_by = VALUES(assigned_by)',
            ['user_id' => $userId, 'role_id' => $roleId, 'assigned_by' => $assignedBy],
        );
    }

    public function removeRole(int $userId, int $roleId): void
    {
        $this->db->execute(
            'DELETE FROM user_roles WHERE user_id = :user_id AND role_id = :role_id',
            ['user_id' => $userId, 'role_id' => $roleId],
        );
    }

    /**
     * @param array<string,mixed> $filters
     * @return array{rows:list<array<string,mixed>>,total:int}
     */
    public function paginate(array $filters, int $page, int $perPage): array
    {
        $where = ['u.deleted_at IS NULL'];
        $params = [];

        if (!empty($filters['q'])) {
            $where[] = '(u.full_name LIKE :q OR u.email LIKE :q)';
            $params['q'] = '%' . str_replace(['%', '_'], ['\\%', '\\_'], (string) $filters['q']) . '%';
        }

        if (!empty($filters['status'])) {
            $where[] = 'u.status = :status';
            $params['status'] = (string) $filters['status'];
        }

        if (!empty($filters['role'])) {
            $where[] = 'EXISTS (SELECT 1 FROM user_roles ur2 JOIN roles r2 ON r2.id = ur2.role_id
                              WHERE ur2.user_id = u.id AND r2.code = :role)';
            $params['role'] = (string) $filters['role'];
        }

        $whereSql = implode(' AND ', $where);
        [$limit, $offset] = $this->window($page, $perPage);

        $total = (int) $this->db->scalar("SELECT COUNT(*) FROM users u WHERE {$whereSql}", $params);

        $rows = $this->db->select(
            "SELECT u.id, u.full_name, u.email, u.phone, u.status, u.email_verified_at,
                    u.last_login_at, u.created_at,
                    (SELECT GROUP_CONCAT(r.code ORDER BY r.id) FROM user_roles ur JOIN roles r ON r.id = ur.role_id
                     WHERE ur.user_id = u.id) AS roles
             FROM users u
             WHERE {$whereSql}
             ORDER BY u.created_at DESC, u.id DESC
             LIMIT {$limit} OFFSET {$offset}",
            $params,
        );

        return ['rows' => $rows, 'total' => $total];
    }

    public function countAll(): int
    {
        return (int) $this->db->scalar('SELECT COUNT(*) FROM users WHERE deleted_at IS NULL');
    }

    public function countByRole(string $roleCode): int
    {
        return (int) $this->db->scalar(
            'SELECT COUNT(DISTINCT ur.user_id) FROM user_roles ur JOIN roles r ON r.id = ur.role_id
             WHERE r.code = :code',
            ['code' => $roleCode],
        );
    }

    public function countCreatedSince(string $sinceUtc): int
    {
        return (int) $this->db->scalar(
            'SELECT COUNT(*) FROM users WHERE created_at >= :since AND deleted_at IS NULL',
            ['since' => $sinceUtc],
        );
    }
}
