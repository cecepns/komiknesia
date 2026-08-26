const router = require('express').Router();

const { authenticateToken, optionalAuthenticate } = require('../middlewares/auth');
const requireAdmin = require('../middlewares/requireAdmin');
const { upload } = require('../middlewares/upload');
const ChapterController = require('../controllers/ChapterController');
const ChapterScheduleController = require('../controllers/ChapterScheduleController');

// Jadwal rilis mingguan (harus sebelum /:chapterId agar tidak bentrok)
router.get('/schedule', ChapterScheduleController.getSchedule);

// Detail chapter by slug
// Mounted at /api/chapters → full path: /api/chapters/slug/:slug
router.get('/slug/:slug', optionalAuthenticate, ChapterController.showBySlug);
router.get('/slug/:slug/download', ChapterController.downloadBySlug);

// Chapter CRUD for admin (mounted at /api/chapters)
// Full paths:
// - PUT /api/chapters/:id
// - DELETE /api/chapters/:id
router.put(
  '/:id',
  authenticateToken,
  requireAdmin,
  upload.single('cover'),
  ChapterController.update
);
router.delete('/:id', authenticateToken, requireAdmin, ChapterController.destroy);

// Chapter images management (mounted at /api/chapters)
// Expected by frontend as:
// - GET /api/chapters/:chapterId/images
// - POST /api/chapters/:chapterId/images
// - DELETE /api/chapters/:chapterId/images/:imageId
// - PUT /api/chapters/:chapterId/images/reorder
router.get('/:chapterId/images', authenticateToken, requireAdmin, ChapterController.listImages);
router.post(
  '/:chapterId/images',
  authenticateToken,
  requireAdmin,
  upload.array('images', 200),
  ChapterController.uploadImages
);
router.delete(
  '/:chapterId/images/:imageId',
  authenticateToken,
  requireAdmin,
  ChapterController.deleteImage
);
router.put(
  '/:chapterId/images/reorder',
  authenticateToken,
  requireAdmin,
  ChapterController.reorderImages
);

module.exports = router;

