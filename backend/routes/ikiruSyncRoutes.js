const express = require('express');
const { authenticateToken } = require('../middlewares/auth');
const IkiruSyncController = require('../controllers/IkiruSyncController');

const router = express.Router();

router.get('/feed', authenticateToken, IkiruSyncController.listFeed);
router.post('/latest', authenticateToken, IkiruSyncController.syncLatest);
router.post('/project', authenticateToken, IkiruSyncController.syncProject);
router.post('/selected', authenticateToken, IkiruSyncController.syncSelected);
// Endpoint untuk cronjob (tanpa auth khusus; cukup diproteksi di layer server/cron)
// Contoh: POST /api/ikiru/cron-sync?type=latest&page=1&mode=delta&withImages=true
router.post('/cron-sync', IkiruSyncController.cronSyncFeed);
router.post('/manga/:slug', authenticateToken, IkiruSyncController.syncMangaBySlug);
router.post(
  '/manga/:slug/chapter/:chapterSlug/images',
  authenticateToken,
  IkiruSyncController.syncChapterImages
);

module.exports = router;

