const db = require('../db');

const getRequestIp = (req) => {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.trim() !== '') {
    return forwarded.split(',')[0].trim();
  }
  return req.ip || req.connection?.remoteAddress || 'unknown';
};

const getBySlug = async (req, res) => {
  try {
    const { slug } = req.params;
    const user_ip = getRequestIp(req);

    const [mangaRows] = await db.execute('SELECT id FROM manga WHERE slug = ?', [slug]);

    if (mangaRows.length === 0) {
      return res.status(404).json({ status: false, error: 'Manga not found' });
    }

    const mangaId = mangaRows[0].id;

    const [votes] = await db.execute(
      `SELECT vote_type, COUNT(*) as count 
       FROM votes 
       WHERE manga_id = ? 
       GROUP BY vote_type`,
      [mangaId]
    );

    let userVoteRow = null;
    if (req.user) {
      const [uv] = await db.execute(
        'SELECT vote_type FROM votes WHERE manga_id = ? AND user_id = ?',
        [mangaId, req.user.id]
      );
      userVoteRow = uv.length > 0 ? uv[0] : null;
    } else {
      const [uv] = await db.execute(
        'SELECT vote_type FROM votes WHERE manga_id = ? AND user_ip = ? AND (user_id IS NULL OR user_id = 0)',
        [mangaId, user_ip]
      );
      userVoteRow = uv.length > 0 ? uv[0] : null;
    }

    const voteCounts = {
      senang: 0,
      biasaAja: 0,
      kecewa: 0,
      marah: 0,
      sedih: 0,
    };

    votes.forEach((vote) => {
      if (Object.prototype.hasOwnProperty.call(voteCounts, vote.vote_type)) {
        voteCounts[vote.vote_type] = vote.count;
      }
    });

    res.json({
      status: true,
      data: voteCounts,
      userVote: userVoteRow ? userVoteRow.vote_type : null,
    });
  } catch (error) {
    console.error('Error fetching votes:', error);
    res.status(500).json({ status: false, error: 'Internal server error' });
  }
};

const submit = async (req, res) => {
  try {
    const { slug, vote_type } = req.body;

    if (!slug || !vote_type) {
      return res.status(400).json({ status: false, error: 'Slug and vote_type are required' });
    }

    const validVoteTypes = ['senang', 'biasaAja', 'kecewa', 'marah', 'sedih'];
    if (!validVoteTypes.includes(vote_type)) {
      return res.status(400).json({ status: false, error: 'Invalid vote_type' });
    }

    const user_ip = getRequestIp(req);
    const userId = req.user ? req.user.id : null;

    const [mangaRows] = await db.execute('SELECT id FROM manga WHERE slug = ?', [slug]);

    if (mangaRows.length === 0) {
      return res.status(404).json({ status: false, error: 'Manga not found' });
    }

    const mangaId = mangaRows[0].id;

    const whereClause = userId
      ? 'manga_id = ? AND (user_id = ? OR user_ip = ?)'
      : 'manga_id = ? AND user_ip = ? AND (user_id IS NULL OR user_id = 0)';
    const whereParams = userId ? [mangaId, userId, user_ip] : [mangaId, user_ip];

    const [existing] = await db.execute(
      `SELECT id, vote_type, user_id FROM votes WHERE ${whereClause}
       ORDER BY CASE WHEN user_id = ? THEN 0 ELSE 1 END, id ASC
       LIMIT 1`,
      [...whereParams, userId || 0]
    );

    if (existing.length > 0) {
      const existingVote = existing[0];
      const isOwnedByUser = !!userId && Number(existingVote.user_id) === Number(userId);

      if (existingVote.vote_type === vote_type) {
        if (isOwnedByUser) {
          await db.execute('DELETE FROM votes WHERE id = ?', [existingVote.id]);
          return res.json({ status: true, message: 'Vote removed', action: 'removed' });
        }

        if (userId && !isOwnedByUser) {
          await db.execute('UPDATE votes SET user_id = ?, user_ip = ? WHERE id = ?', [
            userId,
            user_ip,
            existingVote.id,
          ]);
        }

        return res.json({ status: true, message: 'Already voted', action: 'unchanged' });
      }

      await db.execute('UPDATE votes SET vote_type = ?, user_id = ?, user_ip = ? WHERE id = ?', [
        vote_type,
        userId,
        user_ip,
        existingVote.id,
      ]);
      return res.json({
        status: true,
        message: 'Vote updated',
        action: 'updated',
        previous_vote: existingVote.vote_type,
        new_vote: vote_type,
      });
    }

    if (userId) {
      await db.execute(
        `
          INSERT INTO votes (manga_id, vote_type, user_id, user_ip)
          VALUES (?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE
            vote_type = VALUES(vote_type),
            user_id = VALUES(user_id),
            user_ip = VALUES(user_ip)
        `,
        [mangaId, vote_type, userId, user_ip]
      );
    } else {
      await db.execute(
        `
          INSERT INTO votes (manga_id, vote_type, user_ip)
          VALUES (?, ?, ?)
          ON DUPLICATE KEY UPDATE
            vote_type = VALUES(vote_type),
            user_ip = VALUES(user_ip)
        `,
        [mangaId, vote_type, user_ip]
      );
    }
    return res.json({ status: true, message: 'Vote recorded', action: 'added' });
  } catch (error) {
    console.error('Error recording vote:', error);
    res.status(500).json({ status: false, error: 'Internal server error' });
  }
};

module.exports = {
  getBySlug,
  submit,
};

