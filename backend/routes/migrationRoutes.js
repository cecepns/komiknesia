const express = require('express');
const { authenticateToken } = require('../middlewares/auth');
const MangaMigrationController = require('../controllers/MangaMigrationController');

const router = express.Router();

router.get('/manga', authenticateToken, MangaMigrationController.listManga);
router.post('/start', authenticateToken, MangaMigrationController.startMigration);
router.get('/status/:taskId', authenticateToken, MangaMigrationController.getStatus);
router.post('/abort/:taskId', authenticateToken, MangaMigrationController.abortMigration);

module.exports = router;
