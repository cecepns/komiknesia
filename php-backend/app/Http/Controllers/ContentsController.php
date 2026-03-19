<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Cache;

class ContentsController extends Controller
{
    public function genres()
    {
        try {
            $genres = DB::table('categories')
                ->select('id', 'name', 'slug')
                ->orderBy('name')
                ->get();

            return response()->json([
                'status' => true,
                'data' => $genres,
            ]);
        } catch (\Throwable $e) {
            return response()->json([
                'status' => false,
                'error' => 'Internal server error',
            ], 500);
        }
    }

    /**
     * Fetch paginated local manga list with filters.
     *
     * This method is optimized to:
     * - Apply filtering and sorting in SQL
     * - Only fetch the current page worth of manga rows
     * - Then hydrate genres and last chapter data for that subset
     *
     * @param  array  $filters
     * @param  int    $pageNum 1-based page index
     * @param  int    $perPage items per page
     * @param  int|null $total will be filled with total matching rows (without pagination)
     * @return array
     */
    protected function fetchLocalManga(array $filters, int $pageNum, int $perPage, ?int &$total = null)
    {
        $q = $filters['q'] ?? null;
        $genreArray = $filters['genreArray'] ?? [];
        $status = $filters['status'] ?? null;
        $country = $filters['country'] ?? null;
        $type = $filters['type'] ?? null;
        $orderBy = $filters['orderBy'] ?? 'Update';
        $project = $filters['project'] ?? null;

        $where = ['m.is_input_manual = 1'];
        $params = [];

        if ($q && trim($q) !== '') {
            $where[] = '(m.title LIKE ? OR m.alternative_name LIKE ?)';
            $search = '%' . trim($q) . '%';
            $params[] = $search;
            $params[] = $search;
        } elseif ($project === 'true') {
            $where[] = 'm.is_project = 1';
        }

        if ($status && $status !== 'All') {
            $where[] = 'm.status = ?';
            $params[] = strtolower($status);
        }

        if ($country) {
            $where[] = 'm.country_id = ?';
            $params[] = $country;
        }

        if ($type && $type !== 'Comic') {
            $map = [
                'Manga' => 'manga',
                'Manhua' => 'manhua',
                'Manhwa' => 'manhwa',
            ];
            if (isset($map[$type])) {
                $where[] = 'm.content_type = ?';
                $params[] = $map[$type];
            }
        } elseif ($type === 'Comic') {
            $where[] = '(m.content_type = ? OR m.content_type IS NULL)';
            $params[] = 'comic';
        }

        $genreIds = [];
        foreach ((array) $genreArray as $g) {
            $id = (int) $g;
            if ($id > 0) {
                $genreIds[] = $id;
            }
        }

        // Build base FROM + WHERE clause (reused for both count + data queries)
        $baseFrom = ' FROM manga m';
        if (!empty($genreIds)) {
            $baseFrom .= ' INNER JOIN manga_genres mg ON m.id = mg.manga_id';
        }

        $baseWhere = ' WHERE ' . implode(' AND ', $where);

        $genreFilterSql = '';
        $genreParams = [];
        if (!empty($genreIds)) {
            $placeholders = implode(',', array_fill(0, count($genreIds), '?'));
            $genreFilterSql = ' AND mg.category_id IN (' . $placeholders . ')';
            $genreParams = $genreIds;
        }

        $havingSql = '';
        $havingParams = [];
        if (!empty($genreIds)) {
            // Require that all selected genres are present
            $havingSql = ' GROUP BY m.id HAVING COUNT(DISTINCT mg.category_id) = ?';
            $havingParams[] = count($genreIds);
        }

        // ORDER BY clause
        switch ($orderBy) {
            case 'Az':
                $orderClause = 'ORDER BY m.title ASC';
                break;
            case 'Za':
                $orderClause = 'ORDER BY m.title DESC';
                break;
            case 'Update':
                // Sort by latest chapter timestamp (updated_at or created_at)
                $orderClause = 'ORDER BY (
                    SELECT MAX(UNIX_TIMESTAMP(COALESCE(c.updated_at, c.created_at)))
                    FROM chapters c
                    WHERE c.manga_id = m.id
                ) DESC, m.id DESC';
                break;
            case 'Added':
                $orderClause = 'ORDER BY m.created_at DESC';
                break;
            case 'Popular':
                $orderClause = 'ORDER BY m.views DESC, m.rating DESC';
                break;
            default:
                $orderClause = 'ORDER BY m.updated_at DESC';
        }

        // 1) Count total distinct manga ids matching the filters
        $countInnerSelect = 'SELECT m.id' . $baseFrom . $baseWhere . $genreFilterSql;
        if (!empty($genreIds)) {
            $countInnerSelect .= ' GROUP BY m.id HAVING COUNT(DISTINCT mg.category_id) = ?';
        }
        $countQuery = 'SELECT COUNT(*) AS total FROM (' . $countInnerSelect . ') t';

        $countParams = array_merge($params, $genreParams, $havingParams);
        $totalRow = DB::selectOne($countQuery, $countParams);
        $total = (int) ($totalRow->total ?? 0);

        if ($total === 0) {
            return [];
        }

        // 2) Fetch only the current page of manga rows
        $offset = max(0, ($pageNum - 1) * $perPage);

