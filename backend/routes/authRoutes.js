const express = require('express');
const router = express.Router();

const { upload } = require('../middlewares/upload');
const { authenticateToken } = require('../middlewares/auth');
const authController = require('../controllers/authController');

router.post('/register', upload.single('profile_image'), authController.register);
router.post('/login', authController.login);
router.get('/profile/:username', authController.publicProfile);
router.get('/me', authenticateToken, authController.me);
router.put('/profile', authenticateToken, upload.single('profile_image'), authController.updateProfile);

module.exports = router;

