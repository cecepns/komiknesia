const db = require('../db');

const getBySlug = async (req, res) => {
  try {
    const { slug } = req.params;
    const user_ip =
      req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for'] || 'unknown';

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

    const user_ip =
      req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for'] || 'unknown';
    const userId = req.user ? req.user.id : null;

    const [mangaRows] = await db.execute('SELECT id FROM manga WHERE slug = ?', [slug]);

    if (mangaRows.length === 0) {
      return res.status(404).json({ status: false, error: 'Manga not found' });
    }

    const mangaId = mangaRows[0].id;

    const whereClause = userId
      ? 'manga_id = ? AND user_id = ?'
      : 'manga_id = ? AND user_ip = ? AND (user_id IS NULL OR user_id = 0)';
    const whereParams = userId ? [mangaId, userId] : [mangaId, user_ip];

    const [existing] = await db.execute(
      `SELECT id, vote_type FROM votes WHERE ${whereClause}`,
      whereParams
    );

    if (existing.length > 0) {
      if (existing[0].vote_type === vote_type) {
        if (userId) {
          await db.execute('DELETE FROM votes WHERE id = ?', [existing[0].id]);
          return res.json({ status: true, message: 'Vote removed', action: 'removed' });
        }
        return res.json({ status: true, message: 'Already voted', action: 'unchanged' });
      }
      await db.execute('UPDATE votes SET vote_type = ? WHERE id = ?', [
        vote_type,
        existing[0].id,
      ]);
      return res.json({
        status: true,
        message: 'Vote updated',
        action: 'updated',
        previous_vote: existing[0].vote_type,
        new_vote: vote_type,
      });
    }

    if (userId) {
      await db.execute(
        'INSERT INTO votes (manga_id, vote_type, user_id) VALUES (?, ?, ?)',
        [mangaId, vote_type, userId]
      );
    } else {
      await db.execute(
        'INSERT INTO votes (manga_id, vote_type, user_ip) VALUES (?, ?, ?)',
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

