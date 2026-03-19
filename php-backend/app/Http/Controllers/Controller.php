<?php

namespace App\Http\Controllers;

use Laravel\Lumen\Routing\Controller as BaseController;

class Controller extends BaseController
{
    protected const COVER_IMAGE_BASE = 'https://softkomik.co/_next/image';
    protected const COVER_IMAGE_PARAMS = '&w=384&q=75';

    protected function toCoverImageUrl(mixed $cover): mixed
    {
        if ($cover === null || $cover === '') {
            return $cover;
        }
        $trimmed = trim((string) $cover);
        if ($trimmed === '') {
            return $cover;
        }
        if (strpos($trimmed, 'http://') !== 0 && strpos($trimmed, 'https://') !== 0) {
            return $cover;
        }
        return self::COVER_IMAGE_BASE . '?url=' . rawurlencode($trimmed) . self::COVER_IMAGE_PARAMS;
    }
}