        $dataSelect = 'SELECT DISTINCT m.*' . $baseFrom . $baseWhere . $genreFilterSql . $havingSql . ' ' . $orderClause . ' LIMIT ? OFFSET ?';
        $dataParams = array_merge($params, $genreParams, $havingParams, [$perPage, $offset]);

        $mangaRows = DB::select($dataSelect, $dataParams);

        if (empty($mangaRows)) {
            return [];
        }

        $mangaIds = array_map(fn($m) => $m->id, $mangaRows);

        $genresByMangaId = [];
        try {
            $placeholders = implode(',', array_fill(0, count($mangaIds), '?'));
            $genreRows = DB::select(
                '
                SELECT mg.manga_id, c.id, c.name, c.slug
                FROM manga_genres mg
                JOIN categories c ON mg.category_id = c.id
                WHERE mg.manga_id IN (' . $placeholders . ')
                ',
                $mangaIds
            );

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
        } catch (\Throwable $e) {
            $genresByMangaId = [];
        }

        $lastChapterByMangaId = [];
        try {
            $placeholders = implode(',', array_fill(0, count($mangaIds), '?'));
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
                  WHERE manga_id IN (' . $placeholders . ')
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
        } catch (\Throwable $e) {
            $lastChapterByMangaId = [];
        }

        $result = [];
        foreach ($mangaRows as $m) {
            $genres = $genresByMangaId[$m->id] ?? [];
            $lastChapter = $lastChapterByMangaId[$m->id] ?? null;

            $entry = [
                'id' => $m->id,
                'title' => $m->title,
                'slug' => $m->slug,
                'alternative_name' => $m->alternative_name ?? null,
                'author' => $m->author ?? 'Unknown',
                'sinopsis' => $m->synopsis ?? null,
                'cover' => $this->toCoverImageUrl($m->thumbnail ?? null),
                'thumbnail' => $this->toCoverImageUrl($m->thumbnail ?? null),
                'is_input_manual' => true,
                'content_type' => $m->content_type ?? 'comic',
                'country_id' => $m->country_id ?? null,
                'color' => (bool) ($m->color ?? false),
                'hot' => (bool) ($m->hot ?? false),
                'is_project' => (bool) ($m->is_project ?? false),
                'is_safe' => (bool) ($m->is_safe ?? true),
                'rating' => (float) ($m->rating ?? 0),
                'bookmark_count' => $m->bookmark_count ?? 0,
                'total_views' => $m->views ?? 0,
                'release' => $m->release ?? null,
                'status' => $m->status ?? 'ongoing',
                'genres' => $genres,
                'lastChapters' => [],
            ];

            if ($lastChapter) {
                $entry['lastChapters'][] = $lastChapter;
            }

            $result[] = $entry;
        }

        return $result;
    }

    public function index(Request $request)
    {
        try {
            $q = $request->query('q');
            $page = (int) $request->query('page', 1);
            $perPage = (int) $request->query('per_page', 40);
            $genre = $request->query('genre');
            $status = $request->query('status');
            $country = $request->query('country');
            $type = $request->query('type');
            $orderBy = $request->query('orderBy', 'Update');
            $project = $request->query('project');

            $genreArray = [];
            if ($genre !== null) {
                if (is_array($genre)) {
                    $genreArray = $genre;
                } else {
                    $genreArray = [$genre];
                }
            }

            $rawPage = $page > 0 ? $page : 1;
            $rawPerPage = $perPage > 0 ? $perPage : 40;
            $pageNum = min(max($rawPage, 1), 200);
            $perPage = min(max($rawPerPage, 10), 60);

            // Cache key based on normalized filters and pagination
            $cacheKey = 'contents:' . md5(json_encode([
                'q' => $q ? trim($q) : null,
                'genres' => array_values($genreArray),
                'status' => $status ?: null,
                'country' => $country ?: null,
                'type' => $type ?: null,
                'orderBy' => $orderBy,
                'project' => $project ?: null,
                'page' => $pageNum,
                'perPage' => $perPage,
            ]));

            if ($cached = Cache::get($cacheKey)) {
                return response()->json($cached);
            }

            $total = 0;
            $localManga = $this->fetchLocalManga([
                'q' => $q,
                'genreArray' => $genreArray,
                'status' => $status,
                'country' => $country,
                'type' => $type,
                'orderBy' => $orderBy,
                'project' => $project,
            ], $pageNum, $perPage, $total);

            $total = $total ?? 0;
            $lastPage = $perPage > 0 ? (int) ceil($total / $perPage) : 1;
            $offset = ($pageNum - 1) * $perPage;

            $paginator = [
                'current_page' => $pageNum,
                'last_page' => $lastPage,
                'per_page' => $perPage,
                'total' => $total,
                'from' => $total > 0 ? $offset + 1 : 0,
                'to' => min($offset + $perPage, $total),
            ];

            $responsePayload = [
                'status' => true,
                'data' => array_values($localManga),
                'paginator' => $paginator,
            ];

            // Cache list response for a short period to avoid repeated heavy queries
            Cache::put($cacheKey, $responsePayload, \Carbon\Carbon::now()->addMinutes(3));

            return response()->json($responsePayload);
        } catch (\Throwable $e) {
            return response()->json([
                'status' => false,
                'error' => 'Internal server error',
            ], 500);
        }
    }
}

