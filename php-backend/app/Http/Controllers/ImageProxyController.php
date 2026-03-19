<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

class ImageProxyController extends Controller
{
    protected $allowedHosts = [
        'cd1.softkomik.online',
        'cdn1.softkomik.online',
        'cover.softdevices.my.id',
        'psy1.komik.im',
    ];

    public function proxy(Request $request)
    {
        try {
            $rawUrl = $request->query('url');
            if (!$rawUrl || !is_string($rawUrl)) {
                return response()->json(['error' => 'Query parameter url is required'], 400);
            }

            // Support both encoded and plain URL values
            $rawUrl = trim($rawUrl);
            $rawUrl = rawurldecode($rawUrl);

            // Basic URL validation
            $targetUrl = filter_var($rawUrl, FILTER_VALIDATE_URL);
            if ($targetUrl === false) {
                return response()->json(['error' => 'Invalid url'], 400);
            }

            $parsed = parse_url($targetUrl);
            if (!$parsed || !isset($parsed['scheme'], $parsed['host'])) {
                return response()->json(['error' => 'Invalid url'], 400);
            }

            $scheme = strtolower($parsed['scheme']);
            if ($scheme !== 'http' && $scheme !== 'https') {
                return response()->json(['error' => 'Only http(s) URLs are allowed'], 400);
            }

            $host = strtolower($parsed['host']);
            if (!in_array($host, $this->allowedHosts, true)) {
                return response()->json([
                    'error' => 'URL host not allowed for proxy',
                    'allowed' => $this->allowedHosts,
                ], 403);
            }

            // Softkomik CDN: gunakan header khusus (access-code, referer, dll) untuk menghindari blokir Cloudflare,
            // mirip dengan implementasi di Node (proxySoftkomikImage).
            if ($host === 'cd1.softkomik.online' || $host === 'cdn1.softkomik.online') {
                $path = $parsed['path'] ?? '';
                // Hapus prefix /softkomik/ dan slash ekstra di depan
                $imagePath = preg_replace('#^/softkomik/?#i', '', $path);
                $imagePath = ltrim($imagePath, '/');

                if ($imagePath === '' || $imagePath === false) {
                    return response()->json(['error' => 'Invalid Softkomik image path'], 400);
                }

                // Mengikuti Node: selalu gunakan cd1.softkomik.online sebagai base
                $softkomikImageBase = 'https://cd1.softkomik.online/softkomik/';
                $url = $softkomikImageBase . $imagePath;

                // Derive referer: https://softkomik.co/{slug}/chapter/{chapter}
                $segments = explode('/', $imagePath);
                $referer = 'https://softkomik.co';
                if (count($segments) >= 3) {
                    $slug = $segments[1];
                    $chapterNumber = $segments[2];
                    $referer = sprintf('https://softkomik.co/%s/chapter/%s', $slug, $chapterNumber);
                }

                $headers = [
                    'accept' => 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
                    'accept-encoding' => 'gzip, deflate, br, zstd',
                    'accept-language' => 'id,en;q=0.9',
                    'access-code' => 'NYQLFxYsnOy+/zwnNWmNTUN5',
                    'cache-control' => 'no-cache',
                    'pragma' => 'no-cache',
                    'referer' => $referer,
                    'sec-ch-ua' => '"Not:A-Brand";v="99", "Google Chrome";v="145", "Chromium";v="145"',
                    'sec-ch-ua-mobile' => '?1',
                    'sec-ch-ua-platform' => '"iOS"',
                    'sec-fetch-dest' => 'image',
                    'sec-fetch-mode' => 'no-cors',
                    'sec-fetch-site' => 'cross-site',
                    'user-agent' => 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1',
                ];

                // Gunakan cURL langsung agar tidak tergantung Guzzle
                $ch = curl_init($url);
                if ($ch === false) {
                    return response()->json(['error' => 'Failed to initialize cURL'], 500);
                }

                $headerLines = [];
                foreach ($headers as $k => $v) {
                    $headerLines[] = $k . ': ' . $v;
                }

                curl_setopt_array($ch, [
                    CURLOPT_RETURNTRANSFER => true,
                    CURLOPT_FOLLOWLOCATION => true,
                    CURLOPT_TIMEOUT => 10,
                    CURLOPT_SSL_VERIFYPEER => false,
                    CURLOPT_HTTPHEADER => $headerLines,
                ]);

                $body = curl_exec($ch);
                $status = curl_getinfo($ch, CURLINFO_HTTP_CODE);

                if ($body === false || $status >= 400) {
                    $err = curl_error($ch);
                    curl_close($ch);
                    Log::warning('Softkomik image proxy upstream error', ['status' => $status, 'error' => $err]);
                    return response()->json(['error' => 'Upstream error'], $status > 0 ? $status : 502);
                }

                curl_close($ch);

                return response($body, 200, [
                    'Content-Type' => 'image/webp',
                    'Cache-Control' => 'public, max-age=3600',
                ]);
            }

            // Generic image proxy untuk host lain yang diizinkan (misalnya cover.softdevices.my.id)
            $ch = curl_init($targetUrl);
            if ($ch === false) {
                return response()->json(['error' => 'Failed to initialize cURL'], 500);
            }

            curl_setopt_array($ch, [
                CURLOPT_RETURNTRANSFER => true,
                CURLOPT_FOLLOWLOCATION => true,
                CURLOPT_TIMEOUT => 10,
                CURLOPT_SSL_VERIFYPEER => false,
                CURLOPT_HTTPHEADER => [
                    'accept: image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
                    'user-agent: Komiknesia-Image-Proxy/1.0',
                ],
            ]);

            $body = curl_exec($ch);
            $status = curl_getinfo($ch, CURLINFO_HTTP_CODE);

            if ($body === false || $status >= 400) {
                $err = curl_error($ch);
                curl_close($ch);
                Log::warning('Generic image proxy upstream error', ['status' => $status, 'error' => $err]);
                return response()->json(['error' => 'Upstream error'], $status > 0 ? $status : 502);
            }

            curl_close($ch);

            return response($body, 200, [
                'Content-Type' => 'image/webp',
                'Cache-Control' => 'public, max-age=3600',
            ]);
        } catch (\Throwable $e) {
            Log::error('Image proxy error', ['exception' => $e]);
            return response()->json(['error' => 'Internal server error'], 500);
        }
    }
}

