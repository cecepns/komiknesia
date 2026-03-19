<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Cache;
use Carbon\Carbon;

class MangaController extends Controller
{
    protected function uploadsDir(): string
    {
        $dir = base_path('public/uploads-komiknesia');
        if (!is_dir($dir)) {
            mkdir($dir, 0775, true);
        }
        return $dir;
    }

    protected function storeUploadedImage(?\Illuminate\Http\UploadedFile $file): ?string
    {
        if (!$file) {
            return null;
        }

        $extension = $file->getClientOriginalExtension() ?: 'jpg';
        $filename = 'manga-' . time() . '-' . bin2hex(random_bytes(4)) . '.' . $extension;

        $file->move($this->uploadsDir(), $filename);

        return '/uploads-komiknesia/' . $filename;
    }

    protected function generateSlug(string $text): string
    {
        $slug = strtolower(trim($text));
        $slug = preg_replace('/[^a-z0-9]+/i', '-', $slug);
        $slug = trim($slug, '-');
        return $slug !== '' ? $slug : ('manga-' . time());
    }

    public function index(Request $request)
    {
        try {
            $page = (int) $request->query('page', 1);
            $limit = (int) $request->query('limit', 10);
            $search = (string) $request->query('search', '');
            $category = (string) $request->query('category', '');
            $source = (string) $request->query('source', 'all');

            $offset = ($page - 1) * $limit;

            $query = DB::table('manga as m')
                ->leftJoin('categories as c', 'm.category_id', '=', 'c.id')
                ->leftJoin('votes as v', 'm.id', '=', 'v.manga_id')
                ->select('m.*', 'c.name as category_name', DB::raw('COUNT(DISTINCT v.id) as votes'))
                ->groupBy('m.id')
                ->orderByDesc('m.created_at');

            if ($search !== '') {
                $query->where(function ($q) use ($search) {
                    $q->where('m.title', 'LIKE', '%' . $search . '%')
                      ->orWhere('m.alternative_name', 'LIKE', '%' . $search . '%');
                });
            }

            if ($category !== '') {
                $query->where(function ($q) use ($category) {
                    $q->where('m.category_id', $category)
                      ->orWhereIn('m.id', function ($sub) use ($category) {
                          $sub->from('manga_genres')
                              ->select('manga_id')
                              ->where('category_id', $category);
                      });
                });
            }

            if ($source === 'manual') {
                $query->where('m.is_input_manual', true);
            } elseif ($source === 'westmanga') {
                $query->where('m.is_input_manual', false);
            }

            $totalQuery = clone $query;
            $total = (clone $totalQuery)->select(DB::raw('COUNT(DISTINCT m.id) as total'))->first()->total ?? 0;

            $manga = $query->limit($limit)->offset($offset)->get();

            $mangaIds = $manga->pluck('id')->all();
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

            $mangaTransformed = $manga->map(function ($m) use ($genresByMangaId) {
                $m->genres = $genresByMangaId[$m->id] ?? [];
                return $m;
            });

            $totalPages = $limit > 0 ? (int) ceil($total / $limit) : 1;

            return response()->json([
                'manga' => $mangaTransformed,
                'totalPages' => $totalPages,
                'currentPage' => $page,
                'totalCount' => $total,
            ]);
        } catch (\Throwable $e) {
            return response()->json(['error' => 'Internal server error'], 500);
        }
    }

    /**
     * POST /api/comic/{slug}/view
     * Increment view counter by manga slug.
     * Mirrors Node backend behavior: if manga does not exist locally,
     * return success but do not update views.
     */
    public function incrementView($slug)
    {
        try {
            $manga = DB::table('manga')
                ->select('id', 'views')
                ->where('slug', $slug)
                ->first();

            if (!$manga) {
                return response()->json([
                    'status' => true,
                    'data' => [
                        'slug' => $slug,
                        'views' => null,
                        'message' => 'Manga not in local database, view not tracked',
                    ],
                ]);
            }

            $currentViews = (int) ($manga->views ?? 0);
            $newViews = $currentViews + 1;

            DB::table('manga')
                ->where('id', $manga->id)
                ->update(['views' => $newViews]);

            return response()->json([
                'status' => true,
                'data' => [
                    'slug' => $slug,
                    'views' => $newViews,
                    'previous_views' => $currentViews,
                ],
                'message' => 'View counter updated successfully',
            ]);
        } catch (\Throwable $e) {
            return response()->json([
                'status' => false,
                'error' => 'Internal server error',
            ], 500);
        }
    }

