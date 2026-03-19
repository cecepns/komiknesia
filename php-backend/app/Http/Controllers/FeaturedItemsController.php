<?php

namespace App\Http\Controllers;

use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

class FeaturedItemsController extends Controller
{
    protected function getFeaturedCacheKey(?string $type, $active): string
    {
        $typeKey = $type ?: 'all';
        $activeKey = $active === null || $active === '' ? 'all' : ($active === 'true' ? '1' : '0');
        return 'featured_items:type:' . $typeKey . ':active:' . $activeKey;
    }

    protected function forgetFeaturedCache(): void
    {
        $types = ['all', 'carousel', 'grid', 'list', 'banner', 'popular'];
        $actives = ['all', '1', '0'];
        foreach ($types as $t) {
            foreach ($actives as $a) {
                Cache::forget('featured_items:type:' . $t . ':active:' . $a);
            }
        }
    }

    public function index(Request $request)
    {
        try {
            $type = $request->query('type');
            $active = $request->query('active');
            $cacheKey = $this->getFeaturedCacheKey($type, $active);

            $result = Cache::remember($cacheKey, Carbon::now()->addMinutes(5), function () use ($type, $active) {
                return $this->fetchFeaturedItems($type, $active);
            });

            return response()->json($result);
        } catch (\Throwable $e) {
            return response()->json(['error' => 'Internal server error'], 500);
        }
    }

    protected function fetchFeaturedItems(?string $type, $active): array
    {
        $query = DB::table('featured_items as fi')
                ->join('manga as m', 'fi.manga_id', '=', 'm.id')
                ->select(
                    'fi.*',
                    'm.id as manga_id',
                    'm.title',
                    'm.slug',
                    'm.thumbnail as cover',
                    'm.alternative_name',
                    'm.author',
                    'm.synopsis',
                    'm.content_type',
                    'm.country_id',
                    'm.color',
                    'm.hot',
                    'm.is_project',
                    'm.is_safe',
                    'm.rating',
                    'm.bookmark_count',
                    'm.views as total_views',
                    'm.release',
                    'm.status',
                    'm.is_input_manual',
                    'm.westmanga_id'
                )
                ->orderBy('fi.display_order')
                ->orderByDesc('fi.created_at');

            if ($type) {
                $query->where('fi.featured_type', $type);
            }

            if ($active !== null && $active !== '') {
                $query->where('fi.is_active', $active === 'true');
            }

            $items = $query->get();

            if ($items->isEmpty()) {
                return [];
            }

            $mangaIds = $items->pluck('manga_id')->all();

            $genresByMangaId = [];
            if (!empty($mangaIds)) {
                $genreRows = DB::table('manga_genres as mg')
                    ->join('categories as c', 'mg.category_id', '=', 'c.id')
                    ->select('mg.manga_id', 'c.id', 'c.name', 'c.slug')
                    ->whereIn('mg.manga_id', $mangaIds)
                    ->get();

                foreach ($genreRows as $row) {
                    if (!isset($genresByMangaId[$row->manga_id])) {
                        $genresByMangaId[$row->manga_id] = [];
                    }
                    $genresByMangaId[$row->manga_id][] = [
                        'id' => $row->id,
                        'name' => $row->name,
                        'slug' => $row->slug,
                    ];
                }
            }

            $lastChapterByMangaId = [];
            if (!empty($mangaIds)) {
                $lastChapterRows = DB::select(
                    '
                    SELECT
                      t.manga_id,
                      c.chapter_number AS number,
                      c.title,
                      c.slug,
                      c.created_at,
                      UNIX_TIMESTAMP(c.created_at) AS created_at_timestamp
                    FROM (
                      SELECT
                        manga_id,
                        MAX(CAST(chapter_number AS UNSIGNED)) AS max_chapter_number
                      FROM chapters
                      WHERE manga_id IN (' . implode(',', array_fill(0, count($mangaIds), '?')) . ')
                      GROUP BY manga_id
                    ) t
                    JOIN chapters c
                      ON c.manga_id = t.manga_id
                     AND CAST(c.chapter_number AS UNSIGNED) = t.max_chapter_number
                    ',
                    $mangaIds
                );

                foreach ($lastChapterRows as $row) {
                    $lastChapterByMangaId[$row->manga_id] = [
                        'number' => $row->number,
                        'title' => $row->title,
                        'slug' => $row->slug,
                        'created_at' => [
                            'time' => (int) $row->created_at_timestamp,
                        ],
                    ];
                }
            }

            return $items->map(function ($item) use ($genresByMangaId, $lastChapterByMangaId) {
                $genres = $genresByMangaId[$item->manga_id] ?? [];
                $lastChapter = $lastChapterByMangaId[$item->manga_id] ?? null;

                $itemArray = (array) $item;
                $itemArray['cover'] = $this->toCoverImageUrl($itemArray['cover'] ?? null);
                $itemArray['genres'] = $genres;
                $itemArray['lastChapters'] = $lastChapter ? [$lastChapter] : [];

                return $itemArray;
            })->values()->all();
    }

