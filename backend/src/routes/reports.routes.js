const express = require('express');
const router = express.Router();
const reportsController = require('../controllers/reports.controller.js');

router.get('/', reportsController.index);

module.exports = router;
