const express = require('express');
const router = express.Router();

const { authenticateToken } = require('../middlewares/auth');
const CategoriesController = require('../controllers/CategoriesController');

router.get('/', CategoriesController.index);
router.post('/', authenticateToken, CategoriesController.store);
router.put('/:id', authenticateToken, CategoriesController.update);
router.delete('/:id', authenticateToken, CategoriesController.destroy);

module.exports = router;

