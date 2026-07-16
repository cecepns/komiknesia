const express = require('express');
const router = express.Router();
const { receiveScrapedData } = require('../controllers/ScrapperSyncController');

// Middleware sederhana untuk token
const verifyScrapperToken = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ status: false, error: 'Authorization header is missing' });
  }

  const token = authHeader.split(' ')[1];
  const secret = process.env.IKIRU_CRON_SECRET || 'komiknesia-secret';

  if (token !== secret) {
    return res.status(403).json({ status: false, error: 'Invalid scrapper token' });
  }

  next();
};

router.post('/sync', verifyScrapperToken, receiveScrapedData);

module.exports = router;
