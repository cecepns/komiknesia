/* eslint-disable no-undef */
/* eslint-env node */
const router = require('express').Router();

const { authenticateToken } = require('../middlewares/auth');
const requireAdmin = require('../middlewares/requireAdmin');
const { upload } = require('../middlewares/upload');
const StickerController = require('../controllers/StickerController');

router.get('/', StickerController.listPublic);

router.get('/admin', authenticateToken, requireAdmin, StickerController.listAdmin);
router.post('/admin', authenticateToken, requireAdmin, upload.single('image'), StickerController.createSticker);
router.put('/admin/:id', authenticateToken, requireAdmin, upload.single('image'), StickerController.updateSticker);
router.delete('/admin/:id', authenticateToken, requireAdmin, StickerController.deleteSticker);

module.exports = router;
