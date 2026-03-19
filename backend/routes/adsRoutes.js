const router = require('express').Router();

const { authenticateToken } = require('../middlewares/auth');
const { upload } = require('../middlewares/upload');
const AdsController = require('../controllers/AdsController');

router.get('/', AdsController.index);
router.post('/', authenticateToken, upload.single('image'), AdsController.store);
router.put('/:id', authenticateToken, upload.single('image'), AdsController.update);
router.delete('/:id', authenticateToken, AdsController.destroy);

module.exports = router;

