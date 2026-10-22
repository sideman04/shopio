<?php

declare(strict_types=1);

namespace Shopio\Services;

use Shopio\Auth\AuthenticatedUser;
use Shopio\Config\Config;
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
        if ($file === null || !isset($file['tmp_name'])) {
            throw new ValidationException(['file' => ['No file was uploaded.']]);
        }

        $error = (int) ($file['error'] ?? UPLOAD_ERR_NO_FILE);
        if ($error !== UPLOAD_ERR_OK) {
            throw new ValidationException(['file' => [$this->uploadErrorMessage($error)]]);
        }

        $maxBytes = Config::int('UPLOAD_MAX_BYTES', 5_242_880);
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

        $allowed = Config::list('UPLOAD_ALLOWED_MIME', ['image/jpeg', 'image/png', 'image/webp']);
        if ($detected === '' || !in_array($detected, $allowed, true) || !isset(self::MIME_EXTENSIONS[$detected])) {
            throw new ValidationException(['file' => ['Only JPEG, PNG or WebP images are allowed.']]);
        }

        $dimensions = @getimagesize($tmpPath);
        if ($dimensions === false) {
            throw new ValidationException(['file' => ['The file is not a valid image.']]);
        }

        if ($dimensions[0] > self::MAX_DIMENSION || $dimensions[1] > self::MAX_DIMENSION) {
            throw new ValidationException(['file' => ['The image dimensions are too large.']]);
        }

        $extension = self::MIME_EXTENSIONS[$detected];
        $relativeDir = 'images/' . gmdate('Y/m');
        $directory = $this->uploadRoot() . '/' . $relativeDir;
        if (!is_dir($directory) && !@mkdir($directory, 0770, true) && !is_dir($directory)) {
            throw new ValidationException(['file' => ['The upload could not be stored.']]);
        }

        $filename = bin2hex(random_bytes(16)) . '.' . $extension;
        $destination = $directory . '/' . $filename;

        if (!@move_uploaded_file($tmpPath, $destination)) {
            throw new ValidationException(['file' => ['The upload could not be stored.']]);
        }

        @chmod($destination, 0640);

        $this->audit->record($auth, 'upload.stored', 'upload', null, $request, ['mime' => $detected, 'bytes' => $size]);

        $baseUrl = rtrim(Config::get('UPLOAD_BASE_URL', '/media') ?? '/media', '/');

        return [
            'url' => $baseUrl . '/' . $relativeDir . '/' . $filename,
            'path' => $relativeDir . '/' . $filename,
            'mimeType' => $detected,
            'sizeBytes' => $size,
            'width' => (int) $dimensions[0],
            'height' => (int) $dimensions[1],
        ];
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
