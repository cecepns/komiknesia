const router = require('express').Router();

const { authenticateToken } = require('../middlewares/auth');
const DashboardController = require('../controllers/DashboardController');

// GET /api/dashboard/stats
router.get('/stats', authenticateToken, DashboardController.stats);

module.exports = router;

