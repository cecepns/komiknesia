const db = require('../db');

const getLeaderboard = async (req, res) => {
  try {
    const pageRaw = Number.parseInt(String(req.query.page || '1'), 10);
    const limitRaw = Number.parseInt(String(req.query.limit || '20'), 10);
    const page = Number.isFinite(pageRaw) && pageRaw > 0 ? pageRaw : 1;
    const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 20) : 20;
    const offset = (page - 1) * limit;

    const [countRows] = await db.execute('SELECT COUNT(*) AS total_users FROM users');
    const totalUsers = Number(countRows[0]?.total_users || 0);
    const totalPages = Math.max(1, Math.ceil(totalUsers / limit));

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
       LIMIT ? OFFSET ?`,
      [limit, offset]
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
          username: current.username,
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
          rank: offset + index + 1,
          id: row.id,
          name: row.username,
          username: row.username,
          profile_image: row.profile_image || null,
          points,
          is_membership: !!row.is_membership,
          membership_expires_at: row.membership_expires_at,
          level: Math.max(1, Math.floor(points / 100) + 1),
        };
      }),
      current_user: currentUser,
      total_users: totalUsers,
      page,
      limit,
      total_pages: totalPages,
    });
  } catch (error) {
    console.error('Error fetching leaderboard:', error);
    res.status(500).json({ status: false, error: 'Internal server error' });
  }
};

module.exports = {
  getLeaderboard,
};
