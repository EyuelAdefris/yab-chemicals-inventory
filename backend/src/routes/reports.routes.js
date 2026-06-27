const express = require('express');
const router = express.Router();

const authMiddleware = require('../middleware/auth.middleware');
const roleGuard = require('../middleware/roleGuard.middleware');

const {
  getExpiringSoon,
  getProfitSummary,
  getRevenueSummary
} = require('../controllers/reports.controller');

router.get('/expiring-soon', authMiddleware, roleGuard(['owner', 'finance', 'storekeeper', 'marketer']), getExpiringSoon);
router.get('/profit-summary', authMiddleware, roleGuard(['owner', 'finance']), getProfitSummary);
router.get('/revenue-summary', authMiddleware, roleGuard(['owner', 'finance']), getRevenueSummary);

module.exports = router;
