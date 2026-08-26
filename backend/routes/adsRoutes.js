const router = require('express').Router();

const { authenticateToken } = require('../middlewares/auth');
const requireAdmin = require('../middlewares/requireAdmin');
const { upload } = require('../middlewares/upload');
const AdsController = require('../controllers/AdsController');

router.get('/', AdsController.index);
router.post('/', authenticateToken, requireAdmin, upload.single('image'), AdsController.store);
// Frontend kadang memakai POST untuk edit (lebih toleran).
router.post(
  '/:id',
  authenticateToken,
  requireAdmin,
  upload.single('image'),
  AdsController.update
);
router.put('/:id', authenticateToken, requireAdmin, upload.single('image'), AdsController.update);
router.delete('/:id', authenticateToken, requireAdmin, AdsController.destroy);

module.exports = router;

