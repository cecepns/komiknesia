const express = require('express');
const IkiruScrapController = require('../controllers/IkiruScrapController');
const IkiruSyncController = require('../controllers/IkiruSyncController');

const router = express.Router();

router.get('/project-updates', IkiruScrapController.getProjectUpdates);
router.get('/latest-updates', IkiruScrapController.getLatestUpdates);
router.get('/manga/:slug', IkiruScrapController.getMangaDetail);
router.get('/manga/:slug/chapter/:chapterSlug/images', IkiruScrapController.getChapterImages);

// List feed untuk admin pilih manga sebelum sync.
// GET /api/ikiru/feed?type=latest|project&page=1
router.get('/feed', IkiruSyncController.listFeed);

// Sync berdasarkan pilihan admin (otomatis detail + chapters + images).
// POST /api/ikiru/sync { slugs: string[] }
router.post('/sync', IkiruSyncController.syncSelected);

module.exports = router;

