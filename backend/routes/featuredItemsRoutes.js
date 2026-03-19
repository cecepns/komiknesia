const router = require('express').Router();

const { authenticateToken } = require('../middlewares/auth');
const FeaturedItemsController = require('../controllers/FeaturedItemsController');

router.get('/', FeaturedItemsController.index);
router.post('/', authenticateToken, FeaturedItemsController.store);
router.put('/:id', authenticateToken, FeaturedItemsController.update);
router.delete('/:id', authenticateToken, FeaturedItemsController.destroy);

module.exports = router;

