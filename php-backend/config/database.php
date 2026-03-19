<?php

return [
    'default' => env('DB_CONNECTION', 'mysql'),

    'connections' => [
        'mysql' => [
            'driver' => 'mysql',
            'host' => env('DB_HOST', 'localhost'),
            'port' => env('DB_PORT', 3306),
            'database' => env('DB_DATABASE', 'komw6486_komiknesia2'),
            'username' => env('DB_USERNAME', 'komw6486_komiknesia'),
            'password' => env('DB_PASSWORD', 'komw6486_komiknesia'),
            'charset' => 'utf8mb4',
            'collation' => 'utf8mb4_unicode_ci',
            'prefix' => '',
            'strict' => false,
        ],
    ],
];

