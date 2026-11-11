<?php

declare(strict_types=1);

namespace Shopio\Controllers;

use PDOException;
use Shopio\Config\Config;
use Shopio\Database\Database;
use Shopio\Exceptions\ConfigException;
use Shopio\Exceptions\HttpException;
use Shopio\Http\Request;
use Shopio\Http\Response;

final class MonitoringController extends Controller
{
    private const LOG_READ_LIMIT = 262144;

    public function __construct(private readonly Database $database)
    {
    }

    public function show(Request $request): Response
    {
        $databaseStartedAt = hrtime(true);
        try {
            $statement = $this->database->pdo()->query('SELECT 1');
            $databaseOk = $statement !== false && (string) $statement->fetchColumn() === '1';
        } catch (PDOException | HttpException | ConfigException) {
            $databaseOk = false;
        }

        $databaseStatus = $databaseOk ? 'healthy' : 'error';
        $logDirectory = Config::get('LOG_DIR', 'storage/logs') ?? 'storage/logs';
        if (!str_starts_with($logDirectory, '/')) {
            $logDirectory = rtrim(Config::rootDir(), '/') . '/' . $logDirectory;
        }
        $logsOk = is_dir($logDirectory) && is_readable($logDirectory) && is_writable($logDirectory);
        $logData = $logsOk ? $this->readRecentLogs($logDirectory) : [
            'warningsLastHour' => 0,
            'failuresLastHour' => 0,
            'recentFailures' => [],
        ];

        $loadAverage = function_exists('sys_getloadavg') ? sys_getloadavg() : false;
        $loadAverage = is_array($loadAverage)
            ? array_map(static fn (float $load): float => round($load, 2), $loadAverage)
            : null;

        $checks = [
            [
                'key' => 'api',
                'label' => 'Application API',
                'status' => 'healthy',
                'detail' => 'The monitoring endpoint responded successfully.',
            ],
            [
                'key' => 'database',
                'label' => 'Database',
                'status' => $databaseStatus,
                'detail' => $databaseOk ? 'Database connection and query succeeded.' : 'Database connection or query failed.',
                'responseTimeMs' => round((hrtime(true) - $databaseStartedAt) / 1_000_000, 1),
            ],
            [
                'key' => 'logs',
                'label' => 'Error log storage',
                'status' => $logsOk ? 'healthy' : 'error',
                'detail' => $logsOk ? 'Log directory is readable and writable.' : 'Log directory is missing or unavailable.',
            ],
        ];
        $status = $databaseOk && $logsOk ? 'healthy' : 'degraded';

        return $this->success([
            'status' => $status,
            'checkedAt' => gmdate('c'),
            'checks' => $checks,
            'runtime' => [
                'phpVersion' => PHP_VERSION,
                'memoryUsageBytes' => memory_get_usage(true),
                'peakMemoryUsageBytes' => memory_get_peak_usage(true),
                'memoryLimitBytes' => $this->memoryLimitBytes((string) ini_get('memory_limit')),
                'loadAverage' => $loadAverage,
            ],
            'logs' => $logData,
        ], 'System monitoring snapshot retrieved', 200, [], $request);
    }

    /**
     * @return array{warningsLastHour:int,failuresLastHour:int,recentFailures:list<array<string,mixed>>}
     */
    private function readRecentLogs(string $directory): array
    {
        $now = time();
        $hourAgo = $now - 3600;
        $dayAgo = $now - 86400;
        $warningsLastHour = 0;
        $failuresLastHour = 0;
        $recentFailures = [];
        $dates = [gmdate('Y-m-d', $now), gmdate('Y-m-d', $now - 86400)];

        foreach ($dates as $date) {
            $path = $directory . '/app-' . $date . '.log';
            if (!is_file($path) || !is_readable($path)) {
                continue;
            }

            $size = filesize($path);
            if ($size === false || $size === 0) {
                continue;
            }

            $handle = fopen($path, 'rb');
            if ($handle === false) {
                continue;
            }

            $offset = max(0, $size - self::LOG_READ_LIMIT);
            if ($offset > 0) {
                fseek($handle, $offset);
                fgets($handle);
            }

            while (($line = fgets($handle)) !== false) {
                $entry = json_decode($line, true);
                if (!is_array($entry) || !is_string($entry['time'] ?? null)) {
                    continue;
                }

                $timestamp = strtotime($entry['time']);
                if ($timestamp === false || $timestamp < $dayAgo || $timestamp > $now + 60) {
                    continue;
                }

                $level = strtolower((string) ($entry['level'] ?? ''));
                if ($timestamp >= $hourAgo && $level === 'warning') {
                    $warningsLastHour++;
                }
                if ($timestamp >= $hourAgo && in_array($level, ['error', 'critical'], true)) {
                    $failuresLastHour++;
                }
                if (!in_array($level, ['error', 'critical'], true)) {
                    continue;
                }

                $context = is_array($entry['context'] ?? null) ? $entry['context'] : [];
                $file = is_string($context['file'] ?? null) ? $context['file'] : '';
                $recentFailures[] = [
                    'time' => gmdate('c', $timestamp),
                    'level' => $level,
                    'summary' => substr((string) ($entry['message'] ?? 'Server error'), 0, 180),
                    'exception' => is_string($context['exception'] ?? null) ? $context['exception'] : null,
                    'source' => $file !== '' ? basename($file) : null,
                    'requestId' => is_string($context['request_id'] ?? null) ? $context['request_id'] : null,
                ];
            }

            fclose($handle);
        }

        usort(
            $recentFailures,
            static fn (array $left, array $right): int => strcmp($right['time'], $left['time']),
        );

        return [
            'warningsLastHour' => $warningsLastHour,
            'failuresLastHour' => $failuresLastHour,
            'recentFailures' => array_slice($recentFailures, 0, 20),
        ];
    }

    private function memoryLimitBytes(string $limit): ?int
    {
        if ($limit === '' || $limit === '-1') {
            return null;
        }

        $unit = strtolower(substr($limit, -1));
        $value = (int) $limit;

        return match ($unit) {
            'g' => $value * 1024 * 1024 * 1024,
            'm' => $value * 1024 * 1024,
            'k' => $value * 1024,
            default => is_numeric($limit) ? (int) $limit : null,
        };
    }
}
