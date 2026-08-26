const router = require('express').Router();

const { authenticateToken } = require('../middlewares/auth');
const requireAdmin = require('../middlewares/requireAdmin');
const { upload } = require('../middlewares/upload');
const MangaController = require('../controllers/MangaController');

// List manga
router.get('/', MangaController.index);

// Detail by slug
router.get('/slug/:slug', MangaController.showBySlug);

// Create / update / delete manga (with upload)
router.post(
  '/',
  authenticateToken,
  requireAdmin,
  upload.fields([
    { name: 'thumbnail', maxCount: 1 },
    { name: 'cover_background', maxCount: 1 },
  ]),
  MangaController.store
);
router.put(
  '/:id',
  authenticateToken,
  requireAdmin,
  upload.fields([
    { name: 'thumbnail', maxCount: 1 },
    { name: 'cover_background', maxCount: 1 },
  ]),
  MangaController.update
);
router.delete('/:id', authenticateToken, requireAdmin, MangaController.destroy);

// Chapters under a manga
router.get('/:mangaId/chapters', MangaController.listChapters);
router.post(
  '/:mangaId/chapters',
  authenticateToken,
  requireAdmin,
  upload.single('cover'),
  MangaController.createChapter
);

// Search
router.get('/search', MangaController.search);

module.exports = router;

