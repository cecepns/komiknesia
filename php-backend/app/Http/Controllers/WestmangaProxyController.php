<?php

namespace App\Http\Controllers;

use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;

class WestmangaProxyController extends Controller
{
    protected const BASE_URL = 'https://data.westmanga.tv';

    /**
     * Simple HTTP GET helper using cURL.
     */
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
                'user-agent: Komiknesia-Westmanga-Proxy/1.0',
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
     * GET /api/contents
     * Proxies to https://data.westmanga.tv/api/contents
     */
    public function contents(Request $request)
    {
        try {
            $page = (int) $request->query('page', 1);
            $perPage = (int) $request->query('per_page', 40);
            $project = $request->query('project', 'false');
            $q = $request->query('q');
            $country = $request->query('country');
            $status = $request->query('status');

            $cacheKey = 'westmanga:contents:' . md5(json_encode([
                'q' => $q ? trim((string) $q) : null,
                'country' => $country ?: null,
                'status' => $status ?: null,
                'page' => $page,
                'per_page' => $perPage,
                'project' => $project,
            ]));

            $payload = Cache::remember($cacheKey, Carbon::now()->addMinutes(3), function () use ($page, $perPage, $project, $q, $country, $status) {
                $query = [
                    'page' => $page,
                    'per_page' => $perPage,
                    'project' => $project,
                ];
                if ($q !== null && trim((string) $q) !== '') {
                    $query['q'] = $q;
                }
                if ($country !== null && trim((string) $country) !== '') {
                    $query['country'] = $country;
                }
                if ($status !== null && trim((string) $status) !== '') {
                    $query['status'] = $status;
                }

                return $this->httpGet('/api/contents', $query);
            });

            return response()->json($payload);
        } catch (\Throwable $e) {
            Log::error('Westmanga contents proxy error', ['exception' => $e]);
            return response()->json([
                'status' => false,
                'error' => 'Failed to fetch contents from Westmanga',
            ], 502);
        }
    }

    /**
     * GET /api/comic/{slug}
     * Proxies to https://data.westmanga.tv/api/comic/{slug}
     */
    public function comic(string $slug)
    {
        try {
            $cacheKey = 'westmanga:comic:' . $slug;

            $payload = Cache::remember($cacheKey, Carbon::now()->addMinutes(5), function () use ($slug) {
                return $this->httpGet('/api/comic/' . $slug);
            });

            return response()->json($payload);
        } catch (\Throwable $e) {
            Log::error('Westmanga comic proxy error', ['slug' => $slug, 'exception' => $e]);
            return response()->json([
                'status' => false,
                'error' => 'Failed to fetch comic from Westmanga',
            ], 502);
        }
    }

    /**
     * GET /api/chapters/slug/{slug}
     * Proxies to https://data.westmanga.tv/api/v/{slug}
     */
    public function chapterBySlug(string $slug)
    {
        try {
            $cacheKey = 'westmanga:chapter:slug:' . $slug;

            $payload = Cache::remember($cacheKey, Carbon::now()->addMinutes(5), function () use ($slug) {
                return $this->httpGet('/api/v/' . $slug);
            });

            return response()->json($payload);
        } catch (\Throwable $e) {
            Log::error('Westmanga chapter proxy error', ['slug' => $slug, 'exception' => $e]);
            return response()->json([
                'status' => false,
                'error' => 'Failed to fetch chapter from Westmanga',
            ], 502);
        }
    }
}

