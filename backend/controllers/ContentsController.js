const db = require('../db');

/** Short TTL cache + in-flight dedupe for GET /contents (reduces parallel heavy queries). */
const CONTENTS_LIST_CACHE_TTL_MS = 20 * 1000;
const CONTENTS_LIST_CACHE_MAX_KEYS = 80;

if (!global.__CONTENTS_LIST_CACHE__) {
  global.__CONTENTS_LIST_CACHE__ = new Map();
}
if (!global.__CONTENTS_LIST_INFLIGHT__) {
  global.__CONTENTS_LIST_INFLIGHT__ = new Map();
}

function normalizeGenreKey(genre) {
  if (!genre) return '';
  if (Array.isArray(genre)) {
    return [...genre].map(String).sort().join(',');
  }
  if (typeof genre === 'object') {
    return Object.values(genre)
      .map(String)
      .sort()
      .join(',');
  }
  return String(genre);
}

function buildContentsListCacheKey(query) {
  const {
    q = '',
    page = 1,
    per_page = 40,
    genre,
    status,
    country,
    type,
    orderBy = 'Update',
    project,
  } = query;
  return JSON.stringify({
    q: String(q || '').trim(),
    page: String(page),
    per_page: String(per_page),
    g: normalizeGenreKey(genre),
    status: status != null ? String(status) : '',
    country: country != null ? String(country) : '',
    type: type != null ? String(type) : '',
    orderBy: String(orderBy || 'Update'),
    project: project != null ? String(project) : '',
  });
}

function pruneContentsCacheIfNeeded() {
  const map = global.__CONTENTS_LIST_CACHE__;
  while (map.size > CONTENTS_LIST_CACHE_MAX_KEYS) {
    const k = map.keys().next().value;
    map.delete(k);
  }
}