    public function showBySlug($slug)
    {
        try {
            $manga = DB::table('manga as m')
                ->leftJoin('categories as c', 'm.category_id', '=', 'c.id')
                ->leftJoin('votes as v', 'm.id', '=', 'v.manga_id')
                ->select(
                    'm.*',
                    'c.name as category_name',
                    DB::raw('COUNT(v.id) as votes')
                )
                ->where('m.slug', $slug)
                ->groupBy('m.id')
                ->first();

            if (!$manga) {
                return response()->json(['error' => 'Manga not found'], 404);
            }

            $genres = DB::table('manga_genres as mg')
                ->join('categories as c', 'mg.category_id', '=', 'c.id')
                ->select('c.id', 'c.name', 'c.slug')
                ->where('mg.manga_id', $manga->id)
                ->get();

            $chapters = DB::table('chapters as c')
                ->leftJoin('chapter_images as ci', 'c.id', '=', 'ci.chapter_id')
                ->select('c.*', DB::raw('COUNT(ci.id) as image_count'))
                ->where('c.manga_id', $manga->id)
                ->groupBy('c.id')
                ->orderByDesc('c.chapter_number')
                ->get();

            $manga->genres = $genres;
            $manga->chapters = $chapters;
            $manga->thumbnail = $this->toCoverImageUrl($manga->thumbnail ?? null);

            return response()->json($manga);
        } catch (\Throwable $e) {
            return response()->json(['error' => 'Internal server error'], 500);
        }
    }

    public function showComic($slug)
    {
        try {
            $cacheKey = 'comic:slug:' . $slug;

            if ($cached = Cache::get($cacheKey)) {
                return response()->json($cached);
            }

            $manga = DB::table('manga')
                ->where('slug', $slug)
                ->first();

            if (!$manga) {
                return response()->json([
                    'status' => false,
                    'error' => 'Manga tidak ditemukan',
                ], 404);
            }

            if (!$manga->is_input_manual) {
                return response()->json([
                    'status' => false,
                    'error' => 'Manga tidak ditemukan',
                ], 404);
            }

            $genres = DB::table('manga_genres as mg')
                ->join('categories as c', 'mg.category_id', '=', 'c.id')
                ->select('c.id', 'c.name', 'c.slug')
                ->where('mg.manga_id', $manga->id)
                ->get();

            $chapters = DB::table('chapters as c')
                ->select(
                    'c.id',
                    'c.westmanga_chapter_id as content_id',
                    'c.chapter_number as number',
                    'c.title',
                    'c.slug',
                    'c.created_at',
                    'c.updated_at',
                    DB::raw('UNIX_TIMESTAMP(c.created_at) as created_at_timestamp'),
                    DB::raw('UNIX_TIMESTAMP(COALESCE(c.updated_at, c.created_at)) as updated_at_timestamp')
                )
                ->where('c.manga_id', $manga->id)
                ->orderByRaw('CAST(c.chapter_number AS UNSIGNED) DESC, c.chapter_number DESC')
                ->get();

            $mangaData = [
                'id' => $manga->id,
                'title' => $manga->title,
                'slug' => $manga->slug,
                'alternative_name' => $manga->alternative_name ?? null,
                'author' => $manga->author ?? 'Unknown',
                'sinopsis' => $manga->synopsis ?? null,
                'cover' => $this->toCoverImageUrl($manga->thumbnail ?? null),
                'content_type' => $manga->content_type ?? 'comic',
                'country_id' => $manga->country_id ?? null,
                'color' => (bool) ($manga->color ?? false),
                'hot' => (bool) ($manga->hot ?? false),
                'is_project' => (bool) ($manga->is_project ?? false),
                'is_safe' => (bool) ($manga->is_safe ?? false),
                'rating' => (float) ($manga->rating ?? 0),
                'bookmark_count' => $manga->bookmark_count ?? 0,
                'total_views' => $manga->views ?? 0,
                'release' => $manga->release ?? null,
                'status' => $manga->status ?? 'ongoing',
                'genres' => $genres,
                'chapters' => $chapters->map(function ($ch) {
                    $updateTime = $ch->updated_at ?? $ch->created_at;
                    return [
                        'id' => $ch->id,
                        'content_id' => $ch->content_id ?? $ch->id,
                        'number' => $ch->number,
                        'title' => $ch->title ?? ('Chapter ' . $ch->number),
                        'slug' => $ch->slug,
                        'created_at' => [
                            'time' => (int) $ch->created_at_timestamp,
                            'formatted' => $ch->created_at,
                        ],
                        'updated_at' => [
                            'time' => (int) $ch->updated_at_timestamp,
                            'formatted' => $updateTime,
                        ],
                    ];
                }),
            ];

            $responsePayload = [
                'status' => true,
                'data' => $mangaData,
            ];

            Cache::put($cacheKey, $responsePayload, Carbon::now()->addMinutes(5));

            return response()->json($responsePayload);
        } catch (\Throwable $e) {
            return response()->json([
                'status' => false,
                'error' => 'Internal server error',
            ], 500);
        }
    }

