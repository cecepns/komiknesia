const router = require('express').Router();

const { authenticateToken } = require('../middlewares/auth');
const ContactInfoController = require('../controllers/ContactInfoController');

router.get('/', ContactInfoController.show);
router.post('/', authenticateToken, ContactInfoController.store);
router.put('/:id', authenticateToken, ContactInfoController.update);
router.delete('/:id', authenticateToken, ContactInfoController.destroy);

module.exports = router;

