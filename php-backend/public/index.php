<?php

require __DIR__ . '/../vendor/autoload.php';

// Ensure uploads directory exists (mirroring Node's uploads-komiknesia)
$uploadsDir = __DIR__ . '/uploads-komiknesia';
if (!is_dir($uploadsDir)) {
    mkdir($uploadsDir, 0775, true);
}

$app = require __DIR__ . '/../bootstrap/app.php';

$app->run();

