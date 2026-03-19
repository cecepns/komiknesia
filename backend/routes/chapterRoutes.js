const router = require('express').Router();

const { authenticateToken } = require('../middlewares/auth');
const { upload } = require('../middlewares/upload');
const ChapterController = require('../controllers/ChapterController');

// Detail chapter by slug
// Mounted at /api/chapters → full path: /api/chapters/slug/:slug
router.get('/slug/:slug', ChapterController.showBySlug);

// Chapter CRUD for admin (mounted at /api/chapters)
// Full paths:
// - PUT /api/chapters/:id
// - DELETE /api/chapters/:id
router.put(
  '/:id',
  authenticateToken,
  upload.single('cover'),
  ChapterController.update
);
router.delete('/:id', authenticateToken, ChapterController.destroy);

// Chapter images management (mounted at /api/chapters)
// Expected by frontend as:
// - GET /api/chapters/:chapterId/images
// - POST /api/chapters/:chapterId/images
// - DELETE /api/chapters/:chapterId/images/:imageId
// - PUT /api/chapters/:chapterId/images/reorder
router.get('/:chapterId/images', ChapterController.listImages);
router.post(
  '/:chapterId/images',
  authenticateToken,
  upload.array('images', 200),
  ChapterController.uploadImages
);
router.delete(
  '/:chapterId/images/:imageId',
  authenticateToken,
  ChapterController.deleteImage
);
router.put(
  '/:chapterId/images/reorder',
  authenticateToken,
  ChapterController.reorderImages
);

module.exports = router;

