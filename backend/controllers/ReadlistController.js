const db = require('../db');

const MAX_TITLE = 200;

async function resolveMangaIds(body) {
  const rawIds = Array.isArray(body.manga_ids) ? body.manga_ids : [];
  const rawSlugs = Array.isArray(body.slugs) ? body.slugs : [];
  const ids = new Set();

  for (const v of rawIds) {
    const n = parseInt(v, 10);
    if (!Number.isNaN(n) && n > 0) ids.add(n);
  }
  for (const s of rawSlugs) {
    if (typeof s !== 'string' || !s.trim()) continue;
    const [rows] = await db.execute('SELECT id FROM manga WHERE slug = ? LIMIT 1', [s.trim()]);
    if (rows.length) ids.add(rows[0].id);
  }
  return [...ids];
}

async function assertReadlistOwner(readlistId, userId) {
  const [rows] = await db.execute(
    'SELECT id, title FROM user_readlists WHERE id = ? AND user_id = ?',
    [readlistId, userId]
  );
  return rows[0] || null;
}

const index = async (req, res) => {
  try {
    const userId = req.user.id;
    const [rows] = await db.execute(
      `SELECT r.id, r.title, r.created_at, r.updated_at,
              COUNT(m.id) AS manga_count
       FROM user_readlists r
       LEFT JOIN user_readlist_manga m ON m.readlist_id = r.id
       WHERE r.user_id = ?
       GROUP BY r.id
       ORDER BY r.updated_at DESC`,
      [userId]
    );
    res.json({ status: true, data: rows });
  } catch (error) {
    console.error('Error listing readlists:', error);
    res.status(500).json({ status: false, error: 'Internal server error' });
  }
};

const store = async (req, res) => {
  try {
    const userId = req.user.id;
    let title = typeof req.body.title === 'string' ? req.body.title.trim() : '';
    if (!title) {
      return res.status(400).json({ status: false, error: 'Judul readlist wajib diisi' });
    }
    if (title.length > MAX_TITLE) {
      title = title.slice(0, MAX_TITLE);
    }
    const [result] = await db.execute(
      'INSERT INTO user_readlists (user_id, title) VALUES (?, ?)',
      [userId, title]
    );
    res.json({
      status: true,
      data: { id: result.insertId, title, manga_count: 0 },
    });
  } catch (error) {
    console.error('Error creating readlist:', error);
    res.status(500).json({ status: false, error: 'Internal server error' });
  }
};

const show = async (req, res) => {
  try {
    const userId = req.user.id;
    const readlistId = parseInt(req.params.id, 10);
    if (Number.isNaN(readlistId)) {
      return res.status(400).json({ status: false, error: 'ID tidak valid' });
    }
    const meta = await assertReadlistOwner(readlistId, userId);
    if (!meta) {
      return res.status(404).json({ status: false, error: 'Readlist tidak ditemukan' });
    }
    const [items] = await db.execute(
      `SELECT m.id AS manga_id, m.slug, m.title, m.thumbnail AS cover, rm.created_at
       FROM user_readlist_manga rm
       JOIN manga m ON m.id = rm.manga_id
       WHERE rm.readlist_id = ?
       ORDER BY rm.created_at DESC`,
      [readlistId]
    );
    res.json({
      status: true,
      data: {
        id: meta.id,
        title: meta.title,
        items,
      },
    });
  } catch (error) {
    console.error('Error fetching readlist:', error);
    res.status(500).json({ status: false, error: 'Internal server error' });
  }
};

