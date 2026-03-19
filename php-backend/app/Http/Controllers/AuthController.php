<?php

namespace App\Http\Controllers;

use Firebase\JWT\JWT;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

class AuthController extends Controller
{
    protected function generateToken($user)
    {
        $oneYearInSeconds = 365 * 24 * 60 * 60;

        $payload = [
            'userId' => $user->id,
            'username' => $user->username,
            'iat' => time(),
            'exp' => time() + $oneYearInSeconds,
        ];

        return JWT::encode($payload, config('jwt.secret'), 'HS256');
    }

    public function register(Request $request)
    {
        try {
            $username = trim((string) $request->input('username'));
            $password = (string) $request->input('password');
            $email = trim((string) $request->input('email', ''));

            if (!$username || !$password) {
                return response()->json(['status' => false, 'error' => 'Username dan password wajib diisi'], 400);
            }

            if (strlen($username) < 3) {
                return response()->json(['status' => false, 'error' => 'Username minimal 3 karakter'], 400);
            }

            $usernameLower = strtolower($username);

            $existingUsername = DB::table('users')
                ->whereRaw('LOWER(TRIM(username)) = ?', [$usernameLower])
                ->first();

            if ($existingUsername) {
                return response()->json(['status' => false, 'error' => 'Username sudah dipakai. Gunakan username lain.'], 400);
            }

            if ($email !== '') {
                $existingEmail = DB::table('users')
                    ->whereNotNull('email')
                    ->whereRaw('LOWER(TRIM(email)) = LOWER(TRIM(?))', [$email])
                    ->first();

                if ($existingEmail) {
                    return response()->json(['status' => false, 'error' => 'Email sudah dipakai. Gunakan email lain.'], 400);
                }
            }

            $hashedPassword = Hash::make($password);

            $id = DB::table('users')->insertGetId([
                'username' => $usernameLower,
                'password' => $hashedPassword,
                'email' => $email !== '' ? $email : null,
                'profile_image' => null,
            ]);

            $user = DB::table('users')
                ->select('id', 'username', 'email', 'profile_image')
                ->where('id', $id)
                ->first();

            $token = $this->generateToken($user);

            return response()->json([
                'status' => true,
                'data' => [
                    'token' => $token,
                    'user' => [
                        'id' => $user->id,
                        'username' => $user->username,
                        'email' => $user->email,
                        'profile_image' => $user->profile_image,
                    ],
                ],
            ]);
        } catch (\Throwable $e) {
            return response()->json(['status' => false, 'error' => 'Internal server error'], 500);
        }
    }

    public function login(Request $request)
    {
        try {
            $username = $request->input('username');
            $password = $request->input('password');

            if (!$username || !$password) {
                return response()->json(['status' => false, 'error' => 'Username and password are required'], 400);
            }

            $user = DB::table('users')
                ->select('id', 'username', 'email', 'password', 'profile_image')
                ->where('username', $username)
                ->orWhere('email', $username)
                ->first();

            if (!$user) {
                return response()->json(['status' => false, 'error' => 'Invalid username or password'], 401);
            }

            $valid = Hash::check($password, $user->password) || $password === $user->password;

            if (!$valid) {
                return response()->json(['status' => false, 'error' => 'Invalid username or password'], 401);
            }

            $token = $this->generateToken($user);

            return response()->json([
                'status' => true,
                'data' => [
                    'token' => $token,
                    'user' => [
                        'id' => $user->id,
                        'username' => $user->username,
                        'email' => $user->email,
                        'profile_image' => $user->profile_image,
                    ],
                ],
            ]);
        } catch (\Throwable $e) {
            return response()->json(['status' => false, 'error' => 'Internal server error'], 500);
        }
    }

    public function me(Request $request)
    {
        $user = $request->user();

        return response()->json([
            'status' => true,
            'data' => [
                'id' => $user->id,
                'username' => $user->username,
                'email' => $user->email,
                'profile_image' => $user->profile_image,
            ],
        ]);
    }

    public function updateProfile(Request $request)
    {
        try {
            $user = $request->user();
            $userId = $user->id;

            $username = (string) $request->input('username', '');
            $email = (string) $request->input('email', '');
            $current_password = (string) $request->input('current_password', '');
            $new_password = (string) $request->input('new_password', '');

            $currentUser = DB::table('users')
                ->select('id', 'username', 'email', 'password', 'profile_image')
                ->where('id', $userId)
                ->first();

            if (!$currentUser) {
                return response()->json(['status' => false, 'error' => 'User not found'], 404);
            }

            $updates = [];

            $usernameTrim = trim($username);
            $emailTrim = trim($email);

            if ($usernameTrim && strtolower($usernameTrim) !== strtolower($currentUser->username ?? '')) {
                if (strlen($usernameTrim) < 3) {
                    return response()->json(['status' => false, 'error' => 'Username minimal 3 karakter'], 400);
                }

                $existing = DB::table('users')
                    ->where('id', '!=', $userId)
                    ->where(function ($q) use ($usernameTrim, $emailTrim) {
                        $q->whereRaw('LOWER(TRIM(username)) = LOWER(TRIM(?))', [$usernameTrim]);

                        if ($emailTrim !== '') {
                            $q->orWhereRaw('email IS NOT NULL AND TRIM(?) != "" AND LOWER(TRIM(email)) = LOWER(TRIM(?))', [$emailTrim, $emailTrim]);
                        }
                    })
                    ->first();

                if ($existing) {
                    return response()->json(['status' => false, 'error' => 'Username atau email sudah dipakai pengguna lain.'], 400);
                }

                $updates['username'] = $usernameTrim;
            }

            if ($emailTrim !== '' || $email === '') {
                $emailVal = $emailTrim !== '' ? $emailTrim : null;

                if ($emailVal && $emailVal !== $currentUser->email) {
                    $existingEmail = DB::table('users')
                        ->where('id', '!=', $userId)
                        ->whereNotNull('email')
                        ->whereRaw('LOWER(TRIM(email)) = LOWER(TRIM(?))', [$emailVal])
                        ->first();

                    if ($existingEmail) {
                        return response()->json(['status' => false, 'error' => 'Email sudah dipakai pengguna lain.'], 400);
                    }
                }

                $updates['email'] = $emailTrim !== '' ? $emailTrim : null;
            }

            if ($current_password || $new_password) {
                if (!$current_password || !$new_password) {
                    return response()->json(['status' => false, 'error' => 'Password lama dan password baru wajib diisi'], 400);
                }

                if (strlen($new_password) < 6) {
                    return response()->json(['status' => false, 'error' => 'Password baru minimal 6 karakter'], 400);
                }

                $isMatch = Hash::check($current_password, $currentUser->password);

                if (!$isMatch) {
                    return response()->json(['status' => false, 'error' => 'Password lama tidak sesuai'], 400);
                }

                $updates['password'] = Hash::make($new_password);
            }

            if (!empty($updates)) {
                DB::table('users')
                    ->where('id', $userId)
                    ->update($updates);
            }

            $updated = DB::table('users')
                ->select('id', 'username', 'email', 'profile_image')
                ->where('id', $userId)
                ->first();

            return response()->json([
                'status' => true,
                'data' => [
                    'id' => $updated->id,
                    'username' => $updated->username,
                    'email' => $updated->email,
                    'profile_image' => $updated->profile_image,
                ],
            ]);
        } catch (\Throwable $e) {
            return response()->json(['status' => false, 'error' => 'Internal server error'], 500);
        }
    }
}

