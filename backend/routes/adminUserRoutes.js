const router = require('express').Router();
const { authenticateToken } = require('../middlewares/auth');
const requireAdmin = require('../middlewares/requireAdmin');
const UserAdminController = require('../controllers/UserAdminController');

router.get('/', authenticateToken, requireAdmin, UserAdminController.listUsers);
router.post('/', authenticateToken, requireAdmin, UserAdminController.createUser);
router.put('/:id', authenticateToken, requireAdmin, UserAdminController.updateUser);
router.delete('/:id', authenticateToken, requireAdmin, UserAdminController.deleteUser);

module.exports = router;
