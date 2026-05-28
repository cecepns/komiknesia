const router = require('express').Router();

const { authenticateToken } = require('../middlewares/auth');
const ReadlistController = require('../controllers/ReadlistController');

router.get('/', authenticateToken, ReadlistController.index);
router.post('/', authenticateToken, ReadlistController.store);
router.get('/:id', authenticateToken, ReadlistController.show);
router.patch('/:id', authenticateToken, ReadlistController.update);
router.delete('/:id', authenticateToken, ReadlistController.destroy);
router.post('/:id/items', authenticateToken, ReadlistController.addItems);
router.delete('/:id/items/:mangaId', authenticateToken, ReadlistController.removeItem);

module.exports = router;
