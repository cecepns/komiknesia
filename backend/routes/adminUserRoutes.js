const router = require('express').Router();
const { authenticateToken } = require('../middlewares/auth');
const UserAdminController = require('../controllers/UserAdminController');

router.get('/', authenticateToken, UserAdminController.listUsers);
router.post('/', authenticateToken, UserAdminController.createUser);
router.put('/:id', authenticateToken, UserAdminController.updateUser);
router.delete('/:id', authenticateToken, UserAdminController.deleteUser);

module.exports = router;
