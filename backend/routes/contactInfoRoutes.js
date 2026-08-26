const router = require('express').Router();

const { authenticateToken } = require('../middlewares/auth');
const requireAdmin = require('../middlewares/requireAdmin');
const ContactInfoController = require('../controllers/ContactInfoController');

router.get('/', ContactInfoController.show);
router.post('/', authenticateToken, requireAdmin, ContactInfoController.store);
router.put('/:id', authenticateToken, requireAdmin, ContactInfoController.update);
router.delete('/:id', authenticateToken, requireAdmin, ContactInfoController.destroy);

module.exports = router;