const update = async (req, res) => {
  try {
    const userId = req.user.id;
    const readlistId = parseInt(req.params.id, 10);
    if (Number.isNaN(readlistId)) {
      return res.status(400).json({ status: false, error: 'ID tidak valid' });
    }
    const meta = await assertReadlistOwner(readlistId, userId);
    if (!meta) {
      return res.status(404).json({ status: false, error: 'Readlist tidak ditemukan' });
    }
    let title = typeof req.body.title === 'string' ? req.body.title.trim() : '';
    if (!title) {
      return res.status(400).json({ status: false, error: 'Judul tidak boleh kosong' });
    }
    if (title.length > MAX_TITLE) {
      title = title.slice(0, MAX_TITLE);
    }
    await db.execute('UPDATE user_readlists SET title = ? WHERE id = ? AND user_id = ?', [
      title,
      readlistId,
      userId,
    ]);
    res.json({ status: true, data: { id: readlistId, title } });
  } catch (error) {
    console.error('Error updating readlist:', error);
    res.status(500).json({ status: false, error: 'Internal server error' });
  }
};

const destroy = async (req, res) => {
  try {
    const userId = req.user.id;
    const readlistId = parseInt(req.params.id, 10);
    if (Number.isNaN(readlistId)) {
      return res.status(400).json({ status: false, error: 'ID tidak valid' });
    }
    const [r] = await db.execute('DELETE FROM user_readlists WHERE id = ? AND user_id = ?', [
      readlistId,
      userId,
    ]);
    if (r.affectedRows === 0) {
      return res.status(404).json({ status: false, error: 'Readlist tidak ditemukan' });
    }
    res.json({ status: true, message: 'Readlist dihapus' });
  } catch (error) {
    console.error('Error deleting readlist:', error);
    res.status(500).json({ status: false, error: 'Internal server error' });
  }
};

const addItems = async (req, res) => {
  try {
    const userId = req.user.id;
    const readlistId = parseInt(req.params.id, 10);
    if (Number.isNaN(readlistId)) {
      return res.status(400).json({ status: false, error: 'ID tidak valid' });
    }
    const meta = await assertReadlistOwner(readlistId, userId);
    if (!meta) {
      return res.status(404).json({ status: false, error: 'Readlist tidak ditemukan' });
    }
    const mangaIds = await resolveMangaIds(req.body || {});
    if (mangaIds.length === 0) {
      return res.status(400).json({ status: false, error: 'Pilih minimal satu manga' });
    }
    let added = 0;
    for (const mangaId of mangaIds) {
      const [ins] = await db.execute(
        'INSERT IGNORE INTO user_readlist_manga (readlist_id, manga_id) VALUES (?, ?)',
        [readlistId, mangaId]
      );
      added += ins.affectedRows || 0;
    }
    res.json({ status: true, message: 'Manga ditambahkan', added });
  } catch (error) {
    console.error('Error adding readlist items:', error);
    res.status(500).json({ status: false, error: 'Internal server error' });
  }
};

const removeItem = async (req, res) => {
  try {
    const userId = req.user.id;
    const readlistId = parseInt(req.params.id, 10);
    if (Number.isNaN(readlistId)) {
      return res.status(400).json({ status: false, error: 'ID tidak valid' });
    }
    const meta = await assertReadlistOwner(readlistId, userId);
    if (!meta) {
      return res.status(404).json({ status: false, error: 'Readlist tidak ditemukan' });
    }
    let mangaId = req.params.mangaId;
    if (Number.isNaN(Number(mangaId))) {
      const [m] = await db.execute('SELECT id FROM manga WHERE slug = ?', [mangaId]);
      if (m.length === 0) {
        return res.status(404).json({ status: false, error: 'Manga tidak ditemukan' });
      }
      mangaId = m[0].id;
    }
    await db.execute(
      'DELETE FROM user_readlist_manga WHERE readlist_id = ? AND manga_id = ?',
      [readlistId, mangaId]
    );
    res.json({ status: true, message: 'Manga dihapus dari readlist' });
  } catch (error) {
    console.error('Error removing readlist item:', error);
    res.status(500).json({ status: false, error: 'Internal server error' });
  }
};

module.exports = {
  index,
  store,
  show,
  update,
  destroy,
  addItems,
  removeItem,
};
