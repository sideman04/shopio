<?php

declare(strict_types=1);

namespace Shopio\Tests\Feature;

use Shopio\Config\Config;
use Shopio\Tests\Support\Factory;
use Shopio\Tests\TestCase;

/**
 * Image upload validation.
 *
 * The security-relevant branches (missing file, transport error, oversize,
 * unverified temp file) are exercised in-process. The happy path requires a real
 * `is_uploaded_file()` so it is driven against a throwaway built-in web server;
 * that test is skipped when the environment cannot spawn processes.
 */
final class UploadTest extends TestCase
{
    /** A real, minimal 1x1 PNG. */
    private const PNG_1X1 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

    /** @var array{process:resource,port:int}|null */
    private static ?array $server = null;

    public static function tearDownAfterClass(): void
    {
        if (self::$server !== null) {
            proc_terminate(self::$server['process']);
            proc_close(self::$server['process']);
            self::$server = null;
        }

        parent::tearDownAfterClass();
    }

    public function test_upload_requires_authentication(): void
    {
        $this->assertStatus(401, $this->postJson('/api/v1/uploads/images'));
    }

    public function test_a_missing_file_is_rejected(): void
    {
        $user = Factory::user();

        $response = $this->postJson('/api/v1/uploads/images', [], $this->bearer($user));
        $this->assertStatus(422, $response);
        $this->assertArrayHasKey('file', $response->json()['errors'] ?? []);
    }

    public function test_a_transport_error_is_rejected(): void
    {
        $user = Factory::user();

        $response = $this->upload($user, [
            'name' => 'photo.png',
            'tmp_name' => '',
            'error' => UPLOAD_ERR_INI_SIZE,
            'size' => 0,
        ]);

        $this->assertStatus(422, $response);
    }

    public function test_a_zero_byte_upload_is_rejected(): void
    {
        $user = Factory::user();

        $response = $this->upload($user, [
            'name' => 'photo.png',
            'tmp_name' => $this->tempPng(),
            'error' => UPLOAD_ERR_OK,
            'size' => 0,
        ]);

        $this->assertStatus(422, $response);
    }

    public function test_an_oversize_upload_is_rejected(): void
    {
        $user = Factory::user();

        $response = $this->upload($user, [
            'name' => 'huge.png',
            'tmp_name' => $this->tempPng(),
            'error' => UPLOAD_ERR_OK,
            'size' => (int) Config::int('UPLOAD_MAX_BYTES', 5_242_880) + 1,
        ]);

        $this->assertStatus(422, $response);
    }

    public function test_a_temp_file_that_was_not_a_real_upload_is_rejected(): void
    {
        $user = Factory::user();

        $response = $this->upload($user, [
            'name' => 'photo.png',
            'tmp_name' => $this->tempPng(),
            'error' => UPLOAD_ERR_OK,
            'size' => 70,
        ]);

        $this->assertStatus(422, $response);
    }

    public function test_a_valid_image_is_stored_under_a_generated_name(): void
    {
        $this->startServer();

        $user = Factory::user();
        $token = Factory::token((int) $user['id']);

        $uploadDir = (string) Config::get('UPLOAD_DIR', 'storage/uploads');
        $before = $this->listFiles($uploadDir);

        // A hostile original filename must not influence where the file lands.
        $response = $this->curlMultipart(
            '/api/v1/uploads/images',
            $token,
            $this->tempPng(),
            '../../evil.php',
        );

        $this->assertSame(201, $response['status'], 'Body: ' . $response['body']);
        $payload = json_decode($response['body'], true);
        $this->assertIsArray($payload);
        $data = $payload['data'] ?? [];

        $this->assertSame('image/png', $data['mimeType'] ?? null);
        $this->assertSame(1, (int) ($data['width'] ?? 0));
        $this->assertSame(1, (int) ($data['height'] ?? 0));
        $this->assertStringStartsWith('/media/images/', (string) ($data['url'] ?? ''));
        $this->assertStringNotContainsString('evil', (string) ($data['path'] ?? ''));

        // The bytes really landed on disk outside the docroot.
        $stored = rtrim($uploadDir, '/') . '/' . (string) $data['path'];
        $this->assertFileExists($stored);
        $this->assertSame("image/png", (string) (new \finfo(FILEINFO_MIME_TYPE))->file($stored));

        // Clean up the artefacts this test created.
        foreach (array_diff($this->listFiles($uploadDir), $before) as $created) {
            @unlink($created);
        }
    }

