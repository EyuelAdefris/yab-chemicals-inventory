const express = require('express');
const router = express.Router();

const authMiddleware = require('../middleware/auth.middleware');
const roleGuard = require('../middleware/roleGuard.middleware');
const pricingGuard = require('../middleware/pricingGuard.middleware');

const {
  createBatch,
  setBatchPrice,
  getAllBatches,
  getBatchById,
  getCategories,
  createCategory
} = require('../controllers/inventory.controller');

router.post('/batches', authMiddleware, roleGuard(['storekeeper']), pricingGuard, createBatch);
router.patch('/batches/:id/price', authMiddleware, roleGuard(['owner', 'finance']), setBatchPrice);
router.get('/batches', authMiddleware, pricingGuard, getAllBatches);
router.get('/batches/:id', authMiddleware, pricingGuard, getBatchById);
router.get('/categories', authMiddleware, getCategories);
router.post('/categories', authMiddleware, roleGuard(['owner', 'storekeeper']), createCategory);

module.exports = router;
