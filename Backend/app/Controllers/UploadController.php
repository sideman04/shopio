<?php

declare(strict_types=1);

namespace Shopio\Controllers;

use Shopio\Http\Request;
use Shopio\Http\Response;
use Shopio\Services\UploadService;

/**
 * Authenticated media uploads (product images, store logo/banner).
 */
final class UploadController extends Controller
{
    public function __construct(private readonly UploadService $uploads)
    {
    }

    public function image(Request $request): Response
    {
        $result = $this->uploads->storeImage($this->auth($request), $request->file('file'), $request);

        return $this->created($result, 'File uploaded successfully', [], $request);
    }
}
