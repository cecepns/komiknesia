const router = require('express').Router();

const { authenticateToken } = require('../middlewares/auth');
const SettingsController = require('../controllers/SettingsController');

router.get('/', SettingsController.show);
router.put('/', authenticateToken, SettingsController.update);

module.exports = router;

