const db = require('../db');

async function fetchLocalManga(filters) {
  const {
    q,
    genreArray,
    status,
    country,
    type,
    orderBy = 'Update',
    project,
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

  let query = 'SELECT DISTINCT m.* FROM manga m';
  if (genreIds.length > 0) {
    query += ' INNER JOIN manga_genres mg ON m.id = mg.manga_id';
  }
  query += ' WHERE ' + whereConditions.join(' AND ');

  if (genreIds.length > 0) {
    query += ' AND mg.category_id IN (' + genreIds.map(() => '?').join(',') + ')';
    params.push(...genreIds);
  }

  if (genreIds.length > 0) {
    query += ' GROUP BY m.id HAVING COUNT(DISTINCT mg.category_id) = ?';
    params.push(genreIds.length);
  }

  let orderClause = '';
  switch (orderBy) {
    case 'Az':
      orderClause = 'ORDER BY m.title ASC';
      break;
    case 'Za':
      orderClause = 'ORDER BY m.title DESC';
      break;
    case 'Update':
      orderClause = 'ORDER BY m.updated_at DESC';
      break;
    case 'Added':
      orderClause = 'ORDER BY m.created_at DESC';
      break;
    case 'Popular':
      orderClause = 'ORDER BY m.views DESC, m.rating DESC';
      break;
    default:
      orderClause = 'ORDER BY m.updated_at DESC';
  }
  query += ' ' + orderClause;

  query += ' LIMIT 100';

  const [mangaRows] = await db.execute(query, params);
  if (!mangaRows || mangaRows.length === 0) {
    return [];
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

  let lastChapterByMangaId = {};
  try {
    const chapterPlaceholders = mangaIds.map(() => '?').join(',');
    const [lastChapterRows] = await db.execute(
      `
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
          WHERE manga_id IN (${chapterPlaceholders})
          GROUP BY manga_id
        ) t
        JOIN chapters c
          ON c.manga_id = t.manga_id
         AND CAST(c.chapter_number AS UNSIGNED) = t.max_chapter_number
      `,
      mangaIds
    );

    lastChapterByMangaId = lastChapterRows.reduce((acc, row) => {
      acc[row.manga_id] = {
        number: row.number,
        title: row.title,
        slug: row.slug,
        created_at: {
          time: parseInt(row.created_at_timestamp, 10),
        },
      };
      return acc;
    }, {});
  } catch (err) {
    console.error('Error loading last chapters for local manga:', err);
    lastChapterByMangaId = {};
  }

  const mangaList = mangaRows.map((manga) => {
    const coverUrl = manga.thumbnail || null;
    const genres = genresByMangaId[manga.id] || [];
    const lastChapter = lastChapterByMangaId[manga.id];

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
      lastChapters: lastChapter ? [lastChapter] : [],
    };
  });

  return mangaList;
}

module.exports = {
  fetchLocalManga,
};

