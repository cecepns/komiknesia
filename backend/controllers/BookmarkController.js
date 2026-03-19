const db = require('../db');

const index = async (req, res) => {
  try {
    const userId = req.user.id;
    const { page = 1, limit = 24 } = req.query;
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const pageSize = Math.max(1, Math.min(100, parseInt(limit, 10) || 24));
    const offset = (pageNum - 1) * pageSize;

    const [[countRow]] = await db.execute(
      `SELECT COUNT(*) as total
       FROM bookmarks
       WHERE user_id = ?`,
      [userId]
    );
    const total = countRow ? countRow.total : 0;

    const [rows] = await db.execute(
      `SELECT b.id, b.manga_id, b.created_at, m.slug, m.title, m.thumbnail as cover
       FROM bookmarks b
       JOIN manga m ON m.id = b.manga_id
       WHERE b.user_id = ?
       ORDER BY b.created_at DESC
       LIMIT ? OFFSET ?`,
      [userId, pageSize, offset]
    );

    res.json({
      status: true,
      data: rows,
      meta: {
        page: pageNum,
        limit: pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  } catch (error) {
    console.error('Error fetching bookmarks:', error);
    res.status(500).json({ status: false, error: 'Internal server error' });
  }
};

const store = async (req, res) => {
  try {
    const userId = req.user.id;
    let { manga_id, slug } = req.body;
    if (!manga_id && slug) {
      const [m] = await db.execute('SELECT id FROM manga WHERE slug = ?', [slug]);
      if (m.length > 0) manga_id = m[0].id;
    }
    if (!manga_id) {
      return res.status(400).json({ status: false, error: 'manga_id or slug required' });
    }
    await db.execute(
      'INSERT IGNORE INTO bookmarks (user_id, manga_id) VALUES (?, ?)',
      [userId, manga_id]
    );
    res.json({ status: true, message: 'Bookmark added' });
  } catch (error) {
    console.error('Error adding bookmark:', error);
    res.status(500).json({ status: false, error: 'Internal server error' });
  }
};

const destroy = async (req, res) => {
  try {
    const userId = req.user.id;
    let mangaId = req.params.mangaId;
    if (Number.isNaN(Number(mangaId))) {
      const [m] = await db.execute('SELECT id FROM manga WHERE slug = ?', [mangaId]);
      if (m.length > 0) mangaId = m[0].id;
    }
    await db.execute('DELETE FROM bookmarks WHERE user_id = ? AND manga_id = ?', [userId, mangaId]);
    res.json({ status: true, message: 'Bookmark removed' });
  } catch (error) {
    console.error('Error removing bookmark:', error);
    res.status(500).json({ status: false, error: 'Internal server error' });
  }
};

const check = async (req, res) => {
  try {
    let mangaId = req.params.mangaId;
    if (Number.isNaN(Number(mangaId))) {
      const [m] = await db.execute('SELECT id FROM manga WHERE slug = ?', [mangaId]);
      mangaId = m.length > 0 ? m[0].id : null;
    }
    if (!mangaId) {
      return res.json({ status: true, bookmarked: false });
    }
    const [rows] = await db.execute(
      'SELECT id FROM bookmarks WHERE user_id = ? AND manga_id = ?',
      [req.user.id, mangaId]
    );
    res.json({ status: true, bookmarked: rows.length > 0 });
  } catch (error) {
    console.error('Error checking bookmark:', error);
    res.status(500).json({ status: false, error: 'Internal server error' });
  }
};

module.exports = {
  index,
  store,
  destroy,
  check,
};

