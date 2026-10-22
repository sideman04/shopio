<?php

declare(strict_types=1);

/**
 * PHPUnit bootstrap.
 *
 * The suite runs against a dedicated test database (`shopio_v2_test`) and never
 * touches the development database. Environment variables are injected BEFORE
 * the kernel boots: `Dotenv` is loaded immutably, so any value already present in
 * `$_ENV` wins over `.env`.
 */

$root = dirname(__DIR__);

require $root . '/vendor/autoload.php';

$defaults = [
    'APP_NAME' => 'Shopio Test',
    'APP_ENV' => 'testing',
    'APP_DEBUG' => 'true',
    'APP_TIMEZONE' => 'UTC',
    'API_PREFIX' => '/api/v1',

    'DB_HOST' => getenv('TEST_DB_HOST') ?: '127.0.0.1',
    'DB_PORT' => getenv('TEST_DB_PORT') ?: '3306',
    'DB_DATABASE' => getenv('TEST_DB_DATABASE') ?: 'shopio_v2_test',
    'DB_USERNAME' => getenv('TEST_DB_USERNAME') ?: 'shopio_app',
    'DB_PASSWORD' => getenv('TEST_DB_PASSWORD') ?: 'shopio_dev_app_pw',
    'DB_CHARSET' => 'utf8mb4',
    'DB_EMULATE_PREPARES' => 'false',

    'SESSION_COOKIE_NAME' => 'shopio_session',
    'CSRF_COOKIE_NAME' => 'shopio_csrf',
    'SESSION_SECURE_COOKIE' => 'false',
    'SESSION_SAMESITE' => 'Lax',
    'SESSION_TTL' => '7200',
    'SESSION_ABSOLUTE_TTL' => '1209600',

    'PASSWORD_ALGO' => 'auto',
    'PASSWORD_BCRYPT_COST' => '4',
    'AUTH_REQUIRE_EMAIL_VERIFICATION' => 'false',
    'AUTH_MAX_ATTEMPTS' => '8',
    'AUTH_DECAY_SECONDS' => '900',
    'LOGIN_LOCKOUT_SECONDS' => '900',

    'CORS_ALLOWED_ORIGINS' => 'http://localhost:5173',
    'CORS_ALLOW_CREDENTIALS' => 'true',
    'TRUSTED_PROXIES' => '',

    'UPLOAD_DIR' => getenv('TEST_UPLOAD_DIR') ?: '/tmp/opencode/shopio-test-uploads',
    'UPLOAD_BASE_URL' => '/media',
    'UPLOAD_MAX_BYTES' => '5242880',
    'UPLOAD_ALLOWED_MIME' => 'image/jpeg,image/png,image/webp',

    'MAIL_DRIVER' => 'null',
    'MAIL_FROM' => 'noreply@shopio.test',

    'PAYMENT_DEFAULT_PROVIDER' => 'sandbox',
    'PAYMENT_WEBHOOK_TOLERANCE' => '300',
    'PAYMENT_SANDBOX_SECRET' => 'test-sandbox-webhook-secret',

    'DEFAULT_CURRENCY' => 'TZS',
    'DEFAULT_COMMISSION_RATE' => '10.00',
    'DEFAULT_SHIPPING_FLAT' => '0.00',
    'DEFAULT_TAX_RATE' => '0.00',
    'CART_TTL_SECONDS' => '2592000',
    'STOCK_RESERVATION_TTL' => '900',
    'IDEMPOTENCY_TTL_SECONDS' => '86400',

    'CRON_TOKEN' => 'test-cron-token',

    'LOG_DIR' => 'storage/logs',
    'LOG_LEVEL' => 'error',
];

foreach ($defaults as $key => $value) {
    $_ENV[$key] = $value;
    $_SERVER[$key] = $value;
}

// Fail closed: never run the destructive reset routine against a database whose
// name does not clearly mark it as a test database.
$database = (string) $_ENV['DB_DATABASE'];
$allowUnsafe = (getenv('SHOPIO_ALLOW_UNSAFE_TEST_DB') ?: '') === '1';
if (!$allowUnsafe && !str_contains(strtolower($database), 'test')) {
    fwrite(STDERR, "Refusing to run tests against non-test database '{$database}'. "
        . "Set TEST_DB_DATABASE to a *_test database.\n");
    exit(1);
}

Shopio\Tests\Support\TestApplication::boot($root);
