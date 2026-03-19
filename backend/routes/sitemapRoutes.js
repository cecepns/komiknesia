const router = require('express').Router();

const SitemapController = require('../controllers/SitemapController');

// Public robots + sitemaps
router.get('/robots.txt', SitemapController.robots);
router.get('/sitemap.xml', SitemapController.sitemapMain);
router.get('/sitemap-index.xml', SitemapController.sitemapIndex);
router.get('/sitemap-manga.xml', SitemapController.sitemapManga);
router.get('/sitemap-chapters.xml', SitemapController.sitemapChapters);

// API stats (kept under /api prefix when mounted)
router.get('/api/sitemap/stats', SitemapController.sitemapStats);

module.exports = router;

