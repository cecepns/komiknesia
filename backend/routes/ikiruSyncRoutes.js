const express = require('express');
const { authenticateToken } = require('../middlewares/auth');
const requireAdmin = require('../middlewares/requireAdmin');
const IkiruSyncController = require('../controllers/IkiruSyncController');

// Scrape ke Ikiru: ikiruSession (login + jar). Cloudflare: simpan cookie lewat PUT .../cloudflare-cookies atau file data/ikiru-cloudflare-cookies.txt.

const router = express.Router();

router.get(
  '/cloudflare-cookies',
  authenticateToken,
  requireAdmin,
  IkiruSyncController.getCloudflareCookiesMeta
);
router.put(
  '/cloudflare-cookies',
  authenticateToken,
  requireAdmin,
  IkiruSyncController.putCloudflareCookies
);

router.get('/feed', authenticateToken, requireAdmin, IkiruSyncController.listFeed);
router.post('/latest', authenticateToken, requireAdmin, IkiruSyncController.syncLatest);
router.post('/project', authenticateToken, requireAdmin, IkiruSyncController.syncProject);
router.post('/selected', authenticateToken, requireAdmin, IkiruSyncController.syncSelected);
// Cron sync: tanpa JWT; scrape Ikiru tetap pakai ikiruSession (sama seperti endpoint admin lain).
// Contoh: POST /api/admin/ikiru-sync/cron-sync?type=latest&page=1&mode=delta&withImages=true
router.post('/cron-sync', IkiruSyncController.cronSyncFeed);
router.post('/manga/:slug', authenticateToken, requireAdmin, IkiruSyncController.syncMangaBySlug);
// Init + plan queue for sync manga/chapter progress
router.post('/manga/:slug/init', authenticateToken, requireAdmin, IkiruSyncController.syncMangaInit);
// Sync single chapter (optionally images)
router.post('/manga/:slug/chapter/:chapterSlug', authenticateToken, requireAdmin, IkiruSyncController.syncMangaChapter);
router.post(
  '/manga/:slug/chapter/:chapterSlug/images',
  authenticateToken,
  requireAdmin,
  IkiruSyncController.syncChapterImages
);

module.exports = router;

