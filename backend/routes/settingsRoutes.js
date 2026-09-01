const router = require('express').Router();

const { authenticateToken } = require('../middlewares/auth');
const requireAdmin = require('../middlewares/requireAdmin');
const { upload } = require('../middlewares/upload');
const { encryptResponseMiddleware } = require('../utils/responseEncryptor');
const SettingsController = require('../controllers/SettingsController');

router.get('/', encryptResponseMiddleware, SettingsController.show);
router.put('/', authenticateToken, requireAdmin, SettingsController.update);
router.post('/upload-banner', authenticateToken, requireAdmin, upload.single('image'), SettingsController.uploadBanner);

module.exports = router;

