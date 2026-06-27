const express = require('express');
const router = express.Router();

const authMiddleware = require('../middleware/auth.middleware');
const roleGuard = require('../middleware/roleGuard.middleware');

const {
  login,
  createStaff,
  getAllStaff,
  changePassword,
  updateStaff,
  toggleStaffActive
} = require('../controllers/auth.controller');

router.post('/login', login);
router.post('/create-staff', authMiddleware, roleGuard(['owner']), createStaff);
router.get('/staff', authMiddleware, roleGuard(['owner']), getAllStaff);
router.patch('/change-password', authMiddleware, changePassword);
router.patch('/staff/:id', authMiddleware, roleGuard(['owner']), updateStaff);
router.patch('/staff/:id/deactivate', authMiddleware, roleGuard(['owner']), toggleStaffActive);

module.exports = router;