// Helper function copied from server.js, kept internal to contents controller
async function fetchLocalManga(filters) {
  const {
    q,
    genreArray,
    status,
    country,
    type,
    orderBy = 'Update',
    project,
    page = 1,
    perPage = 24,
  } = filters || {};

  const whereConditions = ['m.is_input_manual = TRUE'];
  const params = [];

  if (q && q.trim()) {
    whereConditions.push('(m.title LIKE ? OR m.alternative_name LIKE ?)');
    const searchTerm = `%${q.trim()}%`;
    params.push(searchTerm, searchTerm);
  } else if (project === 'true') {
    whereConditions.push('m.is_project = TRUE');
  }

  if (status && status !== 'All') {
    whereConditions.push('m.status = ?');
    params.push(status.toLowerCase());
  }

  if (country) {
    whereConditions.push('m.country_id = ?');
    params.push(country);
  }

  if (type && type !== 'Comic') {
    const typeMap = {
      Manga: 'manga',
      Manhua: 'manhua',
      Manhwa: 'manhwa',
    };
    if (typeMap[type]) {
      whereConditions.push('m.content_type = ?');
      params.push(typeMap[type]);
    } else if (type === 'Comic') {
      whereConditions.push('(m.content_type = ? OR m.content_type IS NULL)');
      params.push('comic');
    }
  }

  const genreIds = Array.isArray(genreArray)
    ? genreArray.map((g) => parseInt(g, 10)).filter((g) => !Number.isNaN(g))
    : [];

  const shouldSortByLatestChapter = orderBy === 'Update' || !orderBy;
  const fromClause =
    ' FROM manga m' +
    (shouldSortByLatestChapter
      ? ' LEFT JOIN (' +
        '   SELECT manga_id, MAX(COALESCE(updated_at, created_at)) AS last_chapter_activity_at' +
        '   FROM chapters' +
        '   GROUP BY manga_id' +
        ' ) lc ON lc.manga_id = m.id'
      : '') +
    (genreIds.length > 0 ? ' INNER JOIN manga_genres mg ON m.id = mg.manga_id' : '');
  const whereClause = ' WHERE ' + whereConditions.join(' AND ');
  const genreFilterClause = genreIds.length > 0
    ? ' AND mg.category_id IN (' + genreIds.map(() => '?').join(',') + ')'
    : '';
  const groupHavingClause = genreIds.length > 0
    ? ' GROUP BY m.id HAVING COUNT(DISTINCT mg.category_id) = ?'
    : '';

  let orderClause = '';
  switch (orderBy) {
    case 'Az':
      orderClause = 'ORDER BY m.title ASC';
      break;
    case 'Za':
      orderClause = 'ORDER BY m.title DESC';
      break;
    case 'Update':
      orderClause =
        'ORDER BY COALESCE(lc.last_chapter_activity_at, m.updated_at, m.created_at) DESC, m.id DESC';
      break;
    case 'Added':
      orderClause = 'ORDER BY m.created_at DESC';
      break;
    case 'Popular':
      orderClause = 'ORDER BY m.views DESC, m.rating DESC';
      break;
    default:
      orderClause =
        'ORDER BY COALESCE(lc.last_chapter_activity_at, m.updated_at, m.created_at) DESC, m.id DESC';
  }

  const baseParams = [...params];
  if (genreIds.length > 0) {
    baseParams.push(...genreIds, genreIds.length);
  }

  const offset = (Math.max(1, page) - 1) * Math.max(1, perPage);
  const dataQuery =
    'SELECT m.*' +
    fromClause +
    whereClause +
    genreFilterClause +
    groupHavingClause +
    ' ' +
    orderClause +
    ' LIMIT ? OFFSET ?';
  const dataParams = [...baseParams, perPage, offset];

  const countQuery = genreIds.length > 0
    ? `
      SELECT COUNT(*) AS total
      FROM (
        SELECT m.id
        ${fromClause}
        ${whereClause}
        ${genreFilterClause}
        ${groupHavingClause}
      ) AS filtered_manga
    `
    : `
      SELECT COUNT(*) AS total
      ${fromClause}
      ${whereClause}
    `;
  const [countRows] = await db.execute(countQuery, baseParams);
  const totalItems = Number(countRows?.[0]?.total || 0);

  const [mangaRows] = await db.execute(dataQuery, dataParams);
  if (!mangaRows || mangaRows.length === 0) {
    return {
      items: [],
      total: totalItems,
    };
  }

  const mangaIds = mangaRows.map((m) => m.id);

  let genresByMangaId = {};
  try {
    const genrePlaceholders = mangaIds.map(() => '?').join(',');
    const [genreRows] = await db.execute(
      `
        SELECT mg.manga_id, c.id, c.name, c.slug
        FROM manga_genres mg
        JOIN categories c ON mg.category_id = c.id
        WHERE mg.manga_id IN (${genrePlaceholders})
      `,
      mangaIds
    );

    genresByMangaId = genreRows.reduce((acc, row) => {
      if (!acc[row.manga_id]) acc[row.manga_id] = [];
      acc[row.manga_id].push({
        id: row.id,
        name: row.name,
        slug: row.slug,
      });
      return acc;
    }, {});
  } catch (err) {
    console.error('Error loading genres for local manga:', err);
    genresByMangaId = {};
  }

  let lastChaptersByMangaId = {};
  try {
    const chapterPlaceholders = mangaIds.map(() => '?').join(',');
    const [lastChapterRows] = await db.execute(
      `
        SELECT
          c.manga_id,
          c.chapter_number AS number,
          c.title,
          c.slug,
          c.created_at,
          UNIX_TIMESTAMP(c.created_at) AS created_at_timestamp
        FROM chapters c
        WHERE c.manga_id IN (${chapterPlaceholders})
        ORDER BY c.manga_id ASC, CAST(c.chapter_number AS UNSIGNED) DESC, c.created_at DESC
      `,
      mangaIds
    );

    lastChaptersByMangaId = lastChapterRows.reduce((acc, row) => {
      if (!acc[row.manga_id]) {
        acc[row.manga_id] = [];
      }
      if (acc[row.manga_id].length >= 3) {
        return acc;
      }
      acc[row.manga_id].push({
        number: row.number,
        title: row.title,
        slug: row.slug,
        created_at: {
          time: parseInt(row.created_at_timestamp, 10),
        },
      });
      return acc;
    }, {});
  } catch (err) {
    console.error('Error loading last chapters for local manga:', err);
    lastChaptersByMangaId = {};
  }

  const mangaList = mangaRows.map((manga) => {
    const coverUrl = manga.thumbnail || null;
    const genres = genresByMangaId[manga.id] || [];
    const lastChapters = lastChaptersByMangaId[manga.id] || [];

    return {
      id: manga.id,
      title: manga.title,
      slug: manga.slug,
      alternative_name: manga.alternative_name || null,
      author: manga.author || 'Unknown',
      sinopsis: manga.synopsis || null,
      cover: coverUrl,
      thumbnail: manga.thumbnail || coverUrl,
      is_input_manual: true,
      content_type: manga.content_type || 'comic',
      country_id: manga.country_id || null,
      color: !!manga.color,
      hot: !!manga.hot,
      is_project: !!manga.is_project,
      is_safe: manga.is_safe !== null && manga.is_safe !== undefined ? !!manga.is_safe : true,
      rating: parseFloat(manga.rating) || 0,
      bookmark_count: manga.bookmark_count || 0,
      total_views: manga.views || 0,
      release: manga.release || null,
      status: manga.status || 'ongoing',
      genres,
      lastChapters,
    };
  });

  return {
    items: mangaList,
    total: totalItems,
  };
}

