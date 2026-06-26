const express = require('express');
const router = express.Router();
const notificationsController = require('../controllers/notifications.controller.js');

router.get('/', notificationsController.index);

module.exports = router;
