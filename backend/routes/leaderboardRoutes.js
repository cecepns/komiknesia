const router = require('express').Router();
const LeaderboardController = require('../controllers/LeaderboardController');
const { optionalAuthenticate } = require('../middlewares/auth');

router.get('/', optionalAuthenticate, LeaderboardController.getLeaderboard);

module.exports = router;
