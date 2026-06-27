const express = require('express');
const router = express.Router();

const authMiddleware = require('../middleware/auth.middleware');
const roleGuard = require('../middleware/roleGuard.middleware');

const {
  getMyActivity,
  getAllActivity
} = require('../controllers/audit.controller');

router.get('/my-activity', authMiddleware, getMyActivity);
router.get('/all-activity', authMiddleware, roleGuard(['owner']), getAllActivity);

module.exports = router;
