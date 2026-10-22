<?php

declare(strict_types=1);

namespace Shopio\Database;

use PDO;
use PDOException;
use PDOStatement;
use Shopio\Config\Config;
use Shopio\Exceptions\HttpException;
use Shopio\Support\Logger;

/**
 * PDO wrapper: single connection per process, native prepared statements,
 * strict exception handling, UTC session, explicit transaction boundaries and
 * bounded deadlock retries.
 *
 * `public` properties and the raw `pdo()` accessor exist so repositories can
 * issue prepared statements directly; nothing in the application concatenates
 * user input into SQL.
 */
final class Database
{
    private ?PDO $pdo = null;

    /** Nesting depth so nested transaction() calls participate in one transaction. */
    private int $transactionDepth = 0;

    private int $savepointCounter = 0;

    private bool $rollbackOnly = false;

    /** @var array<string,mixed> */
    private array $overrides;

    /**
     * @param array<string,mixed> $overrides Connection overrides (used by tests).
     */
    public function __construct(array $overrides = [])
    {
        $this->overrides = $overrides;
    }

    public function pdo(): PDO
    {
        if ($this->pdo === null) {
            $this->pdo = $this->connect();
        }

        return $this->pdo;
    }

    private function connect(): PDO
    {
        $host = (string) ($this->overrides['host'] ?? Config::get('DB_HOST', '127.0.0.1'));
        $port = (int) ($this->overrides['port'] ?? Config::int('DB_PORT', 3306));
        $database = (string) ($this->overrides['database'] ?? Config::require('DB_DATABASE'));
        $username = (string) ($this->overrides['username'] ?? Config::require('DB_USERNAME'));
        $password = (string) ($this->overrides['password'] ?? Config::get('DB_PASSWORD', ''));
        $charset = (string) ($this->overrides['charset'] ?? Config::get('DB_CHARSET', 'utf8mb4'));
        $emulate = (bool) ($this->overrides['emulate_prepares'] ?? Config::bool('DB_EMULATE_PREPARES', false));

        $dsn = sprintf('mysql:host=%s;port=%d;dbname=%s;charset=%s', $host, $port, $database, $charset);

        // PHP 8.4+ moved these MySQL driver constants onto Pdo\Mysql. Prefer the
        // new location when available so PHP 8.5 builds do not emit deprecations.
        $initCommandAttribute = class_exists(\Pdo\Mysql::class)
            ? \Pdo\Mysql::ATTR_INIT_COMMAND
            : PDO::MYSQL_ATTR_INIT_COMMAND;

        $options = [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_EMULATE_PREPARES => $emulate,
            PDO::ATTR_STRINGIFY_FETCHES => false,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_PERSISTENT => false,
            $initCommandAttribute => "SET time_zone = '+00:00', "
                . "sql_mode = 'STRICT_TRANS_TABLES,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION'",
        ];

        try {
            return new PDO($dsn, $username, $password, $options);
        } catch (PDOException $e) {
            // Never leak credentials or DSN to the client — log and rethrow generic.
            Logger::instance()->critical('Database connection failed', [
                'host' => $host,
                'database' => $database,
                'driver_code' => $e->errorInfo[1] ?? null,
            ]);

            throw new HttpException(500, 'Internal server error.', [], ['db_connect' => true], $e);
        }
    }

    /**
     * Runs `$callback` inside a transaction. Nested calls use savepoints.
     *
     * Deadlocks (1213) and lock-wait timeouts (1205) are retried up to
     * `$attempts` times with a small randomised backoff. The callback must be
     * safe to call more than once.
     *
     * @template T
     * @param callable(self):T $callback
     * @return T
     */
    public function transaction(callable $callback, int $attempts = 3): mixed
    {
        $attempt = 0;
        while (true) {
            $attempt++;
            try {
                return $this->runTransactional($callback);
            } catch (PDOException $e) {
                $driverCode = (int) ($e->errorInfo[1] ?? 0);
                $retryable = in_array($driverCode, [1213, 1205], true);
                if (!$retryable || $attempt >= $attempts) {
                    throw $this->mapPdoException($e);
                }

                Logger::instance()->warning('Transient database conflict, retrying transaction', [
                    'driver_code' => $driverCode,
                    'attempt' => $attempt,
                ]);

                usleep(random_int(20_000, 120_000) * $attempt);
            }
        }
    }

