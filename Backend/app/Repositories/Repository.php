<?php

declare(strict_types=1);

namespace Shopio\Repositories;

use Shopio\Database\Database;

/**
 * Shared plumbing for data-access classes. Every query uses native prepared
 * statements with bound parameters; identifiers that must be dynamic (sort
 * columns, direction) are validated against a per-repository allowlist before
 * they are interpolated.
 */
abstract class Repository
{
    public function __construct(protected readonly Database $db)
    {
    }

    /**
     * Runs a callback inside a database transaction (delegates to the shared
     * connection so nested repository calls participate in one transaction).
     *
     * @template T
     * @param callable(Database):T $callback
     * @return T
     */
    protected function transaction(callable $callback, int $attempts = 3): mixed
    {
        return $this->db->transaction($callback, $attempts);
    }

    /**
     * Builds a safe `ORDER BY` fragment from a client value using an allowlist.
     *
     * @param array<string,string> $allowedSortMap client key => SQL expression
     */
    protected function orderBy(?string $key, string $direction, array $allowedSortMap, string $defaultKey): string
    {
        $column = $allowedSortMap[$key ?? ''] ?? $allowedSortMap[$defaultKey];
        $dir = strtoupper($direction) === 'ASC' ? 'ASC' : 'DESC';

        return $column . ' ' . $dir;
    }

    /**
     * Pagination window. Values are cast to int, never bound as strings, so the
     * generated LIMIT/OFFSET cannot carry injected content.
     *
     * @return array{0:int,1:int}
     */
    protected function window(int $page, int $perPage): array
    {
        $page = max(1, $page);
        $perPage = max(1, $perPage);

        return [$perPage, ($page - 1) * $perPage];
    }

    /**
     * Nullable integer binding: PDO rejects `null` for a PARAM_INT param in
     * strict drivers, so build a reusable predicate.
     *
     * @return array{0:string,1:array<string,mixed>}
     */
    protected function nullableIntFilter(string $column, mixed $value, string $param): array
    {
        if ($value === null || $value === '') {
            return ['', []];
        }

        return [" AND {$column} = :{$param}", [$param => (int) $value]];
    }

    /**
     * Locks an inventory-aware row for update inside a transaction.
     *
     * @return array<string,mixed>|null
     */
    protected function selectForUpdate(string $sql, array $params = []): ?array
    {
        return $this->db->selectOne($sql . ' FOR UPDATE', $params);
    }
}
