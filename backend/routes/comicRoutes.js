const router = require('express').Router();

const ComicController = require('../controllers/ComicController');

// GET /api/comic/:slug
router.get('/:slug', ComicController.detailBySlug);

// POST /api/comic/:slug/view
router.post('/:slug/view', ComicController.incrementView);

module.exports = router;

