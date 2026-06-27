const express = require('express');
const router = express.Router();

const authMiddleware = require('../middleware/auth.middleware');
const roleGuard = require('../middleware/roleGuard.middleware');

const {
  getNotifications,
  markAsRead,
  getUnreadCount
} = require('../controllers/notifications.controller');

router.get('/', authMiddleware, roleGuard(['owner', 'finance']), getNotifications);
router.get('/unread-count', authMiddleware, roleGuard(['owner', 'finance']), getUnreadCount);
router.patch('/:id/read', authMiddleware, roleGuard(['owner', 'finance']), markAsRead);

module.exports = router;