    public function search(Request $request)
    {
        try {
            $query = (string) $request->query('query', '');
            $page = (int) $request->query('page', 1);
            $perPage = (int) $request->query('per_page', 40);

            if ($query === '') {
                return response()->json(['error' => 'Search query is required'], 400);
            }

            $builder = DB::table('manga as m')
                ->where(function ($q) use ($query) {
                    $q->where('m.title', 'LIKE', '%' . $query . '%')
                      ->orWhere('m.alternative_name', 'LIKE', '%' . $query . '%');
                });

            $results = $builder->get();

            $offset = ($page - 1) * $perPage;
            $localResults = $results->slice($offset, $perPage)->values()->map(function ($m) {
                $m->thumbnail = $this->toCoverImageUrl($m->thumbnail ?? null);
                return $m;
            });
            $total = $results->count();
            $lastPage = $perPage > 0 ? (int) ceil($total / $perPage) : 1;

            return response()->json([
                'local' => $localResults,
                'westmanga' => [],
                'total' => $total,
                'paginator' => [
                    'current_page' => $page,
                    'last_page' => $lastPage,
                    'per_page' => $perPage,
                    'total' => $total,
                    'from' => $total > 0 ? $offset + 1 : 0,
                    'to' => min($offset + $perPage, $total),
                ],
            ]);
        } catch (\Throwable $e) {
            return response()->json(['error' => 'Internal server error'], 500);
        }
    }

    public function store(Request $request)
    {
        try {
            $title = (string) $request->input('title');
            $author = (string) $request->input('author');
            $synopsis = (string) $request->input('synopsis', '');
            $categoryId = $request->input('category_id');
            $genreIds = $request->input('genre_ids');
            $alternativeName = $request->input('alternative_name');
            $contentType = $request->input('content_type', 'manga');
            $countryId = $request->input('country_id');
            $release = $request->input('release');
            $status = $request->input('status', 'ongoing');
            $rating = $request->input('rating');
            $color = $request->input('color');
            $source = $request->input('source');
            $slugOverride = $request->input('slug');

            if ($title === '') {
                return response()->json(['error' => 'Title is required'], 400);
            }

            $slugSource = $slugOverride && trim((string) $slugOverride) !== '' ? $slugOverride : $title;
            $slug = $this->generateSlug($slugSource);

            $exists = DB::table('manga')
                ->where('slug', $slug)
                ->exists();

            if ($exists) {
                return response()->json(['error' => 'Manga dengan judul serupa sudah ada'], 400);
            }

            $thumbnail = $this->storeUploadedImage($request->file('thumbnail'));
            $coverBackground = $this->storeUploadedImage($request->file('cover_background'));

            if (!$thumbnail) {
                $thumbnail = $request->input('thumbnail') ?: $request->input('cover');
            }

            if (!$coverBackground) {
                $coverBackground = $request->input('cover_background');
            }

            $id = DB::table('manga')->insertGetId([
                'title' => $title,
                'slug' => $slug,
                'author' => $author,
                'synopsis' => $synopsis,
                'category_id' => $categoryId,
                'thumbnail' => $thumbnail,
                'cover_background' => $coverBackground,
                'alternative_name' => $alternativeName ?: null,
                'content_type' => $contentType ?: 'manga',
                'country_id' => $countryId ?: null,
                'release' => $release ?: null,
                'status' => $status ?: 'ongoing',
                'rating' => $rating !== null && $rating !== '' ? (float) $rating : null,
                'color' => (bool) ($color === 'true' || $color === true),
                'source' => $source ?: null,
                'is_input_manual' => true,
            ]);

            if ($genreIds) {
                $genreArray = is_array($genreIds) ? $genreIds : json_decode((string) $genreIds, true);
                if (is_array($genreArray)) {
                    foreach ($genreArray as $gid) {
                        DB::table('manga_genres')->insert([
                            'manga_id' => $id,
                            'category_id' => $gid,
                        ]);
                    }
                }
            }

            return response()->json([
                'id' => $id,
                'message' => 'Manga created successfully',
            ], 201);
        } catch (\Throwable $e) {
            return response()->json(['error' => 'Internal server error'], 500);
        }
    }

