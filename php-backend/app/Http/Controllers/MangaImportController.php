<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class MangaImportController extends Controller
{
    protected function generateSlug(string $text): string
    {
        $slug = strtolower(trim($text));
        $slug = preg_replace('/[^a-z0-9]+/i', '-', $slug);
        $slug = trim($slug, '-');

        return $slug !== '' ? $slug : ('manga-' . time());
    }

    /**
     * POST /api/manga/import-softkomik
     *
     * Body diharapkan mengikuti struktur sample scrap:
     * {
     *   "page": 1,
     *   "maxPage": 7209,
     *   "data": [ { ...mangaItem } ]
     * }
     */
    public function importSoftkomik(Request $request)
    {
        try {
            $payload = $request->all();
            $items = $payload['data'] ?? [];

            if (!is_array($items) || empty($items)) {
                return response()->json([
                    'status' => false,
                    'message' => 'Field data harus berupa array dan tidak boleh kosong',
                ], 400);
            }

            $summary = [
                'manga_created' => 0,
                'manga_existing' => 0,
                'chapters_created' => 0,
                'chapters_skipped_existing' => 0,
                'images_created' => 0,
            ];

            foreach ($items as $item) {
                if (!is_array($item)) {
                    continue;
                }

                // Basic fields
                $title = isset($item['title']) ? (string) $item['title'] : null;
                if (!$title) {
                    continue;
                }

                $titleSlug = isset($item['title_slug']) ? (string) $item['title_slug'] : null;
                $rawDetail = $item['detail']['raw'] ?? [];

                $slugSource = $titleSlug && trim($titleSlug) !== '' ? $titleSlug : $title;
                $slug = $this->generateSlug($slugSource);

                // Cari / buat manga
                $manga = DB::table('manga')
                    ->where('slug', $slug)
                    ->first();

                if ($manga) {
                    $mangaId = $manga->id;
                    $summary['manga_existing']++;
                } else {
                    $author = isset($rawDetail['author']) ? (string) $rawDetail['author'] : null;
                    $synopsis = isset($rawDetail['sinopsis']) ? (string) $rawDetail['sinopsis'] : null;

                    $thumbnail = isset($item['gambar']) ? (string) $item['gambar'] : null;
                    $status = isset($item['status']) ? (string) $item['status'] : 'ongoing';
                    $type = isset($item['type']) ? (string) $item['type'] : 'manga';

                    $mangaId = DB::table('manga')->insertGetId([
                        'title' => $title,
                        'slug' => $slug,
                        'author' => $author,
                        'synopsis' => $synopsis,
                        'thumbnail' => $thumbnail,
                        'status' => $status,
                        'content_type' => $type,
                        'is_input_manual' => true,
                        'source' => 'softkomik',
                    ]);

                    $summary['manga_created']++;
                }

                // Ambil slug manga yang dipakai untuk slug chapter
                $mangaSlug = $slug;

                $chapters = $item['chapters'] ?? [];
                if (!is_array($chapters) || empty($chapters)) {
                    continue;
                }

                foreach ($chapters as $chapterItem) {
                    if (!is_array($chapterItem)) {
                        continue;
                    }

                    $chapterNumber = isset($chapterItem['chapter']) ? (string) $chapterItem['chapter'] : null;
                    if ($chapterNumber === null || $chapterNumber === '') {
                        continue;
                    }

                    // Cek apakah chapter sudah ada (hindari duplikat)
                    $existingChapter = DB::table('chapters')
                        ->where('manga_id', $mangaId)
                        ->where('chapter_number', $chapterNumber)
                        ->first();

                    if ($existingChapter) {
                        $summary['chapters_skipped_existing']++;
                        continue;
                    }

                    DB::beginTransaction();

                    try {
                        $chapterSlug = $mangaSlug . '-chapter-' . $chapterNumber;

                        $chapterId = DB::table('chapters')->insertGetId([
                            'manga_id' => $mangaId,
                            'title' => 'Chapter ' . $chapterNumber,
                            'chapter_number' => $chapterNumber,
                            'slug' => $chapterSlug,
                        ]);

                        $summary['chapters_created']++;

                        $images = $chapterItem['images'] ?? [];
                        if (is_array($images) && !empty($images)) {
                            // Hilangkan duplikat di dalam array images itu sendiri
                            $images = array_values(array_unique(array_filter($images, function ($url) {
                                return is_string($url) && trim($url) !== '';
                            })));

                            if (!empty($images)) {
                                // Cari max page_number yang sudah ada untuk chapter ini
                                $maxPage = DB::table('chapter_images')
                                    ->where('chapter_id', $chapterId)
                                    ->max('page_number');

                                $startPageNumber = (int) ($maxPage ?? 0) + 1;

                                $inserts = [];
                                foreach ($images as $index => $url) {
                                    // Pastikan tidak ada duplikat image_path di DB untuk chapter ini
                                    $alreadyExists = DB::table('chapter_images')
                                        ->where('chapter_id', $chapterId)
                                        ->where('image_path', $url)
                                        ->exists();

                                    if ($alreadyExists) {
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
                                    $summary['images_created'] += count($inserts);
                                }
                            }
                        }

                        DB::commit();
                    } catch (\Throwable $e) {
                        DB::rollBack();
                        // lanjut ke item berikutnya, tidak hentikan seluruh proses
                    }
                }
            }

            return response()->json([
                'status' => true,
                'message' => 'Import softkomik selesai',
                'summary' => $summary,
            ]);
        } catch (\Throwable $e) {
            return response()->json([
                'status' => false,
                'message' => 'Internal server error',
            ], 500);
        }
    }
}

