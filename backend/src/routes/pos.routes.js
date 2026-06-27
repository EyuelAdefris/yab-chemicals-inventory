const express = require('express');
const router = express.Router();

const authMiddleware = require('../middleware/auth.middleware');
const roleGuard = require('../middleware/roleGuard.middleware');

const {
  createStockOutRequest,
  approveStockOut,
  rejectStockOut,
  getStockOutRequests
} = require('../controllers/pos.controller');

router.post('/request', authMiddleware, roleGuard(['marketer']), createStockOutRequest);
router.patch('/request/:id/approve', authMiddleware, roleGuard(['storekeeper']), approveStockOut);
router.patch('/request/:id/reject', authMiddleware, roleGuard(['storekeeper']), rejectStockOut);
router.get('/requests', authMiddleware, roleGuard(['owner', 'finance', 'marketer', 'storekeeper']), getStockOutRequests);

module.exports = router;
