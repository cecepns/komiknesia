<?php

// Simple PHP wrapper to trigger Ikiru cron-sync API from cPanel cron
// Contoh penggunaan cPanel:
//   /usr/local/bin/php /home/USERNAME/public_html/path/to/php-backend/ikiru_cron_sync.php

// === Konfigurasi dasar ===
// Ganti BASE_URL dengan domain/server kamu jika perlu.
// Bisa pakai IP langsung (seperti contoh) atau domain.
$BASE_URL = 'http://202.10.48.156:3001';

// Parameter default untuk cron-sync.
// type: latest | project
// mode: delta | full
// withImages: true | false
// page: nomor halaman feed ikiru
$params = [
    'type'       => 'latest',
    'page'       => 1,
    'mode'       => 'full',
    'withImages' => 'true',
];

// Opsional: override via CLI argument, misal:
// php ikiru_cron_sync.php type=project mode=delta page=2 withImages=false
if (PHP_SAPI === 'cli' && isset($argv) && is_array($argv)) {
    foreach ($argv as $arg) {
        if (strpos($arg, '=') === false) {
            continue;
        }
        [$k, $v] = explode('=', $arg, 2);
        $k = trim($k);
        $v = trim($v);
        if ($k !== '' && array_key_exists($k, $params)) {
            $params[$k] = $v;
        }
    }
}

$query = http_build_query($params);
$url   = rtrim($BASE_URL, '/') . '/api/admin/ikiru-sync/cron-sync?' . $query;

// Timeout lebih panjang karena proses bisa lama (scrape + upload S3)
$timeoutSeconds = 600; // 10 menit

function callCronSync($url, $timeoutSeconds)
{
    $ch = curl_init();
    curl_setopt_array($ch, [
        CURLOPT_URL            => $url,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_CONNECTTIMEOUT => 30,
        CURLOPT_TIMEOUT        => $timeoutSeconds,
        CURLOPT_USERAGENT      => 'Komiknesia Cron PHP Client/1.0',
        // Our API route is defined as POST /api/admin/ikiru-sync/cron-sync
        CURLOPT_POST           => true,
        // No body required; we rely on query params in the URL.
        CURLOPT_POSTFIELDS    => '',
    ]);

    $responseBody = curl_exec($ch);
    $curlErrNo    = curl_errno($ch);
    $curlErrMsg   = curl_error($ch);
    $httpCode     = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    return [
        'body'      => $responseBody,
        'httpCode'  => $httpCode,
        'curlErrNo' => $curlErrNo,
        'curlErrMsg'=> $curlErrMsg,
    ];
}

$result = callCronSync($url, $timeoutSeconds);

// Logging sederhana ke stdout (akan tercatat di log cron cPanel)
$timestamp = date('Y-m-d H:i:s');

if ($result['curlErrNo'] !== 0) {
    echo '[' . $timestamp . "] ERROR calling cron-sync\n";
    echo 'URL     : ' . $url . "\n";
    echo 'cURLErr : (' . $result['curlErrNo'] . ') ' . $result['curlErrMsg'] . "\n";
    exit(1);
}

echo '[' . $timestamp . "] SUCCESS calling cron-sync\n";
echo 'URL    : ' . $url . "\n";
echo 'Status : HTTP ' . $result['httpCode'] . "\n";
echo "Body   : \n" . $result['body'] . "\n";

// Jika perlu, bisa tambahkan pengecekan HTTP code di sini
if ($result['httpCode'] < 200 || $result['httpCode'] >= 300) {
    // Anggap non-2xx sebagai kegagalan untuk cron
    exit(1);
}

exit(0);

