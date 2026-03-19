const express = require('express');
const router = express.Router();

const ContentsController = require('../controllers/ContentsController');

router.get('/genres', ContentsController.genres);
router.get('/', ContentsController.list);

module.exports = router;

