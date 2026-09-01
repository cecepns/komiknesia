const db = require('../db');

// Anti-spam cooldown map for comments
const commentCooldowns = new Map(); // userId -> { lastTime, lastBody }

// Periodic cleanup
setInterval(() => {
  const now = Date.now();
  for (const [uid, rec] of commentCooldowns.entries()) {
    if (now - rec.lastTime > 60000) commentCooldowns.delete(uid);
  }
}, 60000).unref();

const index = async (req, res) => {
  try {
    const { manga_id, chapter_id, external_slug, scope, page = 1, limit = 30 } = req.query;
    if (!manga_id && !chapter_id && !external_slug) {
      return res
        .status(400)
        .json({ status: false, error: 'manga_id, chapter_id or external_slug required' });
    }
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const pageSize = Math.max(1, Math.min(100, parseInt(limit, 10) || 30));
    const offset = (pageNum - 1) * pageSize;
    let baseWhere = 'WHERE c.parent_id IS NULL';

    let query = `
      SELECT c.id, c.user_id, c.manga_id, c.chapter_id, c.parent_id, c.body, c.created_at,
             u.username, u.name, u.profile_image, u.is_membership, u.membership_expires_at,
             CASE
               WHEN u.is_membership = 1 AND (u.membership_expires_at IS NULL OR u.membership_expires_at >= NOW())
               THEN 1
               ELSE 0
             END AS membership_active,
             u.role
      FROM comments c
      JOIN users u ON u.id = c.user_id
      ${baseWhere}
    `;
    let countQuery = `
      SELECT COUNT(*) as total
      FROM comments c
      ${baseWhere}
    `;
    const params = [];
    const countParams = [];

    if (manga_id) {
      let resolvedMangaId = null;

      if (!isNaN(Number(manga_id))) {
        resolvedMangaId = Number(manga_id);
      } else {
        const [mangaRows] = await db.execute('SELECT id FROM manga WHERE slug = ?', [manga_id]);

        if (mangaRows.length === 0) {
          return res.json({ status: true, data: [] });
        }

        resolvedMangaId = mangaRows[0].id;
      }

      query += ' AND c.manga_id = ?';
      countQuery += ' AND c.manga_id = ?';
      params.push(resolvedMangaId);
      countParams.push(resolvedMangaId);
    }
    if (chapter_id) {
      query += ' AND c.chapter_id = ?';
      countQuery += ' AND c.chapter_id = ?';
      params.push(chapter_id);
      countParams.push(chapter_id);
    }
    if (external_slug) {
      query += ' AND c.external_slug = ?';
      countQuery += ' AND c.external_slug = ?';
      params.push(external_slug);
      countParams.push(external_slug);
    } else if (manga_id && scope === 'manga') {
      query += ' AND c.external_slug IS NULL';
      countQuery += ' AND c.external_slug IS NULL';
    }
    query += ' ORDER BY c.created_at ASC LIMIT ? OFFSET ?';
    params.push(pageSize, offset);

    const [[countRow]] = await db.execute(countQuery, countParams);
    const total = countRow ? countRow.total : 0;

    const [comments] = await db.execute(query, params);
    const parentIds = comments.map((c) => c.id);
    let replies = [];
    if (parentIds.length > 0) {
      const placeholders = parentIds.map(() => '?').join(',');
      const [replyRows] = await db.execute(
        `SELECT c.id, c.user_id, c.parent_id, c.body, c.created_at,
                u.username, u.name, u.profile_image, u.is_membership, u.membership_expires_at,
                CASE
                  WHEN u.is_membership = 1 AND (u.membership_expires_at IS NULL OR u.membership_expires_at >= NOW())
                  THEN 1
                  ELSE 0
                END AS membership_active,
                u.role
         FROM comments c
         JOIN users u ON u.id = c.user_id
         WHERE c.parent_id IN (${placeholders})`,
        parentIds
      );
      replies = replyRows;
    }
    const repliesByParent = {};
    replies.forEach((r) => {
      if (!repliesByParent[r.parent_id]) repliesByParent[r.parent_id] = [];
      repliesByParent[r.parent_id].push(r);
    });
    const data = comments.map((c) => ({
      ...c,
      replies: (repliesByParent[c.id] || []).sort(
        (a, b) => new Date(a.created_at) - new Date(b.created_at)
      ),
    }));
    res.json({
      status: true,
      data,
      meta: {
        page: pageNum,
        limit: pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  } catch (error) {
    console.error('Error fetching comments:', error);
    res.status(500).json({ status: false, error: 'Internal server error' });
  }
};

const store = async (req, res) => {
  try {
    const { manga_id, chapter_id, parent_id, body, external_slug } = req.body;

    const trimmedBody = String(body || '').trim();
    if (!trimmedBody) {
      return res.status(400).json({ status: false, error: 'Komentar tidak boleh kosong' });
    }

    if (trimmedBody.length > 500) {
      return res.status(400).json({ status: false, error: 'Komentar terlalu panjang (maksimal 500 karakter)' });
    }

    // Anti-Spam: Check cooldown (min 10 seconds between comments per user)
    const userId = req.user.id;
    const now = Date.now();
    const lastRec = commentCooldowns.get(userId);

    if (lastRec && now - lastRec.lastTime < 10000) {
      const waitSec = Math.ceil((10000 - (now - lastRec.lastTime)) / 1000);
      return res.status(429).json({
        status: false,
        error: `Tolong tunggu ${waitSec} detik sebelum mengirim komentar lagi.`,
      });
    }

    // Anti-Spam: Check duplicate comment within 60 seconds
    if (lastRec && lastRec.lastBody?.toLowerCase() === trimmedBody.toLowerCase() && now - lastRec.lastTime < 60000) {
      return res.status(400).json({
        status: false,
        error: 'Komentar yang sama baru saja Anda kirim. Harap tidak mengirim komentar berulang.',
      });
    }

    if (!manga_id && !chapter_id) {
      return res
        .status(400)
        .json({ status: false, error: 'manga_id or chapter_id required' });
    }

    let resolvedMangaId = null;
    let resolvedChapterId = null;

    if (chapter_id) {
      const [chapterRows] = await db.execute(
        'SELECT id, manga_id FROM chapters WHERE id = ?',
        [chapter_id]
      );

      if (chapterRows.length > 0) {
        resolvedChapterId = chapterRows[0].id;
        resolvedMangaId = chapterRows[0].manga_id || null;
      } else {
        resolvedChapterId = null;
      }
    }

    if (!resolvedMangaId && manga_id) {
      if (!isNaN(Number(manga_id))) {
        const [mangaRows] = await db.execute(
          'SELECT id FROM manga WHERE id = ?',
          [Number(manga_id)]
        );
        if (mangaRows.length > 0) {
          resolvedMangaId = mangaRows[0].id;
        } else {
          resolvedMangaId = null;
        }
      } else {
        const [mangaRows] = await db.execute('SELECT id FROM manga WHERE slug = ?', [manga_id]);
        resolvedMangaId = mangaRows.length > 0 ? mangaRows[0].id : null;
      }
    }

    const [result] = await db.execute(
      'INSERT INTO comments (user_id, manga_id, external_slug, chapter_id, parent_id, body) VALUES (?, ?, ?, ?, ?, ?)',
      [
        req.user.id,
        resolvedMangaId,
        external_slug || null,
        resolvedChapterId,
        parent_id || null,
        String(body).trim(),
      ]
    );

    const [rows] = await db.execute(
      `SELECT c.id, c.user_id, c.manga_id, c.chapter_id, c.parent_id, c.body, c.created_at,
              u.username, u.name, u.profile_image, u.is_membership, u.membership_expires_at,
              CASE
                WHEN u.is_membership = 1 AND (u.membership_expires_at IS NULL OR u.membership_expires_at >= NOW())
                THEN 1
                ELSE 0
              END AS membership_active,
              u.role
       FROM comments c
       JOIN users u ON u.id = c.user_id
       WHERE c.id = ?`,
      [result.insertId]
    );

    res.json({ status: true, data: rows[0] });
  } catch (error) {
    console.error('Error adding comment:', error);
    res.status(500).json({ status: false, error: 'Internal server error' });
  }
};

const destroy = async (req, res) => {
  try {
    const userId = req.user.id;
    const commentId = parseInt(req.params.id, 10);
    if (!commentId || Number.isNaN(commentId)) {
      return res.status(400).json({ status: false, error: 'Invalid comment id' });
    }

    const [rows] = await db.execute(
      'SELECT id FROM comments WHERE id = ? AND user_id = ?',
      [commentId, userId]
    );
    if (rows.length === 0) {
      return res.status(404).json({ status: false, error: 'Comment not found' });
    }

    await db.execute('DELETE FROM comments WHERE id = ?', [commentId]);
    res.json({ status: true, message: 'Comment deleted' });
  } catch (error) {
    console.error('Error deleting comment:', error);
    res.status(500).json({ status: false, error: 'Internal server error' });
  }
};

const uploadImage = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ status: false, error: 'No image file uploaded' });
    }

    const { uploadFileToS3, s3Client } = require('../utils/s3Upload');
    const path = require('path');
    const fs = require('fs');

    const ext = path.extname(req.file.originalname || req.file.filename || '').toLowerCase() || '.webp';
    const filename = `comment_${Date.now()}_${Math.round(Math.random() * 1e6)}${ext}`;
    const s3Key = `komiknesia/comments/${filename}`;

    let savedPath = '';

    if (s3Client) {
      try {
        await uploadFileToS3(s3Key, req.file.path, req.file.mimetype);
        savedPath = s3Key;
        if (fs.existsSync(req.file.path)) {
          fs.unlinkSync(req.file.path);
        }
      } catch (s3Err) {
        console.error('Error uploading comment image to S3, falling back to local:', s3Err);
      }
    }

    if (!savedPath) {
      const commentsDir = path.join(__dirname, '..', 'uploads-komiknesia', 'comments');
      if (!fs.existsSync(commentsDir)) {
        fs.mkdirSync(commentsDir, { recursive: true });
      }
      const targetPath = path.join(commentsDir, filename);
      fs.renameSync(req.file.path, targetPath);
      savedPath = `/uploads/comments/${filename}`;
    }

    res.json({
      status: true,
      image: savedPath,
      url: savedPath,
      path: savedPath,
    });
  } catch (error) {
    console.error('Error uploading comment image:', error);
    res.status(500).json({ status: false, error: 'Internal server error' });
  }
};

module.exports = {
  index,
  store,
  destroy,
  uploadImage,
};

