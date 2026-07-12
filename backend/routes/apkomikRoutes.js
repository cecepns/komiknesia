/* eslint-disable no-undef */
/* eslint-env node */
const express = require('express');
const ApkomikSyncController = require('../controllers/ApkomikSyncController');

const router = express.Router();

// Public cron sync endpoint:
router.post('/cron-sync', ApkomikSyncController.cronSyncFeed);

module.exports = router;
