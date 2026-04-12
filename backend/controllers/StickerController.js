/* eslint-disable no-undef */
/* eslint-env node */
const db = require('../db');
const { deleteFile } = require('../utils/files');

const sanitizeLimit = (value, fallback = 10) => {
  const parsed = parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(parsed, 10);
};

const listPublic = async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page || '1', 10), 1);
    const limitRaw = parseInt(req.query.limit || '50', 10);
    const limit = Math.min(Math.max(Number.isNaN(limitRaw) ? 50 : limitRaw, 1), 50);
    const offset = (page - 1) * limit;

    const [[countRow]] = await db.execute('SELECT COUNT(*) AS total FROM stickers');
    const [rows] = await db.execute(
      `SELECT id, name, image_path, is_gif, created_at, updated_at
       FROM stickers
       ORDER BY id DESC
       LIMIT ? OFFSET ?`,
      [limit, offset]
    );

    const total = Number(countRow?.total || 0);
    return res.json({
      status: true,
      data: {
        items: rows.map((row) => ({
          ...row,
          is_gif: !!row.is_gif,
        })),
        pagination: {
          page,
          limit,
          total,
          total_pages: Math.max(1, Math.ceil(total / limit)),
        },
      },
    });
  } catch (error) {
    console.error('Error fetching stickers:', error);
    return res.status(500).json({ status: false, error: 'Internal server error' });
  }
};

const listAdmin = async (req, res) => {
  try {
    const search = String(req.query.search || '').trim().toLowerCase();
    const page = Math.max(parseInt(req.query.page || '1', 10), 1);
    const limit = sanitizeLimit(req.query.limit, 10);
    const offset = (page - 1) * limit;

    const where = [];
    const params = [];
    if (search) {
      where.push('LOWER(name) LIKE ?');
      params.push(`%${search}%`);
    }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const [[countRow]] = await db.execute(
      `SELECT COUNT(*) AS total FROM stickers ${whereSql}`,
      params
    );
    const [rows] = await db.execute(
      `SELECT id, name, image_path, is_gif, created_at, updated_at
       FROM stickers
       ${whereSql}
       ORDER BY id DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    return res.json({
      status: true,
      data: {
        items: rows,
        pagination: {
          page,
          limit,
          total: Number(countRow?.total || 0),
        },
      },
    });
  } catch (error) {
    console.error('Error listing stickers:', error);
    return res.status(500).json({ status: false, error: 'Internal server error' });
  }
};

const createSticker = async (req, res) => {
  try {
    const name = String(req.body?.name || '').trim();
    const imagePath = req.file ? `/uploads/${req.file.filename}` : null;
    if (!name) {
      return res.status(400).json({ status: false, error: 'Nama stiker wajib diisi' });
    }
    if (!imagePath) {
      return res.status(400).json({ status: false, error: 'File stiker wajib diupload' });
    }

    const mimeType = String(req.file?.mimetype || '').toLowerCase();
    const isGif = mimeType === 'image/gif' ? 1 : 0;
    const [result] = await db.execute(
      'INSERT INTO stickers (name, image_path, is_gif) VALUES (?, ?, ?)',
      [name.slice(0, 120), imagePath, isGif]
    );

    return res.status(201).json({ status: true, data: { id: result.insertId } });
  } catch (error) {
    console.error('Error creating sticker:', error);
    return res.status(500).json({ status: false, error: 'Internal server error' });
  }
};

const updateSticker = async (req, res) => {
  try {
    const stickerId = parseInt(req.params.id, 10);
    const name = String(req.body?.name || '').trim();
    if (!Number.isFinite(stickerId)) {
      return res.status(400).json({ status: false, error: 'ID stiker tidak valid' });
    }
    if (!name) {
      return res.status(400).json({ status: false, error: 'Nama stiker wajib diisi' });
    }

    const [rows] = await db.execute(
      'SELECT id, image_path, is_gif FROM stickers WHERE id = ?',
      [stickerId]
    );
    if (rows.length === 0) {
      return res.status(404).json({ status: false, error: 'Stiker tidak ditemukan' });
    }

    const current = rows[0];
    let imagePath = current.image_path;
    let isGif = current.is_gif ? 1 : 0;

    if (req.file) {
      imagePath = `/uploads/${req.file.filename}`;
      const mimeType = String(req.file?.mimetype || '').toLowerCase();
      isGif = mimeType === 'image/gif' ? 1 : 0;
    }

    await db.execute(
      'UPDATE stickers SET name = ?, image_path = ?, is_gif = ? WHERE id = ?',
      [name.slice(0, 120), imagePath, isGif, stickerId]
    );

    if (req.file && current.image_path && current.image_path !== imagePath) {
      deleteFile(current.image_path);
    }

    return res.json({ status: true, message: 'Stiker berhasil diperbarui' });
  } catch (error) {
    console.error('Error updating sticker:', error);
    return res.status(500).json({ status: false, error: 'Internal server error' });
  }
};

const deleteSticker = async (req, res) => {
  try {
    const stickerId = parseInt(req.params.id, 10);
    if (!Number.isFinite(stickerId)) {
      return res.status(400).json({ status: false, error: 'ID stiker tidak valid' });
    }

    const [rows] = await db.execute('SELECT id, image_path FROM stickers WHERE id = ?', [stickerId]);
    if (rows.length === 0) {
      return res.status(404).json({ status: false, error: 'Stiker tidak ditemukan' });
    }

    await db.execute('DELETE FROM stickers WHERE id = ?', [stickerId]);
    deleteFile(rows[0].image_path);

    return res.json({ status: true, message: 'Stiker berhasil dihapus' });
  } catch (error) {
    console.error('Error deleting sticker:', error);
    return res.status(500).json({ status: false, error: 'Internal server error' });
  }
};

module.exports = {
  listPublic,
  listAdmin,
  createSticker,
  updateSticker,
  deleteSticker,
};
