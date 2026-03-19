const router = require('express').Router();

const { authenticateToken } = require('../middlewares/auth');
const CommentController = require('../controllers/CommentController');

router.get('/', CommentController.index);
router.post('/', authenticateToken, CommentController.store);
router.delete('/:id', authenticateToken, CommentController.destroy);

module.exports = router;

