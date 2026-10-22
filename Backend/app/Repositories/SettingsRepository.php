<?php

declare(strict_types=1);

namespace Shopio\Repositories;

/**
 * Key/value site settings (value column is JSON).
 */
final class SettingsRepository extends Repository
{
    /**
     * @return array<string,mixed>
     */
    public function all(): array
    {
        $rows = $this->db->select('SELECT setting_key, setting_value, description, updated_at FROM site_settings ORDER BY setting_key');

        $settings = [];
        foreach ($rows as $row) {
            $decoded = json_decode((string) $row['setting_value'], true);
            $settings[(string) $row['setting_key']] = $decoded === null ? $row['setting_value'] : $decoded;
        }

        return $settings;
    }

    public function get(string $key, mixed $default = null): mixed
    {
        $value = $this->db->scalar('SELECT setting_value FROM site_settings WHERE setting_key = :key LIMIT 1', ['key' => $key]);
        if ($value === null) {
            return $default;
        }

        $decoded = json_decode((string) $value, true);

        return $decoded === null ? $default : $decoded;
    }

    public function set(string $key, mixed $value, ?int $updatedBy = null, ?string $description = null): void
    {
        $this->db->execute(
            'INSERT INTO site_settings (setting_key, setting_value, description, updated_by)
             VALUES (:key, :value, :description, :updated_by)
             ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value),
                 description = COALESCE(VALUES(description), description),
                 updated_by = VALUES(updated_by)',
            [
                'key' => $key,
                'value' => json_encode($value, JSON_UNESCAPED_SLASHES | JSON_INVALID_UTF8_SUBSTITUTE),
                'description' => $description,
                'updated_by' => $updatedBy,
            ],
        );
    }

    public function delete(string $key): bool
    {
        return $this->db->affectedRows($this->db->execute(
            'DELETE FROM site_settings WHERE setting_key = :key',
            ['key' => $key],
        )) > 0;
    }
}
