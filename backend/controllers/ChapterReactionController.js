const db = require('../db');

const getRequestIp = (req) => {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.trim() !== '') {
    return forwarded.split(',')[0].trim();
  }
  return req.ip || req.connection?.remoteAddress || 'unknown';
};

const getAnonymousActorKey = (req) => {
  const rawDeviceId = req.headers['x-device-id'];
  if (typeof rawDeviceId === 'string') {
    const normalized = rawDeviceId.trim();
    if (/^[a-zA-Z0-9_-]{8,40}$/.test(normalized)) {
      return `dev:${normalized}`;
    }
  }
  return getRequestIp(req);
};

const VALID_REACTION_TYPES = ['senang', 'biasaAja', 'kecewa', 'marah', 'sedih'];

const getBySlug = async (req, res) => {
  try {
    const { slug } = req.params;
    const actorKey = getAnonymousActorKey(req);

    const [chapterRows] = await db.execute('SELECT id FROM chapters WHERE slug = ?', [slug]);

    if (chapterRows.length === 0) {
      return res.status(404).json({ status: false, error: 'Chapter not found' });
    }

    const chapterId = chapterRows[0].id;

    const [reactions] = await db.execute(
      `SELECT reaction_type, COUNT(*) as count
       FROM chapter_reactions
       WHERE chapter_id = ?
       GROUP BY reaction_type`,
      [chapterId]
    );

    let userReactionRow = null;
    if (req.user) {
      const [uv] = await db.execute(
        'SELECT reaction_type FROM chapter_reactions WHERE chapter_id = ? AND user_id = ?',
        [chapterId, req.user.id]
      );
      userReactionRow = uv.length > 0 ? uv[0] : null;
    } else {
      const [uv] = await db.execute(
        'SELECT reaction_type FROM chapter_reactions WHERE chapter_id = ? AND user_ip = ? AND (user_id IS NULL OR user_id = 0)',
        [chapterId, actorKey]
      );
      userReactionRow = uv.length > 0 ? uv[0] : null;
    }

    const counts = {
      senang: 0,
      biasaAja: 0,
      kecewa: 0,
      marah: 0,
      sedih: 0,
    };

    reactions.forEach((row) => {
      if (Object.prototype.hasOwnProperty.call(counts, row.reaction_type)) {
        counts[row.reaction_type] = row.count;
      }
    });

    res.json({
      status: true,
      data: counts,
      userReaction: userReactionRow ? userReactionRow.reaction_type : null,
    });
  } catch (error) {
    console.error('Error fetching chapter reactions:', error);
    res.status(500).json({ status: false, error: 'Internal server error' });
  }
};

const submit = async (req, res) => {
  try {
    const { slug, reaction_type } = req.body;

    if (!slug || !reaction_type) {
      return res.status(400).json({ status: false, error: 'slug and reaction_type are required' });
    }

    if (!VALID_REACTION_TYPES.includes(reaction_type)) {
      return res.status(400).json({ status: false, error: 'Invalid reaction_type' });
    }

    const actorKey = getAnonymousActorKey(req);
    const userId = req.user ? req.user.id : null;

    const [chapterRows] = await db.execute('SELECT id FROM chapters WHERE slug = ?', [slug]);

    if (chapterRows.length === 0) {
      return res.status(404).json({ status: false, error: 'Chapter not found' });
    }

    const chapterId = chapterRows[0].id;

    let existing = [];
    if (userId) {
      const [byUser] = await db.execute(
        `SELECT id, reaction_type, user_id
         FROM chapter_reactions
         WHERE chapter_id = ? AND user_id = ?
         LIMIT 1`,
        [chapterId, userId]
      );
      existing = byUser;

      // Klaim reaksi anonim dari device ini saat user login (jika belum punya row user_id).
      if (existing.length === 0) {
        const [byDevice] = await db.execute(
          `SELECT id, reaction_type, user_id
           FROM chapter_reactions
           WHERE chapter_id = ? AND user_ip = ? AND (user_id IS NULL OR user_id = 0)
           ORDER BY id ASC
           LIMIT 1`,
          [chapterId, actorKey]
        );
        existing = byDevice;
      }
    } else {
      const [byDevice] = await db.execute(
        `SELECT id, reaction_type, user_id
         FROM chapter_reactions
         WHERE chapter_id = ? AND user_ip = ? AND (user_id IS NULL OR user_id = 0)
         ORDER BY id ASC
         LIMIT 1`,
        [chapterId, actorKey]
      );
      existing = byDevice;
    }

    if (existing.length > 0) {
      const existingRow = existing[0];
      const isOwnedByUser = !!userId && Number(existingRow.user_id) === Number(userId);

      if (existingRow.reaction_type === reaction_type) {
        if (isOwnedByUser) {
          await db.execute('DELETE FROM chapter_reactions WHERE id = ?', [existingRow.id]);
          return res.json({ status: true, message: 'Reaction removed', action: 'removed' });
        }

        if (userId && !isOwnedByUser) {
          await db.execute(
            'UPDATE chapter_reactions SET user_id = ?, user_ip = ? WHERE id = ?',
            [userId, actorKey, existingRow.id]
          );
        }

        return res.json({ status: true, message: 'Already reacted', action: 'unchanged' });
      }

      await db.execute(
        'UPDATE chapter_reactions SET reaction_type = ?, user_id = ?, user_ip = ? WHERE id = ?',
        [reaction_type, userId, actorKey, existingRow.id]
      );
      return res.json({
        status: true,
        message: 'Reaction updated',
        action: 'updated',
        previous_reaction: existingRow.reaction_type,
        new_reaction: reaction_type,
      });
    }

    if (userId) {
      await db.execute(
        `INSERT INTO chapter_reactions (chapter_id, reaction_type, user_id, user_ip)
         VALUES (?, ?, ?, ?)`,
        [chapterId, reaction_type, userId, actorKey]
      );
    } else {
      await db.execute(
        `INSERT INTO chapter_reactions (chapter_id, reaction_type, user_ip)
         VALUES (?, ?, ?)`,
        [chapterId, reaction_type, actorKey]
      );
    }
    return res.json({ status: true, message: 'Reaction recorded', action: 'added' });
  } catch (error) {
    console.error('Error recording chapter reaction:', error);
    res.status(500).json({ status: false, error: 'Internal server error' });
  }
};

module.exports = {
  getBySlug,
  submit,
};
