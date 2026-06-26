const express = require('express');
const router = express.Router();
const auditController = require('../controllers/audit.controller.js');

router.get('/', auditController.index);

module.exports = router;
