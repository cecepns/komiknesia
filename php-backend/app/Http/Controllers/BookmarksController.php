<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class BookmarksController extends Controller
{
    public function index(Request $request)
    {
        try {
            $user = $request->user();
            $userId = $user->id;

            $page = (int) $request->query('page', 1);
            $limit = (int) $request->query('limit', 24);

            $pageNum = max(1, $page ?: 1);
            $pageSize = max(1, min(100, $limit ?: 24));
            $offset = ($pageNum - 1) * $pageSize;

            $total = DB::table('bookmarks')
                ->where('user_id', $userId)
                ->count();

            $rows = DB::table('bookmarks as b')
                ->join('manga as m', 'm.id', '=', 'b.manga_id')
                ->select(
                    'b.id',
                    'b.manga_id',
                    'b.created_at',
                    'm.slug',
                    'm.title',
                    'm.thumbnail as cover'
                )
                ->where('b.user_id', $userId)
                ->orderByDesc('b.created_at')
                ->limit($pageSize)
                ->offset($offset)
                ->get();

            return response()->json([
                'status' => true,
                'data' => $rows,
                'meta' => [
                    'page' => $pageNum,
                    'limit' => $pageSize,
                    'total' => $total,
                    'totalPages' => $pageSize > 0 ? (int) ceil($total / $pageSize) : 1,
                ],
            ]);
        } catch (\Throwable $e) {
            return response()->json([
                'status' => false,
                'error' => 'Internal server error',
            ], 500);
        }
    }

    public function store(Request $request)
    {
        try {
            $user = $request->user();
            $userId = $user->id;

            $mangaId = $request->input('manga_id');
            $slug = $request->input('slug');

            if (!$mangaId && $slug) {
                $row = DB::table('manga')
                    ->select('id')
                    ->where('slug', $slug)
                    ->first();
                if ($row) {
                    $mangaId = $row->id;
                }
            }

            if (!$mangaId) {
                return response()->json([
                    'status' => false,
                    'error' => 'manga_id or slug required',
                ], 400);
            }

            DB::table('bookmarks')->updateOrInsert(
                ['user_id' => $userId, 'manga_id' => $mangaId],
                ['created_at' => date('Y-m-d H:i:s')]
            );

            return response()->json([
                'status' => true,
                'message' => 'Bookmark added',
            ]);
        } catch (\Throwable $e) {
            return response()->json([
                'status' => false,
                'error' => 'Internal server error',
            ], 500);
        }
    }

    public function destroy($mangaId, Request $request)
    {
        try {
            $user = $request->user();
            $userId = $user->id;

            $idOrSlug = $mangaId;

            if (!is_numeric($idOrSlug)) {
                $row = DB::table('manga')
                    ->select('id')
                    ->where('slug', $idOrSlug)
                    ->first();
                if ($row) {
                    $mangaId = $row->id;
                } else {
                    // Nothing to delete
                    return response()->json([
                        'status' => true,
                        'message' => 'Bookmark removed',
                    ]);
                }
            }

            DB::table('bookmarks')
                ->where('user_id', $userId)
                ->where('manga_id', $mangaId)
                ->delete();

            return response()->json([
                'status' => true,
                'message' => 'Bookmark removed',
            ]);
        } catch (\Throwable $e) {
            return response()->json([
                'status' => false,
                'error' => 'Internal server error',
            ], 500);
        }
    }

    public function check($mangaId, Request $request)
    {
        try {
            $user = $request->user();
            $userId = $user->id;

            $idOrSlug = $mangaId;

            if (!is_numeric($idOrSlug)) {
                $row = DB::table('manga')
                    ->select('id')
                    ->where('slug', $idOrSlug)
                    ->first();
                $mangaId = $row ? $row->id : null;
            }

            if (!$mangaId) {
                return response()->json([
                    'status' => true,
                    'bookmarked' => false,
                ]);
            }

            $exists = DB::table('bookmarks')
                ->where('user_id', $userId)
                ->where('manga_id', $mangaId)
                ->exists();

            return response()->json([
                'status' => true,
                'bookmarked' => $exists,
            ]);
        } catch (\Throwable $e) {
            return response()->json([
                'status' => false,
                'error' => 'Internal server error',
            ], 500);
        }
    }
}

