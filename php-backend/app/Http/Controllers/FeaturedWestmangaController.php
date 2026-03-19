<?php

namespace App\Http\Controllers;

use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;

class FeaturedWestmangaController extends Controller
{
    protected const BASE_URL = 'https://data.westmanga.tv';

    /**
     * Map satu item Westmanga (mirror_update / popular.*) menjadi bentuk
     * yang sama dengan FeaturedItemsController::fetchFeaturedItems().
     */
    protected function mapFeaturedItem(array $src, ?string $featuredType, int $index): array
    {
        $id = $src['id'] ?? null;
        $title = $src['title'] ?? null;
        $slug = $src['slug'] ?? null;
        $cover = $src['cover'] ?? null;
        $contentType = $src['content_type'] ?? 'comic';
        $countryId = $src['country_id'] ?? null;
        $color = (bool)($src['color'] ?? false);
        $hot = (bool)($src['hot'] ?? false);
        $isProject = (bool)($src['is_project'] ?? false);
        $rating = (float)($src['rating'] ?? 0);
        $totalViews = $src['total_views'] ?? 0;
        $status = $src['status'] ?? 'ongoing';

        // Bentuk dasar mengikuti kolom yang di-select di FeaturedItemsController
        $item = [
            // Kolom featured_items (fi.*)
            'id' => $id,
            'manga_id' => $id,
            'featured_type' => $featuredType,
            'display_order' => $index,
            'is_active' => true,

            // Kolom manga (m.*) yang dipakai frontend
            'title' => $title,
            'slug' => $slug,
            'cover' => $cover,
            'alternative_name' => null,
            'author' => null,
            'synopsis' => null,
            'content_type' => $contentType,
            'country_id' => $countryId,
            'color' => $color,
            'hot' => $hot,
            'is_project' => $isProject,
            'is_safe' => true,
            'rating' => $rating,
            'bookmark_count' => 0,
            'total_views' => $totalViews,
            'release' => null,
            'status' => $status,
            'is_input_manual' => false,
            'westmanga_id' => $id,
        ];

        // Genres tidak tersedia di home-data → kosong
        $item['genres'] = [];

        // Transform lastChapters Westmanga → lastChapters Komiknesia (hanya pakai satu terakhir)
        $lastChaptersSrc = $src['lastChapters'] ?? [];
        $mappedLast = null;
        if (is_array($lastChaptersSrc) && count($lastChaptersSrc) > 0) {
            $lc = $lastChaptersSrc[0];
            $mappedLast = [
                'number' => $lc['number'] ?? null,
                'title' => $lc['title'] ?? null,
                'slug' => $lc['slug'] ?? null,
                'created_at' => [
                    'time' => (int)($lc['created_at']['time'] ?? 0),
                ],
            ];
        }

        $item['lastChapters'] = $mappedLast ? [$mappedLast] : [];

        return $item;
    }

    protected function httpGet(string $path, array $query = []): array
    {
        $url = rtrim(self::BASE_URL, '/') . $path;
        if (!empty($query)) {
            $url .= '?' . http_build_query($query);
        }

        $ch = curl_init($url);
        if ($ch === false) {
            throw new \RuntimeException('Failed to initialize cURL');
        }

        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_FOLLOWLOCATION => true,
            CURLOPT_TIMEOUT => 10,
            CURLOPT_SSL_VERIFYPEER => false,
            CURLOPT_HTTPHEADER => [
                'accept: application/json',
                'user-agent: Komiknesia-Featured-Westmanga/1.0',
            ],
        ]);

        $body = curl_exec($ch);
        $status = curl_getinfo($ch, CURLINFO_HTTP_CODE);

        if ($body === false) {
            $err = curl_error($ch);
            curl_close($ch);
            throw new \RuntimeException('Westmanga upstream error: ' . $err);
        }

        curl_close($ch);

        if ($status >= 400) {
            throw new \RuntimeException('Westmanga upstream HTTP ' . $status);
        }

        $data = json_decode($body, true);
        if ($data === null && json_last_error() !== JSON_ERROR_NONE) {
            throw new \RuntimeException('Failed to decode Westmanga JSON: ' . json_last_error_msg());
        }

        return $data;
    }

    /**
     * GET /api/featured-items
     *
     * Response disamakan dengan FeaturedItemsController@index:
     * array of featured items (bukan object berlapis).
     *
     * Mapping:
     * - type=banner            → data.mirror_update (slice 5)
     * - type=popular_daily     → data.popular.daily
     * - type=popular_weekly    → data.popular.weekly
     * - type=popular_monthly   → data.popular.monthly
     * - default (tanpa type)   → data.mirror_update (tanpa slice)
     */
    public function index(Request $request)
    {
        try {
            $type = $request->query('type', $request->query('featured_type'));

            $cacheKey = 'westmanga:home-data';
            $payload = Cache::remember($cacheKey, Carbon::now()->addMinutes(5), function () {
                return $this->httpGet('/api/contents/home-data');
            });

            // Pastikan struktur seperti dari Westmanga
            if (!is_array($payload)) {
                return response()->json($payload);
            }

            $data = $payload['data'] ?? null;
            if (!is_array($data)) {
                return response()->json([]);
            }

            $source = [];
            $featuredType = $type; // untuk ditaruh di setiap item

            if ($type === 'banner') {
                $list = $data['mirror_update'] ?? [];
                $source = array_slice(is_array($list) ? $list : [], 0, 5);
            } elseif ($type === 'popular_daily') {
                $source = $data['popular']['daily'] ?? [];
            } elseif ($type === 'popular_weekly') {
                $source = $data['popular']['weekly'] ?? [];
            } elseif ($type === 'popular_monthly') {
                $source = $data['popular']['monthly'] ?? [];
            } else {
                // default: mirror_update tanpa slice
                $source = $data['mirror_update'] ?? [];
            }

            if (!is_array($source)) {
                return response()->json([]);
            }

            $items = [];
            foreach (array_values($source) as $idx => $src) {
                if (!is_array($src)) {
                    continue;
                }
                $items[] = $this->mapFeaturedItem($src, $featuredType, $idx);
            }

            return response()->json($items);
        } catch (\Throwable $e) {
            Log::error('FeaturedWestmangaController@index error', ['exception' => $e]);
            return response()->json([
                'status' => false,
                'error' => 'Failed to fetch featured items from Westmanga',
            ], 502);
        }
    }
}