    public function test_a_non_image_upload_is_rejected(): void
    {
        $this->startServer();

        $user = Factory::user();
        $token = Factory::token((int) $user['id']);

        $php = tempnam(sys_get_temp_dir(), 'shopio_php_');
        $this->assertIsString($php);
        file_put_contents($php, "<?php echo 'pwned'; ?>");

        try {
            // Content is PHP even though the client claims a .png name.
            $response = $this->curlMultipart('/api/v1/uploads/images', $token, $php, 'innocent.png');
            $this->assertSame(422, $response['status'], 'Body: ' . $response['body']);
        } finally {
            @unlink($php);
        }
    }

    /**
     * @param array<string,mixed> $file
     */
    private function upload(array $user, array $file): \Shopio\Tests\Support\TestResponse
    {
        return $this->request('POST', '/api/v1/uploads/images', [
            'headers' => $this->bearer($user),
            'files' => ['file' => $file],
        ]);
    }

    private function tempPng(): string
    {
        $path = tempnam(sys_get_temp_dir(), 'shopio_png_');
        $this->assertIsString($path);
        file_put_contents($path, (string) base64_decode(self::PNG_1X1, true));

        return $path;
    }

    /**
     * @return list<string>
     */
    private function listFiles(string $dir): array
    {
        if (!is_dir($dir)) {
            return [];
        }

        $files = [];
        $iterator = new \RecursiveIteratorIterator(new \RecursiveDirectoryIterator($dir, \FilesystemIterator::SKIP_DOTS));
        foreach ($iterator as $entry) {
            if ($entry instanceof \SplFileInfo && $entry->isFile()) {
                $files[] = $entry->getPathname();
            }
        }

        return $files;
    }

    /**
     * Starts the built-in server once for the class against the test database.
     */
    private function startServer(): void
    {
        if (self::$server !== null) {
            return;
        }

        if (!function_exists('proc_open')) {
            $this->markTestSkipped('proc_open is unavailable; cannot start a local web server.');
        }

        $root = dirname(__DIR__, 2);
        $port = $this->freePort();
        $router = $root . '/public/index.php';

        // Real environment variables win over .env (Dotenv is loaded immutably),
        // so the child process talks to the test database.
        $env = array_merge(getenv(), array_map('strval', $_ENV));

        $descriptors = [1 => ['pipe', 'w'], 2 => ['pipe', 'w']];
        $process = proc_open(
            [PHP_BINARY, '-S', '127.0.0.1:' . $port, '-t', $root . '/public', $router],
            $descriptors,
            $pipes,
            $root,
            $env,
        );

        if (!is_resource($process)) {
            $this->markTestSkipped('Failed to start the built-in web server.');
        }

        // Non-blocking drains so the child never stalls on a full pipe buffer.
        stream_set_blocking($pipes[1], false);
        stream_set_blocking($pipes[2], false);

        if (!$this->waitForServer($port, 8.0)) {
            proc_terminate($process);
            proc_close($process);
            $this->markTestSkipped('Built-in web server did not become ready on port ' . $port . '.');
        }

        self::$server = ['process' => $process, 'port' => $port];
    }

    private function freePort(): int
    {
        $socket = stream_socket_server('tcp://127.0.0.1:0', $errno, $errstr);
        if ($socket === false) {
            $this->markTestSkipped('Cannot allocate a local port: ' . $errstr);
        }

        $name = (string) stream_socket_get_name($socket, false);
        fclose($socket);

        return (int) substr($name, (int) strrpos($name, ':') + 1);
    }

    private function waitForServer(int $port, float $timeoutSeconds): bool
    {
        $deadline = microtime(true) + $timeoutSeconds;
        while (microtime(true) < $deadline) {
            $connection = @fsockopen('127.0.0.1', $port, $errno, $errstr, 0.2);
            if (is_resource($connection)) {
                fclose($connection);

                return true;
            }
            usleep(100_000);
        }

        return false;
    }

    /**
     * @return array{status:int,body:string}
     */
    private function curlMultipart(string $path, string $token, string $filePath, string $filename): array
    {
        $server = self::$server;
        if ($server === null) {
            $this->fail('Server is not running.');
        }

        $curl = curl_init('http://127.0.0.1:' . $server['port'] . $path);
        $this->assertNotFalse($curl);

        curl_setopt_array($curl, [
            CURLOPT_POST => true,
            CURLOPT_POSTFIELDS => ['file' => new \CURLFile($filePath, 'application/octet-stream', $filename)],
            CURLOPT_HTTPHEADER => ['Authorization: Bearer ' . $token],
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => 15,
        ]);

        $body = curl_exec($curl);
        $status = (int) curl_getinfo($curl, CURLINFO_HTTP_CODE);
        curl_close($curl);

        return ['status' => $status, 'body' => is_string($body) ? $body : ''];
    }
}
