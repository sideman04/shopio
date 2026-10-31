<?php

declare(strict_types=1);

namespace Shopio\Controllers;

use Shopio\Http\Request;
use Shopio\Http\Response;
use Shopio\Services\UploadService;

/**
 * Public image delivery.
 *
 * Product, store, banner and category images are stored outside the document
 * root and streamed through this controller. Seller verification documents are
 * deliberately not exposed here; they have authenticated download endpoints.
 */
final class MediaController extends Controller
{
    public function __construct(private readonly UploadService $uploads)
    {
    }

    /**
     * @param array<string,string> $params
     */
    public function show(Request $request, array $params): Response
    {
        $path = (string) ($params['path'] ?? '');
        $file = $this->uploads->readPublicImage($path);

        return $this->file($file['body'], $file['mime'], $file['filename'], true, [
            'Cache-Control' => 'public, max-age=31536000, immutable',
        ]);
    }
}
