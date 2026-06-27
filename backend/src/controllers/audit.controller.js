const pool = require('../db/pool');
const { successResponse, errorResponse } = require('../utils/responseHelper');

const getMyActivity = async (req, res) => {
  try {
    const { userId } = req.user;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;

    const result = await pool.query(
      `SELECT 
        al.id,
        al.action_type,
        al.entity_table,
        al.entity_id,
        al.payload,
        al.ip_address,
        al.created_at,
        u.full_name,
        u.role AS user_role
      FROM audit_logs al
      JOIN users u ON al.user_id = u.id
      WHERE al.user_id = $1
      ORDER BY al.created_at DESC
      LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );

    const countResult = await pool.query(
      'SELECT COUNT(*) FROM audit_logs WHERE user_id = $1',
      [userId]
    );

    const total = parseInt(countResult.rows[0].count, 10);

    return successResponse(res, {
      activities: result.rows,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    }, 'Activity retrieved successfully', 200);
  } catch (error) {
    console.error(error);
    return errorResponse(res, 'Internal server error', 500);
  }
};

const getAllActivity = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;

    const { role, userId, from, to, action } = req.query;

    const params = [];
    const filters = [];

    if (role) {
      params.push(role);
      filters.push(`AND u.role = $${params.length}`);
    }

    if (userId) {
      params.push(userId);
      filters.push(`AND al.user_id = $${params.length}`);
    }

    if (from) {
      params.push(from);
      filters.push(`AND al.created_at >= $${params.length}`);
    }

    if (to) {
      params.push(to);
      filters.push(`AND al.created_at <= $${params.length}`);
    }

    if (action) {
      params.push('%' + action + '%');
      filters.push(`AND al.action_type ILIKE $${params.length}`);
    }

    const filterClause = filters.join(' ');

    const countParams = [...params];
    const countResult = await pool.query(
      `SELECT COUNT(*) FROM audit_logs al
       JOIN users u ON al.user_id = u.id
       WHERE 1=1 ${filterClause}`,
      countParams
    );

    params.push(limit);
    const limitParam = params.length;
    params.push(offset);
    const offsetParam = params.length;

    const result = await pool.query(
      `SELECT 
        al.id,
        al.action_type,
        al.entity_table,
        al.entity_id,
        al.payload,
        al.ip_address,
        al.created_at,
        u.full_name,
        u.username,
        u.role AS user_role
      FROM audit_logs al
      JOIN users u ON al.user_id = u.id
      WHERE 1=1 ${filterClause}
      ORDER BY al.created_at DESC
      LIMIT $${limitParam} OFFSET $${offsetParam}`,
      params
    );

    const total = parseInt(countResult.rows[0].count, 10);

    return successResponse(res, {
      activities: result.rows,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    }, 'All activity retrieved successfully', 200);
  } catch (error) {
    console.error(error);
    return errorResponse(res, 'Internal server error', 500);
  }
};

module.exports = { getMyActivity, getAllActivity };
