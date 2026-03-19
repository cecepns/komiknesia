<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class CommentsController extends Controller
{
    /**
     * GET /api/comments
     * Query params: manga_id (id or slug), chapter_id, external_slug, scope, page, limit
     */
    public function index(Request $request)
    {
        try {
            $mangaIdParam = $request->query('manga_id');
            $chapterIdParam = $request->query('chapter_id');
            $externalSlug = $request->query('external_slug');
            $scope = $request->query('scope');
            $page = (int) ($request->query('page', 1));
            $limit = (int) ($request->query('limit', 30));

            if (!$mangaIdParam && !$chapterIdParam && !$externalSlug) {
                return response()->json([
                    'status' => false,
                    'error' => 'manga_id, chapter_id or external_slug required',
                ], 400);
            }

            $pageNum = max(1, $page ?: 1);
            $pageSize = max(1, min(100, $limit ?: 30));
            $offset = ($pageNum - 1) * $pageSize;

            $query = DB::table('comments as c')
                ->join('users as u', 'u.id', '=', 'c.user_id')
                ->select(
                    'c.id',
                    'c.user_id',
                    'c.manga_id',
                    'c.chapter_id',
                    'c.parent_id',
                    'c.body',
                    'c.created_at',
                    'u.username',
                    'u.profile_image'
                )
                ->whereNull('c.parent_id');

            $countQuery = DB::table('comments as c')
                ->whereNull('c.parent_id');

            if ($mangaIdParam !== null && $mangaIdParam !== '') {
                $resolvedMangaId = null;

                if (is_numeric($mangaIdParam)) {
                    $resolvedMangaId = (int) $mangaIdParam;
                } else {
                    $manga = DB::table('manga')
                        ->select('id')
                        ->where('slug', $mangaIdParam)
                        ->first();

                    if (!$manga) {
                        return response()->json([
                            'status' => true,
                            'data' => [],
                        ]);
                    }

                    $resolvedMangaId = $manga->id;
                }

                $query->where('c.manga_id', $resolvedMangaId);
                $countQuery->where('c.manga_id', $resolvedMangaId);
            }

            if ($chapterIdParam !== null && $chapterIdParam !== '') {
                $query->where('c.chapter_id', $chapterIdParam);
                $countQuery->where('c.chapter_id', $chapterIdParam);
            }

            if ($externalSlug !== null && $externalSlug !== '') {
                $query->where('c.external_slug', $externalSlug);
                $countQuery->where('c.external_slug', $externalSlug);
            } elseif ($mangaIdParam && $scope === 'manga') {
                $query->whereNull('c.external_slug');
                $countQuery->whereNull('c.external_slug');
            }

            $total = (int) $countQuery->count();

            $comments = $query
                ->orderBy('c.created_at', 'asc')
                ->limit($pageSize)
                ->offset($offset)
                ->get();

            $parentIds = $comments->pluck('id')->all();

            $replies = [];
            if (!empty($parentIds)) {
                $replies = DB::table('comments as c')
                    ->join('users as u', 'u.id', '=', 'c.user_id')
                    ->select(
                        'c.id',
                        'c.user_id',
                        'c.parent_id',
                        'c.body',
                        'c.created_at',
                        'u.username',
                        'u.profile_image'
                    )
                    ->whereIn('c.parent_id', $parentIds)
                    ->get();
            }

            $repliesByParent = [];
            foreach ($replies as $reply) {
                $parentId = $reply->parent_id;
                if (!isset($repliesByParent[$parentId])) {
                    $repliesByParent[$parentId] = [];
                }
                $repliesByParent[$parentId][] = $reply;
            }

            $data = $comments->map(function ($c) use ($repliesByParent) {
                $commentReplies = $repliesByParent[$c->id] ?? [];
                usort($commentReplies, function ($a, $b) {
                    return strtotime($a->created_at) <=> strtotime($b->created_at);
                });

                return [
                    'id' => $c->id,
                    'user_id' => $c->user_id,
                    'manga_id' => $c->manga_id,
                    'chapter_id' => $c->chapter_id,
                    'parent_id' => $c->parent_id,
                    'body' => $c->body,
                    'created_at' => $c->created_at,
                    'username' => $c->username,
                    'profile_image' => $c->profile_image,
                    'replies' => array_map(function ($r) {
                        return [
                            'id' => $r->id,
                            'user_id' => $r->user_id,
                            'parent_id' => $r->parent_id,
                            'body' => $r->body,
                            'created_at' => $r->created_at,
                            'username' => $r->username,
                            'profile_image' => $r->profile_image,
                        ];
                    }, $commentReplies),
                ];
            });

            return response()->json([
                'status' => true,
                'data' => $data,
                'meta' => [
                    'page' => $pageNum,
                    'limit' => $pageSize,
                    'total' => $total,
                    'totalPages' => (int) ceil($total / $pageSize),
                ],
            ]);
        } catch (\Throwable $e) {
            return response()->json([
                'status' => false,
                'error' => 'Internal server error',
            ], 500);
        }
    }

    /**
     * POST /api/comments
     * Body: { manga_id, chapter_id, parent_id, body, external_slug }
     * Requires auth (JWT).
     */
    public function store(Request $request)
    {
        try {
            $user = $request->user();
            if (!$user) {
                return response()->json([
                    'status' => false,
                    'error' => 'Unauthorized',
                ], 401);
            }

            $mangaIdParam = $request->input('manga_id');
            $chapterIdParam = $request->input('chapter_id');
            $parentId = $request->input('parent_id');
            $body = $request->input('body');
            $externalSlug = $request->input('external_slug');

            if (!$body || trim((string) $body) === '') {
                return response()->json([
                    'status' => false,
                    'error' => 'Komentar tidak boleh kosong',
                ], 400);
            }

            if (!$mangaIdParam && !$chapterIdParam) {
                return response()->json([
                    'status' => false,
                    'error' => 'manga_id or chapter_id required',
                ], 400);
            }

            $resolvedMangaId = null;
            $resolvedChapterId = null;

            if ($chapterIdParam) {
                $chapter = DB::table('chapters')
                    ->select('id', 'manga_id')
                    ->where('id', $chapterIdParam)
                    ->first();

                if ($chapter) {
                    $resolvedChapterId = $chapter->id;
                    $resolvedMangaId = $chapter->manga_id ?? null;
                } else {
                    $resolvedChapterId = null;
                }
            }

            if (!$resolvedMangaId && $mangaIdParam) {
                if (is_numeric($mangaIdParam)) {
                    $manga = DB::table('manga')
                        ->select('id')
                        ->where('id', (int) $mangaIdParam)
                        ->first();

                    $resolvedMangaId = $manga ? $manga->id : null;
                } else {
                    $manga = DB::table('manga')
                        ->select('id')
                        ->where('slug', $mangaIdParam)
                        ->first();

                    $resolvedMangaId = $manga ? $manga->id : null;
                }
            }

            $commentId = DB::table('comments')->insertGetId([
                'user_id' => $user->id,
                'manga_id' => $resolvedMangaId,
                'external_slug' => $externalSlug ?: null,
                'chapter_id' => $resolvedChapterId,
                'parent_id' => $parentId ?: null,
                'body' => trim((string) $body),
            ]);

            $comment = DB::table('comments as c')
                ->join('users as u', 'u.id', '=', 'c.user_id')
                ->select(
                    'c.id',
                    'c.user_id',
                    'c.manga_id',
                    'c.chapter_id',
                    'c.parent_id',
                    'c.body',
                    'c.created_at',
                    'u.username',
                    'u.profile_image'
                )
                ->where('c.id', $commentId)
                ->first();

            return response()->json([
                'status' => true,
                'data' => $comment,
            ]);
        } catch (\Throwable $e) {
            return response()->json([
                'status' => false,
                'error' => 'Internal server error',
            ], 500);
        }
    }

    /**
     * DELETE /api/comments/{id}
     * Only the owner of the comment can delete it.
     */
    public function destroy($id, Request $request)
    {
        try {
            $user = $request->user();
            if (!$user) {
                return response()->json([
                    'status' => false,
                    'error' => 'Unauthorized',
                ], 401);
            }

            $commentId = (int) $id;
            if ($commentId <= 0) {
                return response()->json([
                    'status' => false,
                    'error' => 'Invalid comment id',
                ], 400);
            }

            $comment = DB::table('comments')
                ->select('id')
                ->where('id', $commentId)
                ->where('user_id', $user->id)
                ->first();

            if (!$comment) {
                return response()->json([
                    'status' => false,
                    'error' => 'Comment not found',
                ], 404);
            }

            DB::table('comments')
                ->where('id', $commentId)
                ->delete();

            return response()->json([
                'status' => true,
                'message' => 'Comment deleted',
            ]);
        } catch (\Throwable $e) {
            return response()->json([
                'status' => false,
                'error' => 'Internal server error',
            ], 500);
        }
    }
}

