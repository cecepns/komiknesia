const router = require('express').Router();

const { authenticateToken } = require('../middlewares/auth');
const requireAdmin = require('../middlewares/requireAdmin');
const FeaturedItemsController = require('../controllers/FeaturedItemsController');

router.get('/search', authenticateToken, requireAdmin, FeaturedItemsController.searchManga);
router.get('/', FeaturedItemsController.index);
router.post('/', authenticateToken, requireAdmin, FeaturedItemsController.store);
router.put('/:id', authenticateToken, requireAdmin, FeaturedItemsController.update);
router.delete('/:id', authenticateToken, requireAdmin, FeaturedItemsController.destroy);

module.exports = router;

