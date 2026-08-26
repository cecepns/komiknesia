const express = require('express');
const router = express.Router();

const { upload } = require('../middlewares/upload');
const { authenticateToken } = require('../middlewares/auth');
const { verifyTurnstile } = require('../middlewares/verifyTurnstile');
const { registerLimiter, loginLimiter } = require('../middlewares/rateLimiter');
const authController = require('../controllers/authController');

router.post(
  '/send-register-otp',
  registerLimiter,
  verifyTurnstile,
  authController.sendRegisterOtp
);
router.post(
  '/register',
  registerLimiter,
  upload.single('profile_image'),
  verifyTurnstile,
  authController.register
);
router.post('/login', loginLimiter, authController.login);
router.post('/forgot-password', loginLimiter, verifyTurnstile, authController.forgotPassword);
router.post('/reset-password', loginLimiter, verifyTurnstile, authController.resetPassword);
router.post('/verify-turnstile', authController.verifyTurnstileToken);
router.get('/profile/:username', authController.publicProfile);
router.get('/me', authenticateToken, authController.me);
router.put('/profile', authenticateToken, upload.single('profile_image'), authController.updateProfile);

module.exports = router;

