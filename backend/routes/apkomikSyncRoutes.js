const express = require('express');
const { authenticateToken } = require('../middlewares/auth');
const requireAdmin = require('../middlewares/requireAdmin');
const ApkomikSyncController = require('../controllers/ApkomikSyncController');

const router = express.Router();

router.get('/feed', authenticateToken, requireAdmin, ApkomikSyncController.listFeed);
router.post('/latest', authenticateToken, requireAdmin, ApkomikSyncController.syncLatest);
router.post('/selected', authenticateToken, requireAdmin, ApkomikSyncController.syncSelected);
router.post('/manga/:slug', authenticateToken, requireAdmin, ApkomikSyncController.syncMangaBySlug);
router.post('/manga/:slug/init', authenticateToken, requireAdmin, ApkomikSyncController.syncMangaInit);
router.post('/manga/:slug/chapter/:chapterSlug', authenticateToken, requireAdmin, ApkomikSyncController.syncMangaChapter);
router.post(
  '/manga/:slug/chapter/:chapterSlug/images',
  authenticateToken,
  requireAdmin,
  ApkomikSyncController.syncChapterImages
);

module.exports = router;
