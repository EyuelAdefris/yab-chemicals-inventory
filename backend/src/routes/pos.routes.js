const express = require('express');
const router = express.Router();
const posController = require('../controllers/pos.controller.js');

router.get('/', posController.index);

module.exports = router;
