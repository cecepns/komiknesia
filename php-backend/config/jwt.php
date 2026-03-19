<?php

return [
    'secret' => env('JWT_SECRET', 'komiknesia-secret-key-change-in-production'),
    'ttl'    => 60 * 24 * 7,
];