const genres = async (req, res) => {
  try {
    const [rows] = await db.execute(`
      SELECT id, name, slug
      FROM categories
      ORDER BY name
    `);
    res.json({
      status: true,
      data: rows,
    });
  } catch (error) {
    console.error('Error fetching genres:', error);
    res.status(500).json({ status: false, error: 'Internal server error' });
  }
};

const list = async (req, res) => {
  try {
    const {
      q,
      page = 1,
      per_page = 40,
      genre,
      status,
      country,
      type,
      orderBy = 'Update',
      project,
    } = req.query;

    const cacheKey = buildContentsListCacheKey(req.query);
    const cacheMap = global.__CONTENTS_LIST_CACHE__;
    const inflightMap = global.__CONTENTS_LIST_INFLIGHT__;
    const cached = cacheMap.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return res.json(cached.payload);
    }

    if (inflightMap.has(cacheKey)) {
      const payload = await inflightMap.get(cacheKey);
      return res.json(payload);
    }

    const run = (async () => {
      let genreArray = [];
      if (genre) {
        if (Array.isArray(genre)) {
          genreArray = genre;
        } else if (typeof genre === 'object') {
          genreArray = Object.values(genre);
        } else {
          genreArray = [genre];
        }
      }

      const rawPageNum = parseInt(page, 10) || 1;
      const rawPerPage = parseInt(per_page, 10) || 40;
      const pageNum = Math.min(Math.max(rawPageNum, 1), 200);
      const perPage = Math.min(Math.max(rawPerPage, 10), 60);

      let localManga = [];
      let totalItems = 0;
      try {
        const localResult = await fetchLocalManga({
          q,
          genreArray,
          status,
          country,
          type,
          orderBy,
          project,
          page: pageNum,
          perPage,
        });
        localManga = localResult.items || [];
        totalItems = Number(localResult.total || 0);
      } catch (localError) {
        console.error('Error fetching local manga:', localError);
      }

      return {
        status: true,
        data: localManga,
        meta: {
          page: pageNum,
          per_page: perPage,
          total: totalItems,
          total_pages: Math.ceil(totalItems / perPage),
        },
      };
    })();

    inflightMap.set(cacheKey, run);
    let responsePayload;
    try {
      responsePayload = await run;
    } finally {
      inflightMap.delete(cacheKey);
    }

    pruneContentsCacheIfNeeded();
    cacheMap.set(cacheKey, {
      expiresAt: Date.now() + CONTENTS_LIST_CACHE_TTL_MS,
      payload: responsePayload,
    });

    res.json(responsePayload);
  } catch (error) {
    console.error('Error fetching contents:', error);
    res.status(500).json({ status: false, error: 'Internal server error' });
  }
};

module.exports = {
  genres,
  list,
};

