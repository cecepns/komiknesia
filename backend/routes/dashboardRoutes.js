const router = require('express').Router();

const { authenticateToken } = require('../middlewares/auth');
const requireAdmin = require('../middlewares/requireAdmin');
const DashboardController = require('../controllers/DashboardController');

// GET /api/dashboard/stats
router.get('/stats', authenticateToken, requireAdmin, DashboardController.stats);

module.exports = router;

