const db = require('../db');
const { createShortLivedCache } = require('../utils/shortLivedCache');
const {
  fetchLastChaptersByMangaIds,
  isActivityColumnReady,
} = require('../utils/chapterRelease');

const contentsListCache = createShortLivedCache({ ttlMs: 60 * 1000, maxKeys: 96 });
const contentsCountCache = createShortLivedCache({ ttlMs: 5 * 60 * 1000, maxKeys: 48 });

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
    popularWindow,
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
    popularWindow: popularWindow != null ? String(popularWindow) : '',
  });
}

function buildContentsCountCacheKey(filters) {
  const {
    q,
    genreArray,
    status,
    country,
    type,
    project,
  } = filters || {};
  return JSON.stringify({
    q: String(q || '').trim(),
    g: normalizeGenreKey(genreArray),
    status: status != null ? String(status) : '',
    country: country != null ? String(country) : '',
    type: type != null ? String(type) : '',
    project: project != null ? String(project) : '',
  });
}

async function fetchLocalManga(filters) {
  const {
    q,
    genreArray,
    status,
    country,
    type,
    orderBy = 'Update',
    project,
    popularWindow,
    page = 1,
    perPage = 24,
  } = filters || {};

  const whereConditions = [];
  const params = [];

  if (project === 'true') {
    whereConditions.push('m.is_project = TRUE');
  } else {
    whereConditions.push('m.is_input_manual = TRUE');
    if (project === 'false') {
      whereConditions.push('(m.is_project IS NULL OR m.is_project = FALSE)');
    }
  }

  if (q && q.trim()) {
    whereConditions.push('(m.title LIKE ? OR m.alternative_name LIKE ?)');
    const searchTerm = `%${q.trim()}%`;
    params.push(searchTerm, searchTerm);
  }

  if (status && status !== 'All') {
    whereConditions.push('m.status = ?');
    params.push(status.toLowerCase());
  }

  if (country) {
    whereConditions.push('m.country_id = ?');
    params.push(country);
  }

  if (type) {
    const normalizedType = String(type).trim().toLowerCase();
    const typeMap = {
      manga: 'manga',
      manhua: 'manhua',
      manhwa: 'manhwa',
      comic: 'comic',
    };

    if (typeMap[normalizedType] === 'comic') {
      whereConditions.push('(m.content_type = ? OR m.content_type IS NULL)');
      params.push('comic');
    } else if (typeMap[normalizedType]) {
      whereConditions.push('m.content_type = ?');
      params.push(typeMap[normalizedType]);
    }
  }

  const genreIds = Array.isArray(genreArray)
    ? genreArray.map((g) => parseInt(g, 10)).filter((g) => !Number.isNaN(g))
    : [];

  let popularIntervalDays = null;
  if (orderBy === 'Popular' && popularWindow != null && String(popularWindow).trim() !== '') {
    const pw = String(popularWindow).trim().toLowerCase();
    if (pw === 'day' || pw === 'daily' || pw === 'd' || pw === '1') {
      popularIntervalDays = 1;
    } else if (pw === 'week' || pw === 'weekly' || pw === 'w' || pw === '7') {
      popularIntervalDays = 7;
    } else if (pw === 'month' || pw === 'monthly' || pw === 'm' || pw === '30') {
      popularIntervalDays = 30;
    }
  }

  const popularJoin =
    popularIntervalDays != null
      ? ' LEFT JOIN (' +
        '   SELECT manga_id, COUNT(*) AS popular_window_count' +
        '   FROM manga_view_events' +
        '   WHERE created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)' +
        '   GROUP BY manga_id' +
        ' ) pw ON pw.manga_id = m.id'
      : '';

  const usesChapterActivitySort =
    orderBy === 'Update' ||
    orderBy == null ||
    orderBy === '' ||
    !['Popular', 'Az', 'Za', 'Added'].includes(orderBy);

  const activityColumnReady = usesChapterActivitySort
    ? await isActivityColumnReady(db)
    : false;

  const dataFromClause =
    ' FROM manga m' +
    (genreIds.length > 0 ? ' INNER JOIN manga_genres mg ON m.id = mg.manga_id' : '') +
    popularJoin;

  const countFromClause = dataFromClause;

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
        usesChapterActivitySort && activityColumnReady
          ? 'ORDER BY (COALESCE(m.last_chapter_activity_at, m.updated_at) IS NULL), COALESCE(m.last_chapter_activity_at, m.updated_at) DESC, m.id DESC'
          : 'ORDER BY m.updated_at DESC, m.id DESC';
      break;
    case 'Added':
      orderClause = 'ORDER BY m.created_at DESC, m.id DESC';
      break;
    case 'Popular':
      orderClause =
        popularIntervalDays != null
          ? 'ORDER BY COALESCE(pw.popular_window_count, 0) DESC, m.views DESC, m.rating DESC, m.id DESC'
          : 'ORDER BY m.views DESC, m.rating DESC, m.id DESC';
      break;
    default:
      orderClause =
        activityColumnReady
          ? 'ORDER BY (COALESCE(m.last_chapter_activity_at, m.updated_at) IS NULL), COALESCE(m.last_chapter_activity_at, m.updated_at) DESC, m.id DESC'
          : 'ORDER BY m.updated_at DESC, m.id DESC';
  }

  const prefixParams = popularIntervalDays != null ? [popularIntervalDays] : [];
  const baseParams = [...prefixParams, ...params];
  if (genreIds.length > 0) {
    baseParams.push(...genreIds, genreIds.length);
  }

  const offset = (Math.max(1, page) - 1) * Math.max(1, perPage);
  const dataQuery =
    'SELECT m.*' +
    dataFromClause +
    whereClause +
    genreFilterClause +
    groupHavingClause +
    ' ' +
    orderClause +
    ' LIMIT ? OFFSET ?';
  const dataParams = [...baseParams, perPage, offset];

  const countCacheKey = buildContentsCountCacheKey({
    q,
    genreArray,
    status,
    country,
    type,
    project,
  });

  const totalItems = await contentsCountCache.wrap(countCacheKey, async () => {
    const countQuery = genreIds.length > 0
      ? `
        SELECT COUNT(*) AS total
        FROM (
          SELECT m.id
          ${countFromClause}
          ${whereClause}
          ${genreFilterClause}
          ${groupHavingClause}
        ) AS filtered_manga
      `
      : `
        SELECT COUNT(*) AS total
        ${countFromClause}
        ${whereClause}
      `;
    const [countRows] = await db.execute(countQuery, baseParams);
    return Number(countRows?.[0]?.total || 0);
  });

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
    lastChaptersByMangaId = await fetchLastChaptersByMangaIds(db, mangaIds, 3);
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
    const cacheKey = buildContentsListCacheKey(req.query);
    const payload = await contentsListCache.wrap(cacheKey, async () => {
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
        popularWindow,
      } = req.query;

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
          popularWindow,
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
    });

    res.json(payload);
  } catch (error) {
    console.error('Error fetching contents:', error);
    res.status(500).json({ status: false, error: 'Internal server error' });
  }
};

function invalidateContentsCaches() {
  contentsListCache.invalidate();
  contentsCountCache.invalidate();
}

module.exports = {
  genres,
  list,
  invalidateContentsCaches,
};
