<?php

declare(strict_types=1);

namespace Shopio\Services;

use Shopio\Auth\AuthenticatedUser;
use Shopio\Config\Config;
use Shopio\Exceptions\NotFoundException;
use Shopio\Exceptions\ValidationException;
use Shopio\Http\Request;

/**
 * Safe file uploads.
 *
 * The uploaded stream is never trusted: the MIME type is detected server-side
 * (finfo) and must be on the allowlist, the size is enforced, images are
 * dimension-checked, and the stored name is generated (never derived from the
 * client filename). Files are written outside the document root and served from
 * a dedicated media path.
 */
final class UploadService
{
    /** @var array<string,string> Detected MIME => canonical extension. */
    private const MIME_EXTENSIONS = [
        'image/jpeg' => 'jpg',
        'image/png' => 'png',
        'image/webp' => 'webp',
        'image/gif' => 'gif',
    ];

    /** @var array<string,string> Documents may be PDFs or images. */
    private const DOCUMENT_MIME_EXTENSIONS = [
        'application/pdf' => 'pdf',
        'image/jpeg' => 'jpg',
        'image/png' => 'png',
        'image/webp' => 'webp',
    ];

    private const MAX_DIMENSION = 8000;

    public function __construct(private readonly AuditService $audit)
    {
    }

    /**
     * @param array<string,mixed>|null $file
     * @return array<string,mixed>
     */
    public function storeImage(AuthenticatedUser $auth, ?array $file, Request $request): array
    {
        $validated = $this->validateFile(
            $file,
            Config::int('UPLOAD_MAX_BYTES', 5_242_880),
            Config::list('UPLOAD_ALLOWED_MIME', ['image/jpeg', 'image/png', 'image/webp']),
            self::MIME_EXTENSIONS,
            'Only JPEG, PNG or WebP images are allowed.',
        );

        $dimensions = @getimagesize($validated['tmpPath']);
        if ($dimensions === false) {
            throw new ValidationException(['file' => ['The file is not a valid image.']]);
        }

        if ($dimensions[0] > self::MAX_DIMENSION || $dimensions[1] > self::MAX_DIMENSION) {
            throw new ValidationException(['file' => ['The image dimensions are too large.']]);
        }

        $relativeDir = 'images/' . gmdate('Y/m');
        $stored = $this->store($validated['tmpPath'], $validated['detected'], $relativeDir, self::MIME_EXTENSIONS);

        $this->audit->record($auth, 'upload.stored', 'upload', null, $request, [
            'mime' => $validated['detected'],
            'bytes' => $validated['size'],
        ]);

        return $stored + [
            'mimeType' => $validated['detected'],
            'sizeBytes' => $validated['size'],
            'width' => (int) $dimensions[0],
            'height' => (int) $dimensions[1],
        ];
    }

    /**
     * Stores a seller verification document (PDF or image).
     *
     * @param array<string,mixed>|null $file
     * @return array<string,mixed>
     */
    public function storeDocument(AuthenticatedUser $auth, ?array $file, Request $request): array
    {
        $validated = $this->validateFile(
            $file,
            Config::int('UPLOAD_DOCUMENT_MAX_BYTES', 10_485_760),
            Config::list('UPLOAD_ALLOWED_DOCUMENT_MIME', ['application/pdf', 'image/jpeg', 'image/png', 'image/webp']),
            self::DOCUMENT_MIME_EXTENSIONS,
            'Only PDF, JPEG, PNG or WebP documents are allowed.',
        );

        $relativeDir = 'documents/' . gmdate('Y/m');
        $stored = $this->store($validated['tmpPath'], $validated['detected'], $relativeDir, self::DOCUMENT_MIME_EXTENSIONS);

        $this->audit->record($auth, 'upload.document_stored', 'upload', null, $request, [
            'mime' => $validated['detected'],
            'bytes' => $validated['size'],
        ]);

        return $stored + [
            'mimeType' => $validated['detected'],
            'sizeBytes' => $validated['size'],
            'originalName' => $validated['originalName'],
        ];
    }

    /**
     * Reads a public image from the upload root. Verification documents live
     * under `documents/` and are deliberately excluded from public media.
     *
     * @return array{body:string,mime:string,size:int,filename:string}
     */
    public function readPublicImage(string $relativePath): array
    {
        $relativePath = ltrim(str_replace('\\', '/', $relativePath), '/');
        if (str_starts_with($relativePath, 'documents/')) {
            throw new NotFoundException('The requested media file does not exist.');
        }

        $absolute = $this->resolveStoredPath($relativePath);
        $mime = $this->detectStoredMime($absolute);
        if (!in_array($mime, ['image/jpeg', 'image/png', 'image/webp', 'image/gif'], true)) {
            throw new NotFoundException('The requested media file does not exist.');
        }

        $body = @file_get_contents($absolute);
        if ($body === false) {
            throw new NotFoundException('The requested media file does not exist.');
        }

        return [
            'body' => $body,
            'mime' => $mime,
            'size' => strlen($body),
            'filename' => basename($absolute),
        ];
    }