    public function store(Request $request)
    {
        try {
            // Hanya gunakan kolom yang dipastikan ada di tabel featured_items:
            // manga_id, featured_type, display_order, is_active
            $data = $request->only([
                'manga_id',
                'featured_type',
                'display_order',
                'is_active',
            ]);

            if (empty($data['manga_id'])) {
                return response()->json(['error' => 'manga_id is required'], 400);
            }

            $mangaExists = DB::table('manga')
                ->where('id', $data['manga_id'])
                ->exists();

            if (!$mangaExists) {
                return response()->json(['error' => 'Manga not found for given manga_id'], 400);
            }

            $insert = [
                'manga_id' => (int) $data['manga_id'],
                'featured_type' => $data['featured_type'] ?? null,
                'display_order' => isset($data['display_order']) ? (int) $data['display_order'] : 0,
                'is_active' => isset($data['is_active']) ? (bool) $data['is_active'] : true,
            ];

            $id = DB::table('featured_items')->insertGetId($insert);
            $this->forgetFeaturedCache();

            return response()->json([
                'id' => $id,
                'message' => 'Featured item created successfully',
            ], 201);
        } catch (\Throwable $e) {
            \Log::error('FeaturedItemsController@store error', [
                'message' => $e->getMessage(),
            ]);
            return response()->json(['error' => 'Internal server error'], 500);
        }
    }

    public function update($id, Request $request)
    {
        try {
            $data = $request->only([
                'manga_id',
                'featured_type',
                'display_order',
                'is_active',
            ]);

            $updates = [];
            if (array_key_exists('manga_id', $data) && $data['manga_id'] !== null) {
                $updates['manga_id'] = (int) $data['manga_id'];
            }
            if (array_key_exists('featured_type', $data)) {
                $updates['featured_type'] = $data['featured_type'];
            }
            if (array_key_exists('display_order', $data) && $data['display_order'] !== null) {
                $updates['display_order'] = (int) $data['display_order'];
            }
            if (array_key_exists('is_active', $data) && $data['is_active'] !== null) {
                $updates['is_active'] = (bool) $data['is_active'];
            }

            if (!empty($updates)) {
                DB::table('featured_items')
                    ->where('id', $id)
                    ->update($updates);
                $this->forgetFeaturedCache();
            }

            return response()->json(['message' => 'Featured item updated successfully']);
        } catch (\Throwable $e) {
            return response()->json(['error' => 'Internal server error'], 500);
        }
    }

    public function clearCache()
    {
        try {
            $this->forgetFeaturedCache();
            return response()->json(['message' => 'Featured items cache cleared']);
        } catch (\Throwable $e) {
            return response()->json(['error' => 'Internal server error'], 500);
        }
    }

    public function destroy($id)
    {
        try {
            DB::table('featured_items')
                ->where('id', $id)
                ->delete();
            $this->forgetFeaturedCache();

            return response()->json(['message' => 'Featured item deleted successfully']);
        } catch (\Throwable $e) {
            return response()->json(['error' => 'Internal server error'], 500);
        }
    }
}

