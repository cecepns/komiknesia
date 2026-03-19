<?php

namespace App\Http\Middleware;

use Closure;
use Firebase\JWT\JWT;
use Firebase\JWT\Key;
use Illuminate\Support\Facades\DB;

class Authenticate
{
    public function handle($request, Closure $next, $guard = null)
    {
        $authHeader = $request->header('Authorization');

        if (!$authHeader || !str_starts_with($authHeader, 'Bearer ')) {
            return response()->json(['status' => false, 'error' => 'Access token required'], 401);
        }

        $token = substr($authHeader, 7);

        try {
            $decoded = JWT::decode($token, new Key(config('jwt.secret'), 'HS256'));

            $user = DB::table('users')
                ->select('id', 'username', 'email', 'profile_image')
                ->where('id', $decoded->userId ?? null)
                ->first();

            if (!$user) {
                return response()->json(['status' => false, 'error' => 'User not found'], 401);
            }

            $request->setUserResolver(function () use ($user) {
                return $user;
            });
        } catch (\Throwable $e) {
            return response()->json(['status' => false, 'error' => 'Invalid or expired token'], 403);
        }

        return $next($request);
    }
}

