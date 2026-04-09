/* eslint-disable no-undef */
/* eslint-env node */
const router = require('express').Router();

const { authenticateToken } = require('../middlewares/auth');
const { upload } = require('../middlewares/upload');
const StickerController = require('../controllers/StickerController');

router.get('/', StickerController.listPublic);

router.get('/admin', authenticateToken, StickerController.listAdmin);
router.post('/admin', authenticateToken, upload.single('image'), StickerController.createSticker);
router.put('/admin/:id', authenticateToken, upload.single('image'), StickerController.updateSticker);
router.delete('/admin/:id', authenticateToken, StickerController.deleteSticker);

module.exports = router;
