const express = require('express');
const router = express.Router();
const inventoryController = require('../controllers/inventory.controller.js');

router.get('/', inventoryController.index);

module.exports = router;