    public function update($id, Request $request)
    {
        try {
            $manga = DB::table('manga')->where('id', $id)->first();
            if (!$manga) {
                return response()->json(['error' => 'Manga not found'], 404);
            }

            $title = (string) $request->input('title', $manga->title);
            $author = (string) $request->input('author', $manga->author);
            $synopsis = $request->input('synopsis', $manga->synopsis);
            $categoryId = $request->input('category_id', $manga->category_id);
            $alternativeName = $request->input('alternative_name', $manga->alternative_name);
            $contentType = $request->input('content_type', $manga->content_type);
            $countryId = $request->input('country_id', $manga->country_id);
            $release = $request->input('release', $manga->release);
            $status = $request->input('status', $manga->status);
            $rating = $request->input('rating', $manga->rating);
            $color = $request->input('color', $manga->color);
            $source = $request->input('source', $manga->source);

            $slugOverride = $request->input('slug');
            $slug = $manga->slug;
            if ($slugOverride && trim((string) $slugOverride) !== '') {
                $slug = $this->generateSlug($slugOverride);
            }

            $thumbnail = $this->storeUploadedImage($request->file('thumbnail')) ?: $manga->thumbnail;
            $coverBackground = $this->storeUploadedImage($request->file('cover_background')) ?: $manga->cover_background;

            DB::table('manga')
                ->where('id', $id)
                ->update([
                    'title' => $title,
                    'slug' => $slug,
                    'author' => $author,
                    'synopsis' => $synopsis,
                    'category_id' => $categoryId,
                    'thumbnail' => $thumbnail,
                    'cover_background' => $coverBackground,
                    'alternative_name' => $alternativeName ?: null,
                    'content_type' => $contentType ?: 'manga',
                    'country_id' => $countryId ?: null,
                    'release' => $release ?: null,
                    'status' => $status ?: 'ongoing',
                    'rating' => $rating !== null && $rating !== '' ? (float) $rating : null,
                    'color' => (bool) ($color === 'true' || $color === true),
                    'source' => $source ?: null,
                ]);

            return response()->json(['message' => 'Manga updated successfully']);
        } catch (\Throwable $e) {
            return response()->json(['error' => 'Internal server error'], 500);
        }
    }

    public function destroy($id)
    {
        try {
            $manga = DB::table('manga')->where('id', $id)->first();
            if (!$manga) {
                return response()->json(['error' => 'Manga not found'], 404);
            }

            DB::table('manga_genres')->where('manga_id', $id)->delete();
            DB::table('bookmarks')->where('manga_id', $id)->delete();

            $chapterIds = DB::table('chapters')
                ->where('manga_id', $id)
                ->pluck('id')
                ->all();

            if (!empty($chapterIds)) {
                DB::table('chapter_images')->whereIn('chapter_id', $chapterIds)->delete();
                DB::table('chapters')->whereIn('id', $chapterIds)->delete();
            }

            DB::table('manga')->where('id', $id)->delete();

            return response()->json(['message' => 'Manga deleted successfully']);
        } catch (\Throwable $e) {
            return response()->json(['error' => 'Internal server error'], 500);
        }
    }

    public function syncGenres($id, Request $request)
    {
        try {
            $genres = $request->input('genres');
            if (!is_array($genres) || empty($genres)) {
                return response()->json(['error' => 'Genres array is required'], 400);
            }

            $exists = DB::table('manga')->where('id', $id)->exists();
            if (!$exists) {
                return response()->json(['error' => 'Manga not found'], 404);
            }

            DB::table('manga_genres')->where('manga_id', $id)->delete();

            foreach ($genres as $genreId) {
                DB::table('manga_genres')->insert([
                    'manga_id' => $id,
                    'category_id' => $genreId,
                ]);
            }

            return response()->json(['message' => 'Genres synced successfully']);
        } catch (\Throwable $e) {
            return response()->json(['error' => 'Internal server error'], 500);
        }
    }
}

