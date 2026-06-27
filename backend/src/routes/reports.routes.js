const express = require('express');
const router = express.Router();

const authMiddleware = require('../middleware/auth.middleware');
const roleGuard = require('../middleware/roleGuard.middleware');
const { getExpiringSoon } = require('../controllers/reports.controller');

router.get('/expiring-soon', authMiddleware, roleGuard(['owner', 'finance', 'storekeeper', 'marketer']), getExpiringSoon);

module.exports = router;