    /**
     * @template T
     * @param callable(self):T $callback
     * @return T
     */
    private function runTransactional(callable $callback): mixed
    {
        $isRoot = $this->transactionDepth === 0;
        $savepoint = null;

        if ($isRoot) {
            $this->rollbackOnly = false;
            $this->pdo()->beginTransaction();
        } else {
            $savepoint = 'sp_' . (++$this->savepointCounter);
            $this->pdo()->exec('SAVEPOINT ' . $savepoint);
        }

        $this->transactionDepth++;

        try {
            $result = $callback($this);

            if ($this->rollbackOnly) {
                throw new HttpException(500, 'Internal server error.', [], ['rollback_only' => true]);
            }

            $this->transactionDepth--;
            if ($isRoot) {
                $this->pdo()->commit();
            } elseif ($savepoint !== null) {
                $this->pdo()->exec('RELEASE SAVEPOINT ' . $savepoint);
            }

            return $result;
        } catch (\Throwable $e) {
            $this->transactionDepth--;

            try {
                if ($isRoot) {
                    if ($this->pdo()->inTransaction()) {
                        $this->pdo()->rollBack();
                    }
                } elseif ($savepoint !== null) {
                    $this->pdo()->exec('ROLLBACK TO SAVEPOINT ' . $savepoint);
                }
            } catch (PDOException) {
                // Connection is likely gone; nothing further can be done here.
            }

            throw $e;
        }
    }

    public function inTransaction(): bool
    {
        return $this->pdo()->inTransaction();
    }

    /**
     * Marks the current transaction as failed. Any outer transaction() call will
     * roll back even if the callback returns normally.
     */
    public function markRollbackOnly(): void
    {
        $this->rollbackOnly = true;
    }

    /**
     * Prepared statement shim.
     *
     * @param array<string|int,mixed> $params Named or positional parameters.
     */
    public function execute(string $sql, array $params = []): PDOStatement
    {
        [$sql, $params] = $this->expandRepeatedPlaceholders($sql, $params);

        $statement = $this->pdo()->prepare($sql);
        foreach ($params as $key => $value) {
            $paramKey = is_int($key) ? $key + 1 : $key;
            $type = match (true) {
                is_int($value) => PDO::PARAM_INT,
                is_bool($value) => PDO::PARAM_BOOL,
                $value === null => PDO::PARAM_NULL,
                default => PDO::PARAM_STR,
            };
            $statement->bindValue($paramKey, $value, $type);
        }

        $statement->execute();

        return $statement;
    }

