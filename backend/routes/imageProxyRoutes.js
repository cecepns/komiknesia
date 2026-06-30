const router = require('express').Router();
const ImageProxyController = require('../controllers/ImageProxyController');

router.get('/image-proxy', ImageProxyController.proxy);

module.exports = router;