    /**
     * Reads a seller verification document after the caller has proved access.
     *
     * @return array{body:string,mime:string,size:int,filename:string}
     */
    public function readDocument(string $relativePath): array
    {
        $relativePath = ltrim(str_replace('\\', '/', $relativePath), '/');
        if (!str_starts_with($relativePath, 'documents/')) {
            throw new NotFoundException('The requested document does not exist.');
        }

        $absolute = $this->resolveStoredPath($relativePath);
        $mime = $this->detectStoredMime($absolute);
        if (!in_array($mime, ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'], true)) {
            throw new NotFoundException('The requested document does not exist.');
        }

        $body = @file_get_contents($absolute);
        if ($body === false) {
            throw new NotFoundException('The requested document does not exist.');
        }

        return [
            'body' => $body,
            'mime' => $mime,
            'size' => strlen($body),
            'filename' => basename($absolute),
        ];
    }

    /**
     * Removes a previously stored file. Paths are validated so a caller can
     * never traverse outside the upload root.
     */
    public function deleteStored(string $relativePath): void
    {
        $relativePath = ltrim(str_replace('\\', '/', $relativePath), '/');
        if ($relativePath === '' || str_contains($relativePath, '..')) {
            return;
        }

        $absolute = $this->uploadRoot() . '/' . $relativePath;
        if (is_file($absolute)) {
            @unlink($absolute);
        }
    }

    /**
     * @param array<string,mixed>|null $file
     * @param array<string,string> $extensions
     * @return array{tmpPath:string,detected:string,size:int,originalName:string}
     */
    private function validateFile(
        ?array $file,
        int $maxBytes,
        array $allowed,
        array $extensions,
        string $mimeMessage,
    ): array {
        if ($file === null || !isset($file['tmp_name'])) {
            throw new ValidationException(['file' => ['No file was uploaded.']]);
        }

        $error = (int) ($file['error'] ?? UPLOAD_ERR_NO_FILE);
        if ($error !== UPLOAD_ERR_OK) {
            throw new ValidationException(['file' => [$this->uploadErrorMessage($error)]]);
        }

        $size = (int) ($file['size'] ?? 0);
        if ($size <= 0 || $size > $maxBytes) {
            throw new ValidationException(['file' => ['The file must be at most ' . (int) floor($maxBytes / 1024) . 'KB.']]);
        }

        $tmpPath = (string) $file['tmp_name'];
        if (!is_uploaded_file($tmpPath)) {
            throw new ValidationException(['file' => ['The upload could not be verified.']]);
        }

        $finfo = new \finfo(FILEINFO_MIME_TYPE);
        $detected = $finfo->file($tmpPath);
        $detected = is_string($detected) ? strtolower($detected) : '';

        if ($detected === '' || !in_array($detected, $allowed, true) || !isset($extensions[$detected])) {
            throw new ValidationException(['file' => [$mimeMessage]]);
        }

        $original = basename((string) ($file['name'] ?? 'file'));

        return [
            'tmpPath' => $tmpPath,
            'detected' => $detected,
            'size' => $size,
            'originalName' => mb_substr($original !== '' ? $original : 'file', 0, 255),
        ];
    }

    /**
     * @param array<string,string> $extensions
     * @return array{url:string,path:string}
     */
    private function store(string $tmpPath, string $detected, string $relativeDir, array $extensions): array
    {
        $directory = $this->uploadRoot() . '/' . $relativeDir;
        if (!is_dir($directory) && !@mkdir($directory, 0770, true) && !is_dir($directory)) {
            throw new ValidationException(['file' => ['The upload could not be stored.']]);
        }

        $filename = bin2hex(random_bytes(16)) . '.' . $extensions[$detected];
        $destination = $directory . '/' . $filename;

        if (!@move_uploaded_file($tmpPath, $destination)) {
            throw new ValidationException(['file' => ['The upload could not be stored.']]);
        }

        @chmod($destination, 0640);

        $baseUrl = rtrim(Config::get('UPLOAD_BASE_URL', '/media') ?? '/media', '/');

        return [
            'url' => $baseUrl . '/' . $relativeDir . '/' . $filename,
            'path' => $relativeDir . '/' . $filename,
        ];
    }

    private function resolveStoredPath(string $relativePath): string
    {
        if ($relativePath === '' || str_contains($relativePath, '..') || str_contains($relativePath, "\0")) {
            throw new NotFoundException('The requested media file does not exist.');
        }

        $root = realpath($this->uploadRoot());
        if ($root === false) {
            throw new NotFoundException('The requested media file does not exist.');
        }

        $absolute = realpath($root . '/' . $relativePath);
        if ($absolute === false || !is_file($absolute) || !str_starts_with($absolute, $root . DIRECTORY_SEPARATOR)) {
            throw new NotFoundException('The requested media file does not exist.');
        }

        return $absolute;
    }

    private function detectStoredMime(string $absolute): string
    {
        $finfo = new \finfo(FILEINFO_MIME_TYPE);
        $mime = $finfo->file($absolute);

        return is_string($mime) ? strtolower($mime) : '';
    }

    private function uploadRoot(): string
    {
        $dir = Config::get('UPLOAD_DIR', 'storage/uploads') ?? 'storage/uploads';
        if (str_starts_with($dir, '/')) {
            return rtrim($dir, '/');
        }

        return rtrim(Config::rootDir(), '/') . '/' . trim($dir, '/');
    }

    private function uploadErrorMessage(int $error): string
    {
        return match ($error) {
            UPLOAD_ERR_INI_SIZE, UPLOAD_ERR_FORM_SIZE => 'The uploaded file is too large.',
            UPLOAD_ERR_PARTIAL => 'The file was only partially uploaded.',
            UPLOAD_ERR_NO_FILE => 'No file was uploaded.',
            default => 'The upload failed. Please try again.',
        };
    }
}
