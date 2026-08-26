const express = require('express');
const router = express.Router();

const { authenticateToken } = require('../middlewares/auth');
const requireAdmin = require('../middlewares/requireAdmin');
const CategoriesController = require('../controllers/CategoriesController');

router.get('/', CategoriesController.index);
router.post('/', authenticateToken, requireAdmin, CategoriesController.store);
router.put('/:id', authenticateToken, requireAdmin, CategoriesController.update);
router.delete('/:id', authenticateToken, requireAdmin, CategoriesController.destroy);

module.exports = router;

