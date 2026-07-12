const express = require('express');
const { authenticateToken } = require('../middlewares/auth');
const ApkomikSyncController = require('../controllers/ApkomikSyncController');

const router = express.Router();

router.get('/feed', authenticateToken, ApkomikSyncController.listFeed);
router.post('/latest', authenticateToken, ApkomikSyncController.syncLatest);
router.post('/selected', authenticateToken, ApkomikSyncController.syncSelected);
router.post('/manga/:slug', authenticateToken, ApkomikSyncController.syncMangaBySlug);
router.post('/manga/:slug/init', authenticateToken, ApkomikSyncController.syncMangaInit);
router.post('/manga/:slug/chapter/:chapterSlug', authenticateToken, ApkomikSyncController.syncMangaChapter);
router.post(
  '/manga/:slug/chapter/:chapterSlug/images',
  authenticateToken,
  ApkomikSyncController.syncChapterImages
);

module.exports = router;
