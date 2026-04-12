const express = require('express');
const { authenticateToken } = require('../middlewares/auth');
const IkiruSyncController = require('../controllers/IkiruSyncController');

// Scrape ke Ikiru: ikiruSession (login + jar). Cloudflare: simpan cookie lewat PUT .../cloudflare-cookies atau file data/ikiru-cloudflare-cookies.txt.

const router = express.Router();

router.get(
  '/cloudflare-cookies',
  authenticateToken,
  IkiruSyncController.getCloudflareCookiesMeta
);
router.put(
  '/cloudflare-cookies',
  authenticateToken,
  IkiruSyncController.putCloudflareCookies
);

router.get('/feed', authenticateToken, IkiruSyncController.listFeed);
router.post('/latest', authenticateToken, IkiruSyncController.syncLatest);
router.post('/project', authenticateToken, IkiruSyncController.syncProject);
router.post('/selected', authenticateToken, IkiruSyncController.syncSelected);
// Cron sync: tanpa JWT; scrape Ikiru tetap pakai ikiruSession (sama seperti endpoint admin lain).
// Contoh: POST /api/admin/ikiru-sync/cron-sync?type=latest&page=1&mode=delta&withImages=true
router.post('/cron-sync', IkiruSyncController.cronSyncFeed);
router.post('/manga/:slug', authenticateToken, IkiruSyncController.syncMangaBySlug);
// Init + plan queue for sync manga/chapter progress
router.post('/manga/:slug/init', authenticateToken, IkiruSyncController.syncMangaInit);
// Sync single chapter (optionally images)
router.post('/manga/:slug/chapter/:chapterSlug', authenticateToken, IkiruSyncController.syncMangaChapter);
router.post(
  '/manga/:slug/chapter/:chapterSlug/images',
  authenticateToken,
  IkiruSyncController.syncChapterImages
);

module.exports = router;

