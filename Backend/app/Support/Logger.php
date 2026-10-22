<?php

declare(strict_types=1);

namespace Shopio\Support;

/**
 * Minimal PSR-3-style structured logger writing single-line JSON to a daily
 * file. Every record is passed through {@see Redactor} so secrets never land on
 * disk.
 */
final class Logger
{
    private const LEVELS = ['debug' => 10, 'info' => 20, 'notice' => 25, 'warning' => 30, 'error' => 40, 'critical' => 50];

    private static ?self $instance = null;

    /** @var resource|null */
    private $handle = null;

    private function __construct(
        private readonly string $directory,
        private readonly int $minimumLevel,
    ) {
        if (!is_dir($this->directory)) {
            @mkdir($this->directory, 0770, true);
        }
    }

    public static function boot(string $directory, string $level = 'info'): void
    {
        $normalised = strtolower($level);

        self::$instance = new self($directory, self::LEVELS[$normalised] ?? 20);
    }

    public static function instance(): self
    {
        if (self::$instance === null) {
            self::$instance = new self('/tmp/opencode', 20);
        }

        return self::$instance;
    }

    /**
     * @param array<string,mixed> $context
     */
    public function log(string $level, string $message, array $context = []): void
    {
        $level = strtolower($level);
        $weight = self::LEVELS[$level] ?? 20;
        if ($weight < $this->minimumLevel) {
            return;
        }

        $record = [
            'time' => gmdate('Y-m-d\TH:i:s\Z'),
            'level' => $level,
            'message' => $message,
            'context' => Redactor::clean($context),
        ];

        $json = json_encode($record, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_PARTIAL_OUTPUT_ON_ERROR);
        if ($json === false) {
            $json = json_encode(['time' => gmdate('c'), 'level' => 'error', 'message' => 'log encoding failed']);
        }

        $this->write((string) $json);
    }

    /**
     * @param array<string,mixed> $context
     */
    public function debug(string $message, array $context = []): void
    {
        $this->log('debug', $message, $context);
    }

    /**
     * @param array<string,mixed> $context
     */
    public function info(string $message, array $context = []): void
    {
        $this->log('info', $message, $context);
    }

    /**
     * @param array<string,mixed> $context
     */
    public function warning(string $message, array $context = []): void
    {
        $this->log('warning', $message, $context);
    }

    /**
     * @param array<string,mixed> $context
     */
    public function error(string $message, array $context = []): void
    {
        $this->log('error', $message, $context);
    }

    /**
     * @param array<string,mixed> $context
     */
    public function critical(string $message, array $context = []): void
    {
        $this->log('critical', $message, $context);
    }

    private function write(string $line): void
    {
        if ($this->handle === null) {
            $path = $this->directory . '/app-' . gmdate('Y-m-d') . '.log';
            $handle = fopen($path, 'ab');
            if ($handle === false) {
                // Never let logging failures break a request.
                return;
            }
            @chmod($path, 0640);
            $this->handle = $handle;
        }

        @flock($this->handle, LOCK_EX);
        fwrite($this->handle, $line . "\n");
        @flock($this->handle, LOCK_UN);
    }
}
