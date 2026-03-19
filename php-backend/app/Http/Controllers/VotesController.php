<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Firebase\JWT\JWT;
use Firebase\JWT\Key;

class VotesController extends Controller
{
    /**
    * Optionally resolve the current user from the Authorization header.
    * If the header or token is invalid, this silently returns null
    * (used to mimic optionalAuthenticate behavior from the Node backend).
    */
    protected function resolveOptionalUser(Request $request): ?object
    {
        $authHeader = $request->header('Authorization');

        if (!$authHeader || !str_starts_with($authHeader, 'Bearer ')) {
            return null;
        }

        $token = substr($authHeader, 7);

        try {
            $decoded = JWT::decode($token, new Key(config('jwt.secret'), 'HS256'));

            $user = DB::table('users')
                ->select('id', 'username', 'email', 'profile_image')
                ->where('id', $decoded->userId ?? null)
                ->first();

            return $user ?: null;
        } catch (\Throwable $e) {
            return null;
        }
    }

    /**
     * GET /api/votes/{slug}
     * Return vote counts for a manga (by slug) and current user's vote (if any).
     */
    public function show($slug, Request $request)
    {
        try {
            $manga = DB::table('manga')
                ->select('id')
                ->where('slug', $slug)
                ->first();

            if (!$manga) {
                return response()->json([
                    'status' => false,
                    'error' => 'Manga not found',
                ], 404);
            }

            $mangaId = $manga->id;

            $rows = DB::table('votes')
                ->select('vote_type', DB::raw('COUNT(*) as count'))
                ->where('manga_id', $mangaId)
                ->groupBy('vote_type')
                ->get();

            $voteCounts = [
                'senang' => 0,
                'biasaAja' => 0,
                'kecewa' => 0,
                'marah' => 0,
                'sedih' => 0,
            ];

            foreach ($rows as $row) {
                if (array_key_exists($row->vote_type, $voteCounts)) {
                    $voteCounts[$row->vote_type] = (int) $row->count;
                }
            }

            $user = $this->resolveOptionalUser($request);
            $userVoteRow = null;
            $userIp = $request->ip() ?: 'unknown';

            if ($user) {
                $userVoteRow = DB::table('votes')
                    ->select('vote_type')
                    ->where('manga_id', $mangaId)
                    ->where('user_id', $user->id)
                    ->first();
            } else {
                $userVoteRow = DB::table('votes')
                    ->select('vote_type')
                    ->where('manga_id', $mangaId)
                    ->where('user_ip', $userIp)
                    ->where(function ($q) {
                        $q->whereNull('user_id')
                          ->orWhere('user_id', 0);
                    })
                    ->first();
            }

            return response()->json([
                'status' => true,
                'data' => $voteCounts,
                'userVote' => $userVoteRow ? $userVoteRow->vote_type : null,
            ]);
        } catch (\Throwable $e) {
            return response()->json([
                'status' => false,
                'error' => 'Internal server error',
            ], 500);
        }
    }

    /**
     * POST /api/votes
     * Body: { slug, vote_type }
     * Uses Authorization token when available to make vote per-user; otherwise falls back to per-IP.
     */
    public function store(Request $request)
    {
        try {
            $slug = (string) $request->input('slug', '');
            $voteType = (string) $request->input('vote_type', '');

            if ($slug === '' || $voteType === '') {
                return response()->json([
                    'status' => false,
                    'error' => 'Slug and vote_type are required',
                ], 400);
            }

            $validVoteTypes = ['senang', 'biasaAja', 'kecewa', 'marah', 'sedih'];
            if (!in_array($voteType, $validVoteTypes, true)) {
                return response()->json([
                    'status' => false,
                    'error' => 'Invalid vote_type',
                ], 400);
            }

            $user = $this->resolveOptionalUser($request);
            $userId = $user ? $user->id : null;
            $userIp = $request->ip() ?: 'unknown';

            $manga = DB::table('manga')
                ->select('id')
                ->where('slug', $slug)
                ->first();

            if (!$manga) {
                return response()->json([
                    'status' => false,
                    'error' => 'Manga not found',
                ], 404);
            }

            $mangaId = $manga->id;

            $existingQuery = DB::table('votes')
                ->select('id', 'vote_type')
                ->where('manga_id', $mangaId);

            if ($userId) {
                $existingQuery->where('user_id', $userId);
            } else {
                $existingQuery
                    ->where('user_ip', $userIp)
                    ->where(function ($q) {
                        $q->whereNull('user_id')
                          ->orWhere('user_id', 0);
                    });
            }

            $existing = $existingQuery->first();

            if ($existing) {
                if ($existing->vote_type === $voteType) {
                    if ($userId) {
                        DB::table('votes')
                            ->where('id', $existing->id)
                            ->delete();

                        return response()->json([
                            'status' => true,
                            'message' => 'Vote removed',
                            'action' => 'removed',
                        ]);
                    }

                    return response()->json([
                        'status' => true,
                        'message' => 'Already voted',
                        'action' => 'unchanged',
                    ]);
                }

                DB::table('votes')
                    ->where('id', $existing->id)
                    ->update(['vote_type' => $voteType]);

                return response()->json([
                    'status' => true,
                    'message' => 'Vote updated',
                    'action' => 'updated',
                    'previous_vote' => $existing->vote_type,
                    'new_vote' => $voteType,
                ]);
            }

            if ($userId) {
                DB::table('votes')->insert([
                    'manga_id' => $mangaId,
                    'vote_type' => $voteType,
                    'user_id' => $userId,
                ]);
            } else {
                DB::table('votes')->insert([
                    'manga_id' => $mangaId,
                    'vote_type' => $voteType,
                    'user_ip' => $userIp,
                ]);
            }

            return response()->json([
                'status' => true,
                'message' => 'Vote recorded',
                'action' => 'added',
            ]);
        } catch (\Throwable $e) {
            return response()->json([
                'status' => false,
                'error' => 'Internal server error',
            ], 500);
        }
    }
}

