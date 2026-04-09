/* eslint-disable no-undef */
/* eslint-env node */
const router = require('express').Router();

const { authenticateToken } = require('../middlewares/auth');
const { upload } = require('../middlewares/upload');
const PremiumOrderController = require('../controllers/PremiumOrderController');

router.post('/', upload.single('proof_image'), PremiumOrderController.createOrder);

router.get('/admin', authenticateToken, PremiumOrderController.listOrders);
router.patch('/admin/:id/status', authenticateToken, PremiumOrderController.updateOrderStatus);
router.delete('/admin/:id', authenticateToken, PremiumOrderController.deleteOrder);

module.exports = router;
