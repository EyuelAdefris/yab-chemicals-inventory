const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller.js');

router.get('/', authController.index);

module.exports = router;
