const router = require('express').Router();

const { optionalAuthenticate } = require('../middlewares/auth');
const VoteController = require('../controllers/VoteController');

router.get('/:slug', optionalAuthenticate, VoteController.getBySlug);
router.post('/', optionalAuthenticate, VoteController.submit);

module.exports = router;

