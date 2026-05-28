const router = require('express').Router();

const { optionalAuthenticate } = require('../middlewares/auth');
const ChapterReactionController = require('../controllers/ChapterReactionController');

router.get('/:slug', optionalAuthenticate, ChapterReactionController.getBySlug);
router.post('/', optionalAuthenticate, ChapterReactionController.submit);

module.exports = router;
