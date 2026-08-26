const express = require('express');
const { authenticateToken } = require('../middlewares/auth');
const requireAdmin = require('../middlewares/requireAdmin');
const MangaMigrationController = require('../controllers/MangaMigrationController');

const router = express.Router();

router.get('/manga', authenticateToken, requireAdmin, MangaMigrationController.listManga);
router.post('/start', authenticateToken, requireAdmin, MangaMigrationController.startMigration);
router.get('/status/:taskId', authenticateToken, requireAdmin, MangaMigrationController.getStatus);
router.post('/abort/:taskId', authenticateToken, requireAdmin, MangaMigrationController.abortMigration);

module.exports = router;
