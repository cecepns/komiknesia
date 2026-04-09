const db = require('../db');

const getLeaderboard = async (req, res) => {
  try {
    const limit = Math.min(Math.max(parseInt(req.query.limit || '50', 10), 1), 100);
    const [rows] = await db.execute(
      `SELECT
          id,
          username,
          profile_image,
          points,
          is_membership,
          membership_expires_at
       FROM users
       ORDER BY points DESC, id ASC
       LIMIT ?`,
      [limit]
    );

    res.json({
      status: true,
      data: rows.map((row, index) => {
        const points = Number(row.points || 0);
        return {
          rank: index + 1,
          id: row.id,
          name: row.username,
          profile_image: row.profile_image || null,
          points,
          is_membership: !!row.is_membership,
          membership_expires_at: row.membership_expires_at,
          level: Math.max(1, Math.floor(points / 100) + 1),
        };
      }),
    });
  } catch (error) {
    console.error('Error fetching leaderboard:', error);
    res.status(500).json({ status: false, error: 'Internal server error' });
  }
};

module.exports = {
  getLeaderboard,
};
