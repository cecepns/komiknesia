const router = require('express').Router();

const { authenticateToken } = require('../middlewares/auth');
const { upload } = require('../middlewares/upload');
const CommentController = require('../controllers/CommentController');

router.get('/', CommentController.index);
router.post('/', authenticateToken, CommentController.store);
router.delete('/:id', authenticateToken, CommentController.destroy);
router.post('/upload-image', authenticateToken, upload.single('image'), CommentController.uploadImage);

module.exports = router;

