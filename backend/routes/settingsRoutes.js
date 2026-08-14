const router = require('express').Router();

const { authenticateToken } = require('../middlewares/auth');
const { upload } = require('../middlewares/upload');
const SettingsController = require('../controllers/SettingsController');

router.get('/', SettingsController.show);
router.put('/', authenticateToken, SettingsController.update);
router.post('/upload-banner', authenticateToken, upload.single('image'), SettingsController.uploadBanner);

module.exports = router;

