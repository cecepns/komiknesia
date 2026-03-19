const db = require('../db');

const detailBySlug = async (req, res) => {
  try {
    const { slug } = req.params;

    const [rows] = await db.execute(
      `
      SELECT m.*
      FROM manga m
      WHERE m.slug = ?
    `,
      [slug]
    );

    if (rows.length > 0) {
      const manga = rows[0];

      const [genres] = await db.execute(
        `
        SELECT c.id, c.name, c.slug
        FROM manga_genres mg
        JOIN categories c ON mg.category_id = c.id
        WHERE mg.manga_id = ?
      `,
        [manga.id]
      );

      const [chapters] = await db.execute(
        `
        SELECT 
          c.id,
          c.westmanga_chapter_id as content_id,
          c.chapter_number as number,
          c.title,
          c.slug,
          c.created_at,
          c.updated_at,
          UNIX_TIMESTAMP(c.created_at) as created_at_timestamp,
          UNIX_TIMESTAMP(COALESCE(c.updated_at, c.created_at)) as updated_at_timestamp
        FROM chapters c
        WHERE c.manga_id = ?
        ORDER BY CAST(c.chapter_number AS UNSIGNED) DESC, c.chapter_number DESC
      `,
        [manga.id]
      );

      const mangaData = {
        id: manga.id,
        title: manga.title,
        slug: manga.slug,
        alternative_name: manga.alternative_name || null,
        author: manga.author || 'Unknown',
        sinopsis: manga.synopsis || null,
        cover: manga.thumbnail || null,
        content_type: manga.content_type || 'comic',
        country_id: manga.country_id || null,
        color: !!manga.color,
        hot: !!manga.hot,
        is_project: !!manga.is_project,
        is_safe: !!manga.is_safe,
        rating: parseFloat(manga.rating) || 0,
        bookmark_count: manga.bookmark_count || 0,
        total_views: manga.views || 0,
        release: manga.release || null,
        status: manga.status || 'ongoing',
        genres,
        chapters: chapters.map((ch) => {
          const updateTime = ch.updated_at || ch.created_at;
          return {
            id: ch.id,
            content_id: ch.content_id || ch.id,
            number: ch.number,
            title: ch.title || `Chapter ${ch.number}`,
            slug: ch.slug,
            created_at: {
              time: parseInt(ch.created_at_timestamp, 10),
              formatted: new Date(ch.created_at).toLocaleString('id-ID', {
                timeZone: 'Asia/Jakarta',
              }),
            },
            updated_at: {
              time: parseInt(ch.updated_at_timestamp, 10),
              formatted: new Date(updateTime).toLocaleString('id-ID', {
                timeZone: 'Asia/Jakarta',
              }),
            },
          };
        }),
      };

      return res.json({
        status: true,
        data: mangaData,
      });
    }

    return res.status(404).json({
      status: false,
      error: 'Manga tidak ditemukan',
    });
  } catch (error) {
    console.error('Error fetching manga detail:', error);
    res.status(500).json({
      status: false,
      error: 'Internal server error',
    });
  }
};

const incrementView = async (req, res) => {
  try {
    const { slug } = req.params;

    const [rows] = await db.execute(
      `
      SELECT id, views
      FROM manga
      WHERE slug = ?
    `,
      [slug]
    );

    if (rows.length === 0) {
      return res.json({
        status: true,
        data: {
          slug,
          views: null,
          message: 'Manga not in local database, view not tracked',
        },
      });
    }

    const manga = rows[0];
    const currentViews = manga.views || 0;
    const newViews = currentViews + 1;

    await db.execute(
      `
      UPDATE manga 
      SET views = ?
      WHERE id = ?
    `,
      [newViews, manga.id]
    );

    res.json({
      status: true,
      data: {
        slug,
        views: newViews,
        previous_views: currentViews,
      },
      message: 'View counter updated successfully',
    });
  } catch (error) {
    console.error('Error incrementing view counter:', error);
    res.status(500).json({
      status: false,
      error: 'Internal server error',
    });
  }
};

module.exports = {
  detailBySlug,
  incrementView,
};

