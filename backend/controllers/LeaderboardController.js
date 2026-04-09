const db = require('../db');

const getLeaderboard = async (req, res) => {
  try {
    const limit = 100;
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

    let currentUser = null;
    if (req.user?.id) {
      const [currentRows] = await db.execute(
        `SELECT id, username, profile_image, points, is_membership, membership_expires_at
         FROM users
         WHERE id = ?`,
        [req.user.id]
      );

      if (currentRows.length > 0) {
        const current = currentRows[0];
        const [rankRows] = await db.execute(
          `SELECT COUNT(*) AS higher_count
           FROM users
           WHERE points > ?
             OR (points = ? AND id < ?)`,
          [current.points || 0, current.points || 0, current.id]
        );
        const rank = Number(rankRows[0]?.higher_count || 0) + 1;
        const points = Number(current.points || 0);
        currentUser = {
          rank,
          id: current.id,
          name: current.username,
          profile_image: current.profile_image || null,
          points,
          is_membership: !!current.is_membership,
          membership_expires_at: current.membership_expires_at,
          level: Math.max(1, Math.floor(points / 100) + 1),
        };
      }
    }

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
      current_user: currentUser,
    });
  } catch (error) {
    console.error('Error fetching leaderboard:', error);
    res.status(500).json({ status: false, error: 'Internal server error' });
  }
};

module.exports = {
  getLeaderboard,
};
