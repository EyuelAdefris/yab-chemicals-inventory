const express = require('express');
const router = express.Router();

const authMiddleware = require('../middleware/auth.middleware');
const roleGuard = require('../middleware/roleGuard.middleware');
const { auditLog } = require('../middleware/audit.middleware');

const {
  login,
  createStaff,
  getAllStaff,
  changePassword,
  updateStaff,
  toggleStaffActive
} = require('../controllers/auth.controller');

router.post('/login', auditLog('LOGIN', 'users'), login);
router.post('/create-staff', authMiddleware, roleGuard(['owner']), auditLog('CREATE_STAFF', 'users'), createStaff);
router.get('/staff', authMiddleware, roleGuard(['owner']), getAllStaff);
router.patch('/change-password', authMiddleware, auditLog('CHANGE_PASSWORD', 'users'), changePassword);
router.patch('/staff/:id', authMiddleware, roleGuard(['owner']), auditLog('UPDATE_STAFF', 'users'), updateStaff);
router.patch('/staff/:id/deactivate', authMiddleware, roleGuard(['owner']), auditLog('TOGGLE_STAFF_ACTIVE', 'users'), toggleStaffActive);

module.exports = router;