    /**
     * Rewrites repeated named placeholders into unique ones.
     *
     * With native (non-emulated) prepares MariaDB/MySQL does not allow the same
     * named parameter to be used more than once in a statement (it raises
     * "Invalid parameter number", SQLSTATE HY093). Several search queries reuse
     * `:q` across multiple LIKE columns; rather than weaken the driver with
     * emulation, we duplicate the bound value under a fresh name here.
     *
     * Only occurrences outside string literals are considered so a colon inside
     * a quoted value (e.g. a time format) is left untouched.
     *
     * @param array<string|int,mixed> $params
     * @return array{0:string,1:array<string|int,mixed>}
     */
    private function expandRepeatedPlaceholders(string $sql, array $params): array
    {
        $hasNamed = false;
        foreach (array_keys($params) as $key) {
            if (is_string($key)) {
                $hasNamed = true;
                break;
            }
        }

        if (!$hasNamed || !str_contains($sql, ':')) {
            return [$sql, $params];
        }

        $out = '';
        $length = strlen($sql);
        $counts = [];
        $quote = null;
        $i = 0;

        while ($i < $length) {
            $char = $sql[$i];

            if ($quote !== null) {
                $out .= $char;
                if ($char === '\\' && $i + 1 < $length) {
                    $out .= $sql[$i + 1];
                    $i += 2;
                    continue;
                }
                if ($char === $quote) {
                    if ($i + 1 < $length && $sql[$i + 1] === $quote) {
                        $out .= $quote;
                        $i += 2;
                        continue;
                    }
                    $quote = null;
                }
                $i++;
                continue;
            }

            if ($char === "'" || $char === '"') {
                $quote = $char;
                $out .= $char;
                $i++;
                continue;
            }

            if ($char === ':') {
                // Skip `::` casts and lone colons.
                if (($i > 0 && $sql[$i - 1] === ':') || $i + 1 >= $length
                    || preg_match('/[A-Za-z_]/', $sql[$i + 1]) !== 1) {
                    $out .= $char;
                    $i++;
                    continue;
                }

                $j = $i + 1;
                $name = '';
                while ($j < $length && preg_match('/[A-Za-z0-9_]/', $sql[$j]) === 1) {
                    $name .= $sql[$j];
                    $j++;
                }

                if (array_key_exists($name, $params)) {
                    $counts[$name] = ($counts[$name] ?? 0) + 1;
                    if ($counts[$name] === 1) {
                        $out .= ':' . $name;
                    } else {
                        $unique = $name . '__dup' . $counts[$name];
                        $params[$unique] = $params[$name];
                        $out .= ':' . $unique;
                    }
                } else {
                    $out .= ':' . $name;
                }

                $i = $j;
                continue;
            }

            $out .= $char;
            $i++;
        }

        return [$out, $params];
    }

    /**
     * @param array<string|int,mixed> $params
     */
    public function selectOne(string $sql, array $params = []): ?array
    {
        $row = $this->execute($sql, $params)->fetch();

        return $row === false ? null : $row;
    }

    /**
     * @param array<string|int,mixed> $params
     * @return list<array<string,mixed>>
     */
    public function select(string $sql, array $params = []): array
    {
        /** @var list<array<string,mixed>> $rows */
        $rows = $this->execute($sql, $params)->fetchAll();

        return $rows;
    }

    /**
     * @param array<string|int,mixed> $params
     */
    public function scalar(string $sql, array $params = []): mixed
    {
        $value = $this->execute($sql, $params)->fetchColumn();

        return $value === false ? null : $value;
    }

    public function lastInsertId(): int
    {
        return (int) $this->pdo()->lastInsertId();
    }

    public function affectedRows(PDOStatement $statement): int
    {
        return $statement->rowCount();
    }

    /**
     * Converts low-level driver errors into safe, mapped HTTP exceptions while
     * preserving the original for internal logs.
     */
    public function mapPdoException(PDOException $e): \Throwable
    {
        $driverCode = (int) ($e->errorInfo[1] ?? 0);
        $sqlState = (string) ($e->errorInfo[0] ?? $e->getCode());

        Logger::instance()->error('Database error', [
            'sql_state' => $sqlState,
            'driver_code' => $driverCode,
            // Deliberately NOT logging the SQL text (may embed values).
        ]);

        // Duplicate key / unique constraint.
        if ($driverCode === 1062 || $sqlState === '23000') {
            return new HttpException(409, 'The request conflicts with existing data.', [], ['driver_code' => $driverCode], $e);
        }

        // Foreign key violation.
        if ($driverCode === 1452 || $driverCode === 1451) {
            return new HttpException(409, 'The request conflicts with related data.', [], ['driver_code' => $driverCode], $e);
        }

        return new HttpException(500, 'Internal server error.', [], ['driver_code' => $driverCode], $e);
    }

    public function close(): void
    {
        $this->pdo = null;
        $this->transactionDepth = 0;
    }
}
