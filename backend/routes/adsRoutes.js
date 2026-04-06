const router = require('express').Router();

const { authenticateToken } = require('../middlewares/auth');
const { upload } = require('../middlewares/upload');
const AdsController = require('../controllers/AdsController');

router.get('/', AdsController.index);
router.post('/', authenticateToken, upload.single('image'), AdsController.store);
// Frontend kadang memakai POST untuk edit (lebih toleran).
router.post(
  '/:id',
  authenticateToken,
  upload.single('image'),
  AdsController.update
);
router.put('/:id', authenticateToken, upload.single('image'), AdsController.update);
router.delete('/:id', authenticateToken, AdsController.destroy);

module.exports = router;

