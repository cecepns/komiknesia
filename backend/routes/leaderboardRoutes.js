const router = require('express').Router();
const LeaderboardController = require('../controllers/LeaderboardController');

router.get('/', LeaderboardController.getLeaderboard);

module.exports = router;
