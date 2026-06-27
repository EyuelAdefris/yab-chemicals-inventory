const pool = require('../db/pool');
const { successResponse, errorResponse } = require('../utils/responseHelper');

const getNotifications = async (req, res) => {
  try {
    const { role } = req.user;
    const query = `
      SELECT n.*, cb.batch_number 
      FROM notifications n
      LEFT JOIN chemical_batches cb ON n.related_batch_id = cb.id
      WHERE n.recipient_role = $1
      ORDER BY n.created_at DESC
    `;
    const result = await pool.query(query, [role]);
    return successResponse(res, result.rows, 'Notifications retrieved successfully', 200);
  } catch (error) {
    console.error(error);
    return errorResponse(res, 'Internal server error', 500);
  }
};

const markAsRead = async (req, res) => {
  try {
    const { id } = req.params;
    const { role } = req.user;
    const query = `
      UPDATE notifications 
      SET is_read = true 
      WHERE id = $1 AND recipient_role = $2 
      RETURNING *
    `;
    const result = await pool.query(query, [id, role]);
    
    if (result.rows.length === 0) {
      return errorResponse(res, 'Notification not found', 404);
    }
    
    return successResponse(res, result.rows[0], 'Notification marked as read', 200);
  } catch (error) {
    console.error(error);
    return errorResponse(res, 'Internal server error', 500);
  }
};

const getUnreadCount = async (req, res) => {
  try {
    const { role } = req.user;
    const query = `
      SELECT COUNT(*) 
      FROM notifications 
      WHERE recipient_role = $1 AND is_read = false
    `;
    const result = await pool.query(query, [role]);
    const count = parseInt(result.rows[0].count, 10);
    
    return successResponse(res, { count }, 'Unread count retrieved successfully', 200);
  } catch (error) {
    console.error(error);
    return errorResponse(res, 'Internal server error', 500);
  }
};

module.exports = {
  getNotifications,
  markAsRead,
  getUnreadCount
};
