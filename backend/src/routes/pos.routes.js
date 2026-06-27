const express = require('express');
const router = express.Router();

const authMiddleware = require('../middleware/auth.middleware');
const roleGuard = require('../middleware/roleGuard.middleware');
const { auditLog } = require('../middleware/audit.middleware');

const {
  createStockOutRequest,
  approveStockOut,
  rejectStockOut,
  getStockOutRequests
} = require('../controllers/pos.controller');

router.post('/request', authMiddleware, roleGuard(['marketer']), auditLog('CREATE_STOCK_OUT', 'stock_out_requests'), createStockOutRequest);
router.patch('/request/:id/approve', authMiddleware, roleGuard(['storekeeper']), auditLog('APPROVE_STOCK_OUT', 'stock_out_requests'), approveStockOut);
router.patch('/request/:id/reject', authMiddleware, roleGuard(['storekeeper']), auditLog('REJECT_STOCK_OUT', 'stock_out_requests'), rejectStockOut);
router.get('/requests', authMiddleware, roleGuard(['owner', 'finance', 'marketer', 'storekeeper']), getStockOutRequests);

module.exports = router;
