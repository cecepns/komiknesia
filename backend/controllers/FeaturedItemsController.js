const db = require('../db');

if (!global.__FEATURED_CACHE__) {
  global.__FEATURED_CACHE__ = { data: null, key: null, expiresAt: 0 };
}

const index = async (req, res) => {
  try {
    const { type, active } = req.query;

    const cacheState = global.__FEATURED_CACHE__;
    const cacheKey = JSON.stringify({
      type: type || null,
      active: active === undefined ? null : active === 'true',
    });
    const now = Date.now();
    if (cacheState.key === cacheKey && cacheState.expiresAt > now) {
      return res.json(cacheState.data);
    }

    let query = `
      SELECT 
        fi.*,
        m.id as manga_id,
        m.title,
        m.slug,
        m.thumbnail as cover,
        m.alternative_name,
        m.author,
        m.synopsis,
        m.content_type,
        m.country_id,
        m.color,
        m.hot,
        m.is_project,
        m.is_safe,
        m.rating,
        m.bookmark_count,
        m.views as total_views,
        m.release,
        m.status,
        m.is_input_manual,
        m.westmanga_id
      FROM featured_items fi
      JOIN manga m ON fi.manga_id = m.id
      WHERE 1=1
    `;

    const params = [];

    if (type) {
      query += ' AND fi.featured_type = ?';
      params.push(type);
    }

    if (active !== undefined && active !== '') {
      query += ' AND fi.is_active = ?';
      params.push(active === 'true');
    }

    query += ' ORDER BY fi.display_order ASC, fi.created_at DESC';

    const [items] = await db.execute(query, params);

    if (items.length === 0) {
      cacheState.key = cacheKey;
      cacheState.data = [];
      cacheState.expiresAt = now + 30 * 1000;
      return res.json([]);
    }

    const mangaIds = items.map((i) => i.manga_id);
    const idPlaceholders = mangaIds.map(() => '?').join(',');

    let genresByMangaId = {};
    try {
      const [genreRows] = await db.execute(
        `
        SELECT mg.manga_id, c.id, c.name, c.slug
        FROM manga_genres mg
        JOIN categories c ON mg.category_id = c.id
        WHERE mg.manga_id IN (${idPlaceholders})
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
      console.error('Error loading genres for featured items:', err);
      genresByMangaId = {};
    }

    let lastChapterByMangaId = {};
    try {
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
        WHERE c.manga_id IN (${idPlaceholders})
        ORDER BY c.manga_id ASC, CAST(c.chapter_number AS UNSIGNED) DESC, c.created_at DESC
      `,
        mangaIds
      );

      lastChapterByMangaId = lastChapterRows.reduce((acc, row) => {
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
      console.error('Error loading last chapters for featured items:', err);
      lastChapterByMangaId = {};
    }

    const enriched = items.map((item) => ({
      ...item,
      genres: genresByMangaId[item.manga_id] || [],
      lastChapters: lastChapterByMangaId[item.manga_id] || [],
    }));

    cacheState.key = cacheKey;
    cacheState.data = enriched;
    cacheState.expiresAt = now + 30 * 1000;

    res.json(enriched);
  } catch (error) {
    console.error('Error fetching featured items:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const store = async (req, res) => {
  try {
    let { manga_id, featured_type, display_order, is_active = true, westmanga_id, slug } = req.body;

    if (display_order === null || display_order === undefined) {
      display_order = 0;
    }

    if (!manga_id || !featured_type) {
      return res.status(400).json({ error: 'manga_id and featured_type are required' });
    }

    let [mangaCheck] = await db.execute('SELECT id FROM manga WHERE id = ?', [manga_id]);

    if (mangaCheck.length === 0 && westmanga_id) {
      [mangaCheck] = await db.execute('SELECT id FROM manga WHERE westmanga_id = ?', [westmanga_id]);
      if (mangaCheck.length > 0) {
        manga_id = mangaCheck[0].id;
      }
    }

    if (mangaCheck.length === 0 && slug) {
      [mangaCheck] = await db.execute('SELECT id FROM manga WHERE slug = ?', [slug]);
      if (mangaCheck.length > 0) {
        manga_id = mangaCheck[0].id;
      }
    }

    if (mangaCheck.length === 0) {
      return res.status(404).json({
        error: 'Manga not found',
        message: 'Manga tidak ditemukan di database.',
      });
    }

    const [existing] = await db.execute(
      'SELECT id FROM featured_items WHERE manga_id = ? AND featured_type = ?',
      [manga_id, featured_type]
    );

    if (existing.length > 0) {
      await db.execute(
        'UPDATE featured_items SET display_order = ?, is_active = ? WHERE id = ?',
        [display_order, is_active, existing[0].id]
      );
      return res.json({ id: existing[0].id, message: 'Featured item updated successfully' });
    }

    const [result] = await db.execute(
      'INSERT INTO featured_items (manga_id, featured_type, display_order, is_active) VALUES (?, ?, ?, ?)',
      [manga_id, featured_type, display_order, is_active]
    );

    res.status(201).json({ id: result.insertId, message: 'Featured item created successfully' });
  } catch (error) {
    console.error('Error creating featured item:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const update = async (req, res) => {
  try {
    const { id } = req.params;
    const { manga_id, featured_type, display_order, is_active } = req.body;

    const updates = [];
    const params = [];

    if (manga_id !== undefined) {
      updates.push('manga_id = ?');
      params.push(manga_id);
    }

    if (featured_type !== undefined) {
      updates.push('featured_type = ?');
      params.push(featured_type);
    }

    if (display_order !== undefined) {
      const orderValue = display_order === null || display_order === '' ? 0 : display_order;
      updates.push('display_order = ?');
      params.push(orderValue);
    }

    if (is_active !== undefined) {
      updates.push('is_active = ?');
      params.push(is_active);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    params.push(id);

    await db.execute(`UPDATE featured_items SET ${updates.join(', ')} WHERE id = ?`, params);

    res.json({ message: 'Featured item updated successfully' });
  } catch (error) {
    console.error('Error updating featured item:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const destroy = async (req, res) => {
  try {
    const { id } = req.params;
    await db.execute('DELETE FROM featured_items WHERE id = ?', [id]);
    res.json({ message: 'Featured item deleted successfully' });
  } catch (error) {
    console.error('Error deleting featured item:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = {
  index,
  store,
  update,
  destroy,
};

