<?php

declare(strict_types=1);

/**
 * Cron helper for hitting Ikiru cron sync endpoint.
 *
 * Usage:
 *   php backend/scripts/cron-sync-ikiru.php
 *   php backend/scripts/cron-sync-ikiru.php project 1 full true true
 *
 * Args:
 *   1) type       latest|project      (default: latest)
 *   2) page       integer >= 1         (default: 1)
 *   3) mode       delta|full           (default: delta)
 *   4) withImages true|false|1|0       (default: true)
 *   5) saveToS3   true|false|1|0       (default: true)
 *
 * Env vars:
 *   CRON_SYNC_BASE_URL  (default: https://be-api-node.komiknesia.net)
 *   CRON_SYNC_TIMEOUT   (default: 1200 seconds)
 *
 * Di sisi Node, endpoint ini memicu scrape ke Ikiru lewat utils/ikiruSession.js
 * (login web + cookie — sama seperti sync manual admin).
 */

function parseBoolArg(string $value, bool $default): bool
{
    $normalized = strtolower(trim($value));
    if (in_array($normalized, ['1', 'true', 'yes', 'on'], true)) return true;
    if (in_array($normalized, ['0', 'false', 'no', 'off'], true)) return false;
    return $default;
}

// Support both:
// - CLI: php cron-sync-ikiru.php project 2 full true true
// - Web query params: cron-sync-ikiru.php?type=project&page=2&mode=full&withImages=true&saveToS3=true
$isCli = PHP_SAPI === 'cli';
$query = (!$isCli && isset($_GET) && is_array($_GET)) ? $_GET : [];

$typeInput = $query['type'] ?? ($argv[1] ?? 'latest');
$type = strtolower(trim((string)$typeInput));
$type = in_array($type, ['latest', 'project'], true) ? $type : 'latest';

$pageInput = $query['page'] ?? ($argv[2] ?? 1);
$page = (int)$pageInput;
if ($page < 1) $page = 1;

$modeInput = $query['mode'] ?? ($argv[3] ?? 'delta');
$mode = strtolower(trim((string)$modeInput));
$mode = $mode === 'full' ? 'full' : 'delta';

$withImagesInput = $query['withImages'] ?? ($argv[4] ?? 'true');
$saveToS3Input = $query['saveToS3'] ?? ($argv[5] ?? 'true');
$withImages = parseBoolArg((string)$withImagesInput, true);
$saveToS3 = parseBoolArg((string)$saveToS3Input, true);

$baseUrl = rtrim((string)(getenv('CRON_SYNC_BASE_URL') ?: 'https://be-api-node.komiknesia.net'), '/');
$timeoutSeconds = (int)(getenv('CRON_SYNC_TIMEOUT') ?: 1200);
if ($timeoutSeconds < 1) $timeoutSeconds = 1200;

$query = http_build_query([
    'type' => $type,
    'page' => $page,
    'mode' => $mode,
    'withImages' => $withImages ? 'true' : 'false',
    'saveToS3' => $saveToS3 ? 'true' : 'false',
]);

$url = $baseUrl . '/api/ikiru/cron-sync?' . $query;

$ch = curl_init($url);
curl_setopt_array($ch, [
    CURLOPT_POST => true,
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_TIMEOUT => $timeoutSeconds,
    CURLOPT_CONNECTTIMEOUT => 15,
    CURLOPT_HTTPHEADER => ['Accept: application/json'],
]);

$response = curl_exec($ch);
$curlError = curl_error($ch);
$statusCode = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

$timestamp = date('Y-m-d H:i:s');
echo '[' . $timestamp . '] POST ' . $url . PHP_EOL;

if ($response === false) {
    fwrite(STDERR, 'cURL error: ' . $curlError . PHP_EOL);
    exit(1);
}

echo 'HTTP ' . $statusCode . PHP_EOL;
echo $response . PHP_EOL;

if ($statusCode < 200 || $statusCode >= 300) {
    exit(1);
}

exit(0);

