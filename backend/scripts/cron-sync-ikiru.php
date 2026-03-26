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
 */

function parseBoolArg(string $value, bool $default): bool
{
    $normalized = strtolower(trim($value));
    if (in_array($normalized, ['1', 'true', 'yes', 'on'], true)) return true;
    if (in_array($normalized, ['0', 'false', 'no', 'off'], true)) return false;
    return $default;
}

$type = isset($argv[1]) ? strtolower(trim((string)$argv[1])) : 'latest';
$type = in_array($type, ['latest', 'project'], true) ? $type : 'latest';

$page = isset($argv[2]) ? (int)$argv[2] : 1;
if ($page < 1) $page = 1;

$mode = isset($argv[3]) ? strtolower(trim((string)$argv[3])) : 'delta';
$mode = $mode === 'full' ? 'full' : 'delta';

$withImages = isset($argv[4]) ? parseBoolArg((string)$argv[4], true) : true;
$saveToS3 = isset($argv[5]) ? parseBoolArg((string)$argv[5], true) : true;

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

