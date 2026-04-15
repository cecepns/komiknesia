const db = require('../db');

const stats = async (req, res) => {
  try {
    const [mangaCount] = await db.execute('SELECT COUNT(*) as total FROM manga');
    const [categoryCount] = await db.execute('SELECT COUNT(*) as total FROM categories');
    const [viewsResult] = await db.execute('SELECT COALESCE(SUM(views), 0) as total FROM manga');
    const [adsCount] = await db.execute('SELECT COUNT(*) as total FROM ads');
    const [vipMembersCount] = await db.execute(
      `SELECT COUNT(*) as total
       FROM users
       WHERE is_membership = 1
         AND (membership_expires_at IS NULL OR membership_expires_at >= NOW())`
    );

    res.json({
      totalManga: mangaCount[0].total,
      totalCategories: categoryCount[0].total,
      totalViews: viewsResult[0].total,
      totalAds: adsCount[0].total,
      totalVipMembers: vipMembersCount[0].total,
    });
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = {
  stats,
};

