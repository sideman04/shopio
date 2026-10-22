<?php

declare(strict_types=1);

namespace Shopio\Support;

use ErrorException;
use Throwable;

/**
 * Runtime error handling.
 *
 * The API must never emit PHP notices, warnings or deprecations into the
 * response body — that would corrupt the JSON envelope and can leak paths.
 * Display errors are disabled and every diagnostic is routed to the structured
 * logger instead.
 */
final class ErrorHandler
{
    public static function register(): void
    {
        ini_set('display_errors', '0');
        ini_set('display_startup_errors', '0');
        ini_set('log_errors', '0');
        error_reporting(E_ALL);

        set_error_handler(static function (int $severity, string $message, string $file = '', int $line = 0): bool {
            if ((error_reporting() & $severity) === 0) {
                return false;
            }

            // Recoverable diagnostics: log but do not abort the request.
            if (in_array($severity, [E_DEPRECATED, E_USER_DEPRECATED, E_NOTICE, E_USER_NOTICE, E_STRICT], true)) {
                Logger::instance()->debug('PHP diagnostic', [
                    'severity' => $severity,
                    'message' => $message,
                    'file' => basename($file) . ':' . $line,
                ]);

                return true;
            }

            throw new ErrorException($message, 0, $severity, $file, $line);
        });

        set_exception_handler(static function (Throwable $e): void {
            Logger::instance()->critical('Uncaught exception outside request handling', [
                'exception' => $e::class,
                'message' => $e->getMessage(),
                'file' => basename($e->getFile()) . ':' . $e->getLine(),
            ]);
        });

        register_shutdown_function(static function (): void {
            $error = error_get_last();
            if ($error === null) {
                return;
            }

            $fatal = [E_ERROR, E_PARSE, E_CORE_ERROR, E_COMPILE_ERROR, E_USER_ERROR];
            if (in_array($error['type'], $fatal, true)) {
                Logger::instance()->critical('Fatal error', [
                    'message' => $error['message'],
                    'file' => basename($error['file']) . ':' . $error['line'],
                ]);
            }
        });
    }
}
