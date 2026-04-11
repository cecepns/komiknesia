const router = require('express').Router();

const { authenticateToken } = require('../middlewares/auth');
const LiveChatController = require('../controllers/LiveChatController');

router.get('/', LiveChatController.index);
router.post('/', authenticateToken, LiveChatController.store);

module.exports = router;

