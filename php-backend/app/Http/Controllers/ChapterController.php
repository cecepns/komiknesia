<?php

namespace App\Http\Controllers;

use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

class ChapterController extends Controller
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
        $filename = 'chapter-' . time() . '-' . bin2hex(random_bytes(4)) . '.' . $extension;

        $file->move($this->uploadsDir(), $filename);

        return '/uploads-komiknesia/' . $filename;
    }
    protected function toProxiedImagePathIfNeeded(?string $imagePath, Request $request): ?string
    {
        if (!$imagePath || !is_string($imagePath)) {
            return $imagePath;
        }

        $trimmed = trim($imagePath);
        if ($trimmed === '') {
            return $imagePath;
        }

        // Jika bukan URL absolut, kembalikan apa adanya (file lokal /uploads)
        if (!str_starts_with($trimmed, 'http://') && !str_starts_with($trimmed, 'https://')) {
            return $imagePath;
        }

        try {
            $parsed = parse_url($trimmed);
            if (!isset($parsed['host'])) {
                return $imagePath;
            }

            $host = strtolower($parsed['host']);
            $path = $parsed['path'] ?? '';

            // Rewrite cd1/cdn1.softkomik ke psy1.komik.im (NodeJs/new-nodeJs dan img-file)
            $shouldRewrite = ($host === 'cd1.softkomik.online' || $host === 'cdn1.softkomik.online')
                && (str_contains($path, '/NodeJs/new-nodeJs/') || str_contains($path, '/img-file/'));
            if ($shouldRewrite) {
                $pathForPsy = preg_replace('#^/softkomik/?#i', '', $path);
                $pathForPsy = ltrim($pathForPsy, '/');
                $trimmed = 'https://psy1.komik.im/' . $pathForPsy;
            }

            $allowedHosts = [
                'cd1.softkomik.online',
                'cdn1.softkomik.online',
                'cover.softdevices.my.id',
                'psy1.komik.im',
            ];

            $parsedTrimmed = parse_url($trimmed) ?: [];
            $hostToCheck = strtolower($parsedTrimmed['host'] ?? $host);
            if (!in_array($hostToCheck, $allowedHosts, true)) {
                return $imagePath;
            }

            $base = $request->getSchemeAndHttpHost();
            $proxyUrl = $base . '/api/image-proxy?url=' . urlencode($trimmed);
            return $proxyUrl;
        } catch (\Throwable $e) {
            return $imagePath;
        }
    }

    public function index($mangaId)
    {
        try {
            $cacheKey = 'chapters:manga:' . (int) $mangaId;
            $chapters = Cache::remember($cacheKey, Carbon::now()->addMinutes(5), function () use ($mangaId) {
                return $this->fetchChaptersWithImageCount($mangaId);
            });

            return response()->json($chapters);
        } catch (\Throwable $e) {
            return response()->json(['error' => 'Internal server error'], 500);
        }
    }

    protected function fetchChaptersWithImageCount($mangaId): array
    {
        $chapters = DB::table('chapters')
            ->where('manga_id', $mangaId)
            ->orderByRaw('CAST(chapter_number AS UNSIGNED) ASC, chapter_number ASC')
            ->get();

        if ($chapters->isEmpty()) {
            return [];
        }

        $chapterIds = $chapters->pluck('id')->all();
        $placeholders = implode(',', array_fill(0, count($chapterIds), '?'));
        $counts = DB::select(
            'SELECT chapter_id, COUNT(*) as image_count FROM chapter_images WHERE chapter_id IN (' . $placeholders . ') GROUP BY chapter_id',
            $chapterIds
        );
        $countByChapterId = collect($counts)->pluck('image_count', 'chapter_id')->all();

        return $chapters->map(function ($c) use ($countByChapterId) {
            $arr = (array) $c;
            $arr['image_count'] = (int) ($countByChapterId[$c->id] ?? 0);
            return $arr;
        })->values()->all();
    }

    protected function forgetChaptersCache(int $mangaId): void
    {
        Cache::forget('chapters:manga:' . $mangaId);
    }

    protected function forgetChapterImagesCache(int $chapterId): void
    {
        Cache::forget('chapter_images:' . $chapterId);
    }

    protected function forgetChapterBySlugCache(string $slug): void
    {
        Cache::forget('chapter:slug:' . $slug);
    }

    public function store($mangaId, Request $request)
    {
        try {
            $title = $request->input('title');
            $chapterNumber = $request->input('chapter_number');

            $manga = DB::table('manga')
                ->select('slug')
                ->where('id', $mangaId)
                ->first();

            if (!$manga) {
                return response()->json(['error' => 'Manga not found'], 404);
            }

            $chapterSlug = $manga->slug . '-chapter-' . $chapterNumber;
            $coverPath = $this->storeUploadedImage($request->file('cover'));

            $id = DB::table('chapters')->insertGetId([
                'manga_id' => $mangaId,
                'title' => $title,
                'chapter_number' => $chapterNumber,
                'slug' => $chapterSlug,
                'cover' => $coverPath,
            ]);
            $this->forgetChaptersCache((int) $mangaId);

            return response()->json([
                'id' => $id,
                'message' => 'Chapter created successfully',
            ], 201);
        } catch (\Throwable $e) {
            return response()->json(['error' => 'Internal server error'], 500);
        }
    }

     public function images($chapterId, Request $request)
     {
         try {
             $cacheKey = 'chapter_images:' . (int) $chapterId;
             $rows = Cache::remember($cacheKey, Carbon::now()->addMinutes(5), function () use ($chapterId) {
                 return DB::table('chapter_images')
                     ->select('id', 'image_path', 'page_number', 'created_at')
                     ->where('chapter_id', $chapterId)
                     ->orderBy('page_number')
                     ->get()
                     ->all();
             });

             $mapped = collect($rows)->map(function ($row) use ($request) {
                 return [
                     'id' => $row->id,
                     'image_path' => $this->toProxiedImagePathIfNeeded($row->image_path, $request),
                     'page_number' => $row->page_number,
                     'created_at' => $row->created_at,
                 ];
             })->values()->all();

             return response()->json($mapped);
         } catch (\Throwable $e) {
             return response()->json(['error' => 'Internal server error'], 500);
         }
     }

     public function showBySlug($slug, Request $request)
     {
         try {
             $cacheKey = 'chapter:slug:' . $slug;
             $cached = Cache::remember($cacheKey, Carbon::now()->addMinutes(5), function () use ($slug) {
                 return $this->fetchChapterDataBySlug($slug);
             });

             if ($cached === null) {
                 return response()->json([
                     'status' => false,
                     'error' => 'Chapter tidak ditemukan',
                 ], 404);
             }

             $images = collect($cached['rawImagePaths'])->map(function ($path) use ($request) {
                 return $this->toProxiedImagePathIfNeeded($path, $request);
             })->values()->all();

             $responseData = [
                 'images' => $images,
                 'content' => $cached['content'],
                 'chapters' => $cached['allChapters'],
                 'number' => $cached['chapter']->number,
             ];

             return response()->json([
                 'status' => true,
                 'data' => $responseData,
             ]);
         } catch (\Throwable $e) {
             return response()->json([
                 'status' => false,
                 'error' => 'Internal server error',
             ], 500);
         }
     }

     protected function fetchChapterDataBySlug(string $slug): ?array
     {
         $chapter = DB::table('chapters as c')
             ->join('manga as m', 'c.manga_id', '=', 'm.id')
             ->select(
                 'c.id',
                 'c.chapter_number as number',
                 'c.title',
                 'c.slug',
                 'c.manga_id',
                 'm.is_input_manual',
                 'm.slug as manga_slug',
                 'm.title as manga_title',
                 'm.thumbnail as manga_cover',
                 'm.synopsis as manga_sinopsis',
                 'm.author as manga_author',
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
                 'm.status'
             )
             ->where('c.slug', $slug)
             ->first();

         if (!$chapter || !$chapter->is_input_manual) {
             return null;
         }

         $rawImagePaths = DB::table('chapter_images')
             ->where('chapter_id', $chapter->id)
             ->orderBy('page_number')
             ->pluck('image_path')
             ->all();

         $allChapters = DB::table('chapters as c')
             ->select(
                 'c.id',
                 'c.westmanga_chapter_id as content_id',
                 'c.chapter_number as number',
                 'c.title',
                 'c.slug',
                 'c.created_at',
                 DB::raw('UNIX_TIMESTAMP(c.created_at) as created_at_timestamp')
             )
             ->where('c.manga_id', $chapter->manga_id)
             ->orderByRaw('CAST(c.chapter_number AS UNSIGNED) DESC, c.chapter_number DESC')
             ->get()
             ->map(function ($ch) {
                 return [
                     'id' => $ch->id,
                     'content_id' => $ch->content_id ?? $ch->id,
                     'number' => $ch->number,
                     'title' => $ch->title ?: ('Chapter ' . $ch->number),
                     'slug' => $ch->slug,
                     'created_at' => [
                         'time' => (int) $ch->created_at_timestamp,
                         'formatted' => $ch->created_at,
                     ],
                 ];
             })
             ->values()
             ->all();

         $genres = DB::table('manga_genres as mg')
             ->join('categories as c', 'mg.category_id', '=', 'c.id')
             ->select('c.id', 'c.name', 'c.slug')
             ->where('mg.manga_id', $chapter->manga_id)
             ->get()
             ->all();

         $content = [
             'id' => $chapter->manga_id,
             'title' => $chapter->manga_title,
             'slug' => $chapter->manga_slug,
             'alternative_name' => null,
             'author' => $chapter->manga_author ?? 'Unknown',
             'sinopsis' => $chapter->manga_sinopsis ?? null,
             'cover' => $chapter->manga_cover ?? null,
             'content_type' => $chapter->content_type ?? 'comic',
             'country_id' => $chapter->country_id ?? null,
             'color' => (bool) $chapter->color,
             'hot' => (bool) $chapter->hot,
             'is_project' => (bool) $chapter->is_project,
             'is_safe' => (bool) $chapter->is_safe,
             'rating' => (float) ($chapter->rating ?? 0),
             'bookmark_count' => $chapter->bookmark_count ?? 0,
             'total_views' => $chapter->total_views ?? 0,
             'release' => $chapter->release ?? null,
             'status' => $chapter->status ?? 'ongoing',
             'genres' => $genres,
         ];

         return [
             'chapter' => $chapter,
             'rawImagePaths' => $rawImagePaths,
             'allChapters' => $allChapters,
             'content' => $content,
         ];
     }

    public function update($id, Request $request)
    {
        try {
            $chapter = DB::table('chapters')->where('id', $id)->first();
            if (!$chapter) {
                return response()->json(['error' => 'Chapter not found'], 404);
            }

            $manga = DB::table('manga')
                ->select('slug')
                ->where('id', $chapter->manga_id)
                ->first();

            if (!$manga) {
                return response()->json(['error' => 'Manga not found'], 404);
            }

            $title = $request->input('title', $chapter->title);
            $chapterNumber = $request->input('chapter_number', $chapter->chapter_number);
            $chapterSlug = $manga->slug . '-chapter-' . $chapterNumber;

            $data = [
                'title' => $title,
                'chapter_number' => $chapterNumber,
                'slug' => $chapterSlug,
            ];

            $cover = $this->storeUploadedImage($request->file('cover'));
            if ($cover) {
                $data['cover'] = $cover;
            }

            DB::table('chapters')
                ->where('id', $id)
                ->update($data);
            $this->forgetChaptersCache((int) $chapter->manga_id);
            $this->forgetChapterBySlugCache($chapterSlug);

            return response()->json(['message' => 'Chapter updated successfully']);
        } catch (\Throwable $e) {
            return response()->json(['error' => 'Internal server error'], 500);
        }
    }

    public function destroy($id)
    {
        try {
            $chapter = DB::table('chapters')
                ->select('id', 'manga_id')
                ->where('id', $id)
                ->first();

            if (!$chapter) {
                return response()->json(['error' => 'Chapter not found'], 404);
            }

            $manga = DB::table('manga')
                ->select('is_input_manual')
                ->where('id', $chapter->manga_id)
                ->first();

            if (!$manga || !$manga->is_input_manual) {
                return response()->json(['error' => 'Chapter cannot be deleted (not manual manga)'], 400);
            }

            $chapterSlug = (DB::table('chapters')->where('id', $chapter->id)->value('slug')) ?: '';
            DB::table('chapter_images')->where('chapter_id', $chapter->id)->delete();
            DB::table('chapters')->where('id', $chapter->id)->delete();
            $this->forgetChaptersCache((int) $chapter->manga_id);
            $this->forgetChapterImagesCache((int) $chapter->id);
            if ($chapterSlug) {
                $this->forgetChapterBySlugCache($chapterSlug);
            }

            return response()->json(['message' => 'Chapter deleted successfully']);
        } catch (\Throwable $e) {
            return response()->json(['error' => 'Internal server error'], 500);
        }
    }

    public function uploadImages($chapterId, Request $request)
    {
        try {
            $chapter = DB::table('chapters')->where('id', $chapterId)->first();
            if (!$chapter) {
                return response()->json(['error' => 'Chapter not found'], 404);
            }

            $files = $request->file('images', []);
            if (!is_array($files) || count($files) === 0) {
                return response()->json(['error' => 'No images provided'], 400);
            }

            $maxPage = DB::table('chapter_images')
                ->where('chapter_id', $chapterId)
                ->max('page_number');

            $startPageNumber = (int) ($maxPage ?? 0) + 1;

            $inserts = [];
            foreach ($files as $index => $file) {
                $path = $this->storeUploadedImage($file);
                if ($path) {
                    $inserts[] = [
                        'chapter_id' => $chapterId,
                        'image_path' => $path,
                        'page_number' => $startPageNumber + $index,
                    ];
                }
            }

            if (!empty($inserts)) {
                DB::table('chapter_images')->insert($inserts);
                $this->forgetChapterImagesCache((int) $chapterId);
                $slug = DB::table('chapters')->where('id', $chapterId)->value('slug');
                if ($slug) {
                    $this->forgetChapterBySlugCache($slug);
                }
            }

            return response()->json(['message' => 'Images uploaded successfully'], 201);
        } catch (\Throwable $e) {
            return response()->json(['error' => 'Internal server error'], 500);
        }
    }

    public function imagesFromUrls($chapterId, Request $request)
    {
        try {
            $chapter = DB::table('chapters')->where('id', $chapterId)->first();
            if (!$chapter) {
                return response()->json(['error' => 'Chapter not found'], 404);
            }

            $images = $request->input('images', []);
            if (!is_array($images) || empty($images)) {
                return response()->json(['error' => 'No images provided'], 400);
            }

            $maxPage = DB::table('chapter_images')
                ->where('chapter_id', $chapterId)
                ->max('page_number');

            $startPageNumber = (int) ($maxPage ?? 0) + 1;

            $inserts = [];
            foreach ($images as $index => $url) {
                if (!is_string($url) || trim($url) === '') {
                    continue;
                }
                $inserts[] = [
                    'chapter_id' => $chapterId,
                    'image_path' => $url,
                    'page_number' => $startPageNumber + $index,
                ];
            }

            if (!empty($inserts)) {
                DB::table('chapter_images')->insert($inserts);
                $this->forgetChapterImagesCache((int) $chapterId);
                $slug = DB::table('chapters')->where('id', $chapterId)->value('slug');
                if ($slug) {
                    $this->forgetChapterBySlugCache($slug);
                }
            }

            return response()->json(['message' => 'Images created from URLs successfully'], 201);
        } catch (\Throwable $e) {
            return response()->json(['error' => 'Internal server error'], 500);
        }
    }

    public function reorderImages($chapterId, Request $request)
    {
        try {
            $images = $request->input('images');
            if (!is_array($images) || empty($images)) {
                return response()->json(['error' => 'Images array is required'], 400);
            }

            $ids = [];
            foreach ($images as $img) {
                if (!isset($img['id']) || !isset($img['page_number'])) {
                    return response()->json(['error' => 'Each image must have id and page_number'], 400);
                }
                $ids[] = (int) $img['id'];
            }

            $existing = DB::table('chapter_images')
                ->where('chapter_id', $chapterId)
                ->whereIn('id', $ids)
                ->count();

            if ($existing !== count($ids)) {
                return response()->json(['error' => 'Some images do not belong to this chapter'], 400);
            }

            foreach ($images as $img) {
                DB::table('chapter_images')
                    ->where('id', (int) $img['id'])
                    ->update(['page_number' => (int) $img['page_number']]);
            }
            $this->forgetChapterImagesCache((int) $chapterId);
            $slug = DB::table('chapters')->where('id', $chapterId)->value('slug');
            if ($slug) {
                $this->forgetChapterBySlugCache($slug);
            }

            return response()->json(['message' => 'Images reordered successfully']);
        } catch (\Throwable $e) {
            return response()->json(['error' => 'Internal server error'], 500);
        }
    }

    public function deleteImage($chapterId, $imageId)
    {
        try {
            $image = DB::table('chapter_images')
                ->select('id')
                ->where('id', $imageId)
                ->where('chapter_id', $chapterId)
                ->first();

            if (!$image) {
                return response()->json(['error' => 'Image not found'], 404);
            }

            DB::table('chapter_images')
                ->where('id', $imageId)
                ->delete();
            $this->forgetChapterImagesCache((int) $chapterId);
            $slug = DB::table('chapters')->where('id', $chapterId)->value('slug');
            if ($slug) {
                $this->forgetChapterBySlugCache($slug);
            }

            return response()->json(['message' => 'Image deleted successfully']);
        } catch (\Throwable $e) {
            return response()->json(['error' => 'Internal server error'], 500);
        }
    }
}

