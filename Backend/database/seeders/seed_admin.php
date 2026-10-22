<?php

declare(strict_types=1);

/**
 * Trusted administrator seeder (CLI).
 *
 * Usage:
 *   php database/seeders/seed_admin.php \
 *       --email=admin@example.com --password='...' [--name='Ops Admin'] \
 *       [--reset-password] [--force]
 *
 * Values may also come from the environment (SEED_ADMIN_EMAIL,
 * SEED_ADMIN_PASSWORD, SEED_ADMIN_NAME), which avoids leaking the password into
 * the shell history. The password is NEVER echoed back.
 *
 * Public registration cannot grant `admin`; this script is the only supported
 * way to create the first administrator.
 */

use Shopio\Config\Config;
use Shopio\Database\Seeders\AdminSeeder;
use Shopio\Exceptions\HttpException;
use Shopio\Kernel;

$root = dirname(__DIR__, 2);

require $root . '/vendor/autoload.php';

/**
 * Reads a CLI option in `--key=value` form.
 */
$option = static function (string $key): ?string {
    foreach (array_slice($GLOBALS['argv'], 1) as $argument) {
        if ($argument === '--' . $key) {
            return '1';
        }
        if (str_starts_with($argument, '--' . $key . '=')) {
            return substr($argument, strlen($key) + 3);
        }
    }

    return null;
};

$flag = static fn (string $key): bool => $option($key) !== null;

$env = static fn (string $key): ?string => (static function () use ($key): ?string {
    $value = $_ENV[$key] ?? $_SERVER[$key] ?? getenv($key);

    return ($value === false || $value === null || $value === '') ? null : (string) $value;
})();

$fail = static function (string $message, int $code = 1): never {
    fwrite(STDERR, "[seed_admin] ERROR: {$message}\n");
    exit($code);
};

try {
    $kernel = Kernel::boot($root);

    $email = $option('email') ?? $env('SEED_ADMIN_EMAIL');
    $password = $option('password') ?? $env('SEED_ADMIN_PASSWORD');
    $name = $option('name') ?? $env('SEED_ADMIN_NAME') ?? 'Shopio Administrator';
    $resetPassword = $flag('reset-password');
    $force = $flag('force') || ($env('SEED_ADMIN_FORCE') === '1');

    if ($email === null || $email === '') {
        $fail('An administrator email is required (--email or SEED_ADMIN_EMAIL).');
    }

    if ($password === null || $password === '') {
        $fail('An administrator password is required (--password or SEED_ADMIN_PASSWORD).');
    }

    if (Config::isProduction() && !$force) {
        $fail('Refusing to seed an administrator while APP_ENV=production. Re-run with --force if this is intended.');
    }

    /** @var AdminSeeder $seeder */
    $seeder = $kernel->container()->get(AdminSeeder::class);
    $result = $seeder->seed($email, $password, $name, $resetPassword);

    $status = $result['created'] ? 'created' : 'reconciled';
    $notes = [];
    if ($result['created']) {
        $notes[] = 'password set';
    } elseif ($result['passwordUpdated']) {
        $notes[] = 'password reset';
    }
    if ($result['roleGranted']) {
        $notes[] = 'admin role granted';
    }

    $suffix = $notes === [] ? '' : ' [' . implode(', ', $notes) . ']';
    fwrite(STDOUT, "[seed_admin] {$status} admin id={$result['id']} email={$result['email']}{$suffix}\n");
    exit(0);
} catch (HttpException $e) {
    // Surface the specific field error (e.g. password policy) rather than the
    // generic client-facing message.
    $details = [];
    foreach ($e->errors() as $messages) {
        foreach ((array) $messages as $message) {
            $details[] = (string) $message;
        }
    }

    $fail($details === [] ? $e->getMessage() : implode(' ', $details), 2);
} catch (Throwable $e) {
    $fail($e->getMessage(), 2);
}
